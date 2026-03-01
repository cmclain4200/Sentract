export function calculateAegisScore(profileData) {
  if (!profileData) return defaultScore();
  const pd = profileData;

  // Factor 1: Digital Footprint (25%)
  const socialCount = pd.digital?.social_accounts?.length || 0;
  const publicAccounts = pd.digital?.social_accounts?.filter((a) => a.visibility === 'public')?.length || 0;
  const brokerCount = pd.digital?.data_broker_listings?.filter((b) => b.status === 'active')?.length || 0;
  const digitalScore = Math.min(100, socialCount * 8 + publicAccounts * 12 + brokerCount * 6);

  // Factor 2: Breach Exposure (20%)
  const breachCount = pd.breaches?.records?.length || 0;
  const criticalBreaches = pd.breaches?.records?.filter((b) => b.severity === 'high')?.length || 0;
  const passwordExposed = pd.breaches?.records?.some((b) => b.data_types?.some((dt) => dt.toLowerCase().includes('password'))) ? 1 : 0;
  const breachScore = Math.min(100, breachCount * 10 + criticalBreaches * 15 + passwordExposed * 20);

  // Factor 3: Behavioral Predictability (25%)
  const routines = pd.behavioral?.routines || [];
  const observations = pd.behavioral?.observations || [];
  const highExploitObs = observations.filter((o) => o.exploitability === 'high');
  const avgConsistency = routines.length > 0 ? routines.reduce((sum, r) => sum + (r.consistency || 0), 0) / routines.length : 0;
  const hasGpsData = pd.digital?.social_accounts?.some((a) => a.platform?.toLowerCase().includes('strava') || a.notes?.toLowerCase().includes('gps')) ? 1 : 0;
  const behavioralScore = Math.min(100, avgConsistency * 80 + routines.length * 5 + hasGpsData * 15 + observations.length * 3 + highExploitObs.length * 8);

  // Factor 4: Physical OPSEC (15%)
  const confirmedAddresses = pd.locations?.addresses?.filter((a) => a.confidence === 'confirmed')?.length || 0;
  const addressCount = pd.locations?.addresses?.length || 0;
  const propertyRecords = pd.public_records?.properties?.length || 0;
  const physicalScore = Math.min(100, confirmedAddresses * 20 + addressCount * 10 + propertyRecords * 12);

  // Factor 5: Network Exposure (15%)
  const familyPublicSocial = pd.network?.family_members?.filter((f) => f.notes?.toLowerCase().includes('public') || f.social_media?.some?.((s) => s.visibility === 'public'))?.length || 0;
  const totalFamily = pd.network?.family_members?.length || 0;
  const totalAssociates = pd.network?.associates?.length || 0;
  const networkScore = Math.min(100, familyPublicSocial * 15 + totalFamily * 5 + totalAssociates * 5);

  const composite = Math.round(
    digitalScore * 0.25 + breachScore * 0.2 + behavioralScore * 0.25 + physicalScore * 0.15 + networkScore * 0.15
  );

  let riskLevel;
  if (composite >= 75) riskLevel = 'CRITICAL';
  else if (composite >= 55) riskLevel = 'HIGH';
  else if (composite >= 35) riskLevel = 'MODERATE';
  else riskLevel = 'LOW';

  const drivers = buildScoreDrivers(pd);

  return {
    composite,
    riskLevel,
    factors: {
      digital_footprint: { score: digitalScore, weight: 25, label: 'Digital Footprint' },
      breach_exposure: { score: breachScore, weight: 20, label: 'Breach Exposure' },
      behavioral_predictability: { score: behavioralScore, weight: 25, label: 'Behavioral Predictability' },
      physical_opsec: { score: physicalScore, weight: 15, label: 'Physical OPSEC' },
      network_exposure: { score: networkScore, weight: 15, label: 'Network Exposure' },
    },
    drivers,
    calculatedAt: new Date().toISOString(),
  };
}

