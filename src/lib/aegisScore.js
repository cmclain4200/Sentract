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
  const avgConsistency = routines.length > 0 ? routines.reduce((sum, r) => sum + (r.consistency || 0), 0) / routines.length : 0;
  const hasGpsData = pd.digital?.social_accounts?.some((a) => a.platform?.toLowerCase().includes('strava') || a.notes?.toLowerCase().includes('gps')) ? 1 : 0;
  const behavioralScore = Math.min(100, avgConsistency * 80 + routines.length * 5 + hasGpsData * 15);

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

function buildScoreDrivers(pd) {
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

  const confirmedAddr = pd.locations?.addresses?.filter((a) => a.confidence === 'confirmed')?.length || 0;
  if (confirmedAddr > 0) drivers.push({ text: `${confirmedAddr} confirmed address${confirmedAddr > 1 ? 'es' : ''} in public records`, impact: confirmedAddr * 4, category: 'physical' });

  drivers.sort((a, b) => b.impact - a.impact);
  return drivers.slice(0, 10);
}

export function buildRemediationOptions(profileData) {
  if (!profileData) return [];
  const options = [];

  const activeBrokers = profileData.digital?.data_broker_listings?.filter((b) => b.status === 'active') || [];
  if (activeBrokers.length > 0) {
    options.push({
      id: 'remove_brokers',
      label: `Remove ${activeBrokers.length} active data broker listings`,
      scoreReduction: activeBrokers.length * 3,
      affectedFactor: 'digital_footprint',
      enabled: false,
    });
  }

  const publicAccounts = profileData.digital?.social_accounts?.filter((a) => a.visibility === 'public') || [];
  if (publicAccounts.length > 0) {
    options.push({
      id: 'privatize_social',
      label: `Set ${publicAccounts.length} social accounts to private`,
      scoreReduction: publicAccounts.length * 4,
      affectedFactor: 'digital_footprint',
      enabled: false,
    });
  }

  const hasStrava = profileData.digital?.social_accounts?.some((a) => a.platform?.toLowerCase().includes('strava'));
  if (hasStrava) {
    options.push({
      id: 'disable_strava',
      label: 'Disable Strava public GPS tracking',
      scoreReduction: 12,
      affectedFactor: 'behavioral_predictability',
      enabled: false,
    });
  }

  const breachCount = profileData.breaches?.records?.length || 0;
  if (breachCount > 0) {
    options.push({
      id: 'rotate_credentials',
      label: `Rotate credentials for ${breachCount} breached accounts`,
      scoreReduction: Math.min(breachCount * 4, 20),
      affectedFactor: 'breach_exposure',
      enabled: false,
    });
  }

  const hasPublicVenmo = profileData.digital?.social_accounts?.some((a) => a.platform?.toLowerCase().includes('venmo') && a.visibility === 'public');
  if (hasPublicVenmo) {
    options.push({
      id: 'privatize_venmo',
      label: 'Set Venmo transactions to private',
      scoreReduction: 5,
      affectedFactor: 'digital_footprint',
      enabled: false,
    });
  }

  const confirmedAddr = profileData.locations?.addresses?.filter((a) => a.confidence === 'confirmed')?.length || 0;
  if (confirmedAddr > 0) {
    options.push({
      id: 'address_privacy',
      label: 'Register addresses with privacy services',
      scoreReduction: confirmedAddr * 3,
      affectedFactor: 'physical_opsec',
      enabled: false,
    });
  }

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

function defaultScore() {
  return {
    composite: 0,
    riskLevel: 'LOW',
    factors: {
      digital_footprint: { score: 0, weight: 25, label: 'Digital Footprint' },
      breach_exposure: { score: 0, weight: 20, label: 'Breach Exposure' },
      behavioral_predictability: { score: 0, weight: 25, label: 'Behavioral Predictability' },
      physical_opsec: { score: 0, weight: 15, label: 'Physical OPSEC' },
      network_exposure: { score: 0, weight: 15, label: 'Network Exposure' },
    },
    drivers: [],
    calculatedAt: new Date().toISOString(),
  };
}