export function buildScoreDrivers(pd) {
  const drivers = [];

  const brokerCount = pd.digital?.data_broker_listings?.filter((b) => b.status === 'active')?.length || 0;
  if (brokerCount > 0) drivers.push({ text: `${brokerCount} active data broker listing${brokerCount > 1 ? 's' : ''}`, impact: brokerCount > 5 ? brokerCount + 8 : brokerCount + 4, category: 'digital' });

  const publicSocial = pd.digital?.social_accounts?.filter((a) => a.visibility === 'public')?.length || 0;
  if (publicSocial > 0) drivers.push({ text: `${publicSocial} public social media account${publicSocial > 1 ? 's' : ''}`, impact: publicSocial * 3, category: 'digital' });

  const breachCount = pd.breaches?.records?.length || 0;
  if (breachCount > 0) drivers.push({ text: `${breachCount} confirmed breach exposure${breachCount > 1 ? 's' : ''}`, impact: breachCount * 3, category: 'breach' });

  const passwordBreaches = pd.breaches?.records?.filter((b) => b.data_types?.some((dt) => dt.toLowerCase().includes('password')))?.length || 0;
  if (passwordBreaches > 0) drivers.push({ text: `Password exposed in ${passwordBreaches} breach${passwordBreaches > 1 ? 'es' : ''}`, impact: passwordBreaches * 5, category: 'breach' });

  const routines = pd.behavioral?.routines || [];
  routines.forEach((r) => {
    if (r.consistency > 0.7) {
      drivers.push({ text: `${r.name}: ${Math.round(r.consistency * 100)}% predictability`, impact: Math.round(r.consistency * 10), category: 'behavioral' });
    }
  });

  const hasStrava = pd.digital?.social_accounts?.some((a) => a.platform?.toLowerCase().includes('strava'));
  if (hasStrava) drivers.push({ text: 'Public GPS tracking (Strava)', impact: 8, category: 'behavioral' });

  const observations = pd.behavioral?.observations || [];
  const highExploitObs = observations.filter((o) => o.exploitability === 'high');
  if (highExploitObs.length > 0) {
    drivers.push({ text: `${highExploitObs.length} high-exploitability observation${highExploitObs.length > 1 ? 's' : ''}`, impact: highExploitObs.length * 4, category: 'behavioral' });
  } else if (observations.length > 0) {
    drivers.push({ text: `${observations.length} behavioral observation${observations.length > 1 ? 's' : ''} documented`, impact: observations.length * 2, category: 'behavioral' });
  }

  const confirmedAddr = pd.locations?.addresses?.filter((a) => a.confidence === 'confirmed')?.length || 0;
  if (confirmedAddr > 0) drivers.push({ text: `${confirmedAddr} confirmed address${confirmedAddr > 1 ? 'es' : ''} in public records`, impact: confirmedAddr * 4, category: 'physical' });

  drivers.sort((a, b) => b.impact - a.impact);
  return drivers.slice(0, 10);
}

export function buildRemediationOptions(profileData) {
  if (!profileData) return [];
  const options = [];

  // ── Digital & Data Cleanup ──

  const activeBrokers = profileData.digital?.data_broker_listings?.filter((b) => b.status === 'active') || [];
  if (activeBrokers.length > 0) {
    options.push({
      id: 'remove_brokers',
      label: `Remove ${activeBrokers.length} active data broker listings`,
      description: `${activeBrokers.length} broker${activeBrokers.length > 1 ? 's' : ''} currently exposing PII. Removal requests typically take 2-4 weeks.`,
      scoreReduction: activeBrokers.length * 3,
      affectedFactor: 'digital_footprint',
      category: 'digital',
      enabled: false,
    });
  }

  const publicAccounts = profileData.digital?.social_accounts?.filter((a) => a.visibility === 'public') || [];
  if (publicAccounts.length > 0) {
    options.push({
      id: 'privatize_social',
      label: `Privatize ${publicAccounts.length} social media accounts`,
      description: `Set ${publicAccounts.map((a) => a.platform).filter(Boolean).join(', ') || 'accounts'} to private to reduce digital footprint.`,
      scoreReduction: publicAccounts.length * 4,
      affectedFactor: 'digital_footprint',
      category: 'digital',
      enabled: false,
    });
  }

  const breachCount = profileData.breaches?.records?.length || 0;
  if (breachCount > 0) {
    options.push({
      id: 'rotate_credentials',
      label: `Rotate credentials for ${breachCount} breached accounts`,
      description: 'Change passwords and enable 2FA on all breached accounts.',
      scoreReduction: Math.min(breachCount * 4, 20),
      affectedFactor: 'breach_exposure',
      category: 'digital',
      enabled: false,
    });
  }

  const hasPublicVenmo = profileData.digital?.social_accounts?.some((a) => a.platform?.toLowerCase().includes('venmo') && a.visibility === 'public');
  if (hasPublicVenmo) {
    options.push({
      id: 'privatize_venmo',
      label: 'Set Venmo transactions to private',
      description: 'Public Venmo feeds reveal financial associations and location patterns.',
      scoreReduction: 5,
      affectedFactor: 'digital_footprint',
      category: 'digital',
      enabled: false,
    });
  }

  // ── Behavioral Changes ──

  const routines = profileData.behavioral?.routines || [];
  const highConsistencyRoutines = routines.filter((r) => {
    const c = r.consistency != null ? (r.consistency > 1 ? r.consistency : r.consistency * 100) : 0;
    return c > 60;
  });

  highConsistencyRoutines.forEach((routine, i) => {
    const consistency = routine.consistency > 1 ? routine.consistency : Math.round(routine.consistency * 100);
    const loc = routine.location || routine.name || 'routine';
    const schedule = routine.schedule || routine.name || '';
    options.push({
      id: `randomize_routine_${i}`,
      label: `Randomize schedule: ${schedule} ${loc}`.trim(),
      description: `Current consistency: ${consistency}%. Varying this routine by ±30-60 minutes on random days reduces predictability.`,
      scoreReduction: Math.round(consistency * 0.08),
      affectedFactor: 'behavioral_predictability',
      category: 'behavioral',
      enabled: false,
    });
  });

  if (routines.length > 0) {
    const addressCount = profileData.locations?.addresses?.length || 0;
    const routineCount = routines.length;
    options.push({
      id: 'vary_commute',
      label: 'Vary commute routes (rotate 2-3 alternatives)',
      description: `${addressCount} known address${addressCount !== 1 ? 'es' : ''} and ${routineCount} routine${routineCount !== 1 ? 's' : ''} create predictable transit patterns.`,
      scoreReduction: Math.max(2, Math.min(addressCount + routineCount, 8)),
      affectedFactor: 'behavioral_predictability',
      category: 'behavioral',
      enabled: false,
    });
  }

  // GPS broadcasting (Strava, fitness trackers)
  const gpsAccounts = profileData.digital?.social_accounts?.filter((a) => {
    const p = (a.platform || '').toLowerCase();
    const n = (a.notes || '').toLowerCase();
    return p.includes('strava') || p.includes('garmin') || p.includes('fitbit') || p.includes('alltrails') ||
      n.includes('gps') || n.includes('fitness') || n.includes('tracking');
  }) || [];
  if (gpsAccounts.length > 0) {
    options.push({
      id: 'disable_gps',
      label: `Eliminate GPS-broadcasting activities (${gpsAccounts.map((a) => a.platform).filter(Boolean).join(', ') || 'fitness trackers'})`,
      description: 'Public GPS data reveals routes, timing patterns, and frequently visited locations.',
      scoreReduction: gpsAccounts.length > 1 ? 10 : 6,
      affectedFactor: 'behavioral_predictability',
      category: 'behavioral',
      enabled: false,
    });
  }

  // ── Physical Security ──

  const addresses = profileData.locations?.addresses || [];
  addresses.forEach((addr, i) => {
    const locLabel = [addr.city, addr.state].filter(Boolean).join(', ') || `Address ${i + 1}`;
    const typeLabel = addr.type || 'address';
    options.push({
      id: `enhance_security_${i}`,
      label: `Enhance security at ${typeLabel}: ${locLabel}`,
      description: 'Install monitoring, vary entry/exit patterns, assess sight lines from adjacent structures.',
      scoreReduction: addr.type === 'primary' ? 6 : 3,
      affectedFactor: 'physical_opsec',
      category: 'physical',
      enabled: false,
    });
  });

  if (addresses.length > 1) {
    options.push({
      id: 'reduce_addresses',
      label: 'Reduce confirmed address count (PO box, registered agent)',
      description: `${addresses.length} confirmed addresses in public records. Use PO boxes and registered agents to reduce publicly linked locations.`,
      scoreReduction: Math.min(addresses.length * 2, 8),
      affectedFactor: 'physical_opsec',
      category: 'physical',
      enabled: false,
    });
  }

  const properties = profileData.public_records?.properties || [];
  if (properties.length > 0) {
    options.push({
      id: 'property_trust',
      label: `Transfer ${properties.length} propert${properties.length > 1 ? 'ies' : 'y'} to trust or LLC`,
      description: 'Properties held in personal name are discoverable via public records. Transferring to a trust removes the direct name link.',
      scoreReduction: properties.length * 3,
      affectedFactor: 'physical_opsec',
      category: 'physical',
      enabled: false,
    });
  }

  // ── Network & Family ──

  const familyMembers = profileData.network?.family_members || [];
  const familyWithPublicSocial = familyMembers.filter((f) => {
    if (f.social_media?.some?.((s) => s.visibility === 'public' || s.url)) return true;
    if (f.notes?.toLowerCase().includes('public')) return true;
    return false;
  });

  if (familyWithPublicSocial.length > 0) {
    options.push({
      id: 'family_opsec',
      label: `Family OPSEC: ${familyWithPublicSocial.length} family member${familyWithPublicSocial.length > 1 ? 's' : ''} with public social media`,
      description: 'Family members with public social accounts can inadvertently reveal locations, schedules, and associations. Recommend privacy settings review.',
      scoreReduction: familyWithPublicSocial.length * 2,
      affectedFactor: 'network_exposure',
      category: 'network',
      enabled: false,
    });
  }

  // Sort within each category by scoreReduction descending
  options.sort((a, b) => {
    if (a.category !== b.category) return 0; // preserve category ordering
    return b.scoreReduction - a.scoreReduction;
  });

  return options;
}

export function simulateRemediation(baseScore, options) {
  let totalReduction = 0;
  const factorReductions = {};

  options.forEach((opt) => {
    if (!opt.enabled) return;
    totalReduction += opt.scoreReduction;
    if (!factorReductions[opt.affectedFactor]) factorReductions[opt.affectedFactor] = 0;
    factorReductions[opt.affectedFactor] += opt.scoreReduction;
  });

  const simulatedComposite = Math.max(0, baseScore.composite - totalReduction);
  let riskLevel;
  if (simulatedComposite >= 75) riskLevel = 'CRITICAL';
  else if (simulatedComposite >= 55) riskLevel = 'HIGH';
  else if (simulatedComposite >= 35) riskLevel = 'MODERATE';
  else riskLevel = 'LOW';

  const simulatedFactors = { ...baseScore.factors };
  for (const [key, reduction] of Object.entries(factorReductions)) {
    if (simulatedFactors[key]) {
      simulatedFactors[key] = {
        ...simulatedFactors[key],
        score: Math.max(0, simulatedFactors[key].score - Math.round(reduction / (simulatedFactors[key].weight / 100))),
      };
    }
  }

  return { composite: simulatedComposite, riskLevel, factors: simulatedFactors, reduction: totalReduction };
}
