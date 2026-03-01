export async function fetchAllUserSubjects(supabase) {
  const { data, error } = await supabase
    .from('subjects')
    .select('*, cases(name, type)')
    .order('created_at', { ascending: true });

  if (error) {
    return [];
  }
  return data || [];
}

export function detectOverlaps(currentSubject, allSubjects) {
  const overlaps = [];
  const current = currentSubject.profile_data || {};

  for (const other of allSubjects) {
    if (other.id === currentSubject.id) continue;
    const otherData = other.profile_data || {};
    const matches = [];

    // Shared phone (highest signal)
    const currentPhones = new Set(
      (current.contact?.phone_numbers || [])
        .map((p) => (p.number || '').replace(/\D/g, '').slice(-10))
        .filter((n) => n.length >= 7)
    );
    for (const p of otherData.contact?.phone_numbers || []) {
      const normalized = (p.number || '').replace(/\D/g, '').slice(-10);
      if (normalized.length >= 7 && currentPhones.has(normalized)) {
        matches.push({
          type: 'phone',
          label: p.number,
          detail: 'Both subjects share the same phone number — high-confidence link',
        });
      }
    }

    // Shared email (highest signal)
    const currentEmails = new Set(
      (current.contact?.email_addresses || [])
        .map((e) => (e.address || '').toLowerCase())
        .filter(Boolean)
    );
    for (const e of otherData.contact?.email_addresses || []) {
      const addr = (e.address || '').toLowerCase();
      if (addr && currentEmails.has(addr)) {
        matches.push({
          type: 'email',
          label: e.address,
          detail: 'Both subjects share the same email address — high-confidence link',
        });
      }
    }

    // Shared organization
    if (current.professional?.organization && otherData.professional?.organization) {
      if (current.professional.organization.toLowerCase() === otherData.professional.organization.toLowerCase()) {
        matches.push({
          type: 'organization',
          label: current.professional.organization,
          detail: `Both subjects linked to same organization`,
        });
      }
    }

    // Shared breach
    const currentBreaches = new Set((current.breaches?.records || []).map((b) => b.breach_name?.toLowerCase()).filter(Boolean));
    (otherData.breaches?.records || []).forEach((b) => {
      if (b.breach_name && currentBreaches.has(b.breach_name.toLowerCase())) {
        matches.push({
          type: 'breach',
          label: b.breach_name,
          detail: 'Both subjects exposed in same breach — shared organizational vulnerability',
        });
      }
    });

    // Shared data broker
    const currentBrokers = new Set((current.digital?.data_broker_listings || []).map((b) => b.broker?.toLowerCase()).filter(Boolean));
    (otherData.digital?.data_broker_listings || []).forEach((b) => {
      if (b.broker && currentBrokers.has(b.broker.toLowerCase())) {
        matches.push({
          type: 'data_broker',
          label: b.broker,
          detail: 'Same broker has profiles on both subjects — coordinated removal possible',
        });
      }
    });

    // Shared associate (name matching)
    const currentPeople = new Set([
      ...(current.network?.associates || []).map((a) => a.name?.toLowerCase()).filter(Boolean),
      ...(current.network?.family_members || []).map((f) => f.name?.toLowerCase()).filter(Boolean),
    ]);
    const otherPeople = [
      ...(otherData.network?.associates || []).map((a) => ({ name: a.name, type: 'associate' })),
      ...(otherData.network?.family_members || []).map((f) => ({ name: f.name, type: 'family' })),
    ];
    otherPeople.forEach(({ name }) => {
      if (name && currentPeople.has(name.toLowerCase())) {
        matches.push({
          type: 'associate',
          label: name,
          detail: "Shared individual in both subjects' networks",
        });
      }
    });

    // Also check if the other subject's name appears in current's network
    if (other.name) {
      const otherNameLower = other.name.toLowerCase();
      if (currentPeople.has(otherNameLower)) {
        matches.push({
          type: 'direct_link',
          label: other.name,
          detail: 'This subject appears directly in the current subject\'s network',
        });
      }
    }

    // Shared address (city-level match)
    const currentCities = new Set(
      (current.locations?.addresses || [])
        .map((a) => [a.city, a.state].filter(Boolean).join(',').toLowerCase())
        .filter((s) => s.length > 1)
    );
    (otherData.locations?.addresses || []).forEach((a) => {
      const cityState = [a.city, a.state].filter(Boolean).join(',').toLowerCase();
      if (cityState.length > 1 && currentCities.has(cityState)) {
        matches.push({
          type: 'location',
          label: `${a.city}, ${a.state}`,
          detail: 'Both subjects have addresses in same city — potential geographic overlap',
        });
      }
    });

    // Shared social platform
    const currentPlatforms = new Set((current.digital?.social_accounts || []).map((a) => a.platform?.toLowerCase()).filter(Boolean));
    (otherData.digital?.social_accounts || []).forEach((a) => {
      if (a.platform && currentPlatforms.has(a.platform.toLowerCase())) {
        matches.push({
          type: 'platform',
          label: a.platform,
          detail: 'Both subjects active on same platform — potential social graph connection',
        });
      }
    });

    if (matches.length > 0) {
      // De-duplicate matches by type+label
      const seen = new Set();
      const uniqueMatches = matches.filter((m) => {
        const key = `${m.type}:${m.label.toLowerCase()}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      overlaps.push({
        subject: other,
        caseName: other.cases?.name || 'Unknown Case',
        caseType: other.cases?.type || '',
        matchCount: uniqueMatches.length,
        matches: uniqueMatches,
      });
    }
  }

  // Sort by match count descending
  overlaps.sort((a, b) => b.matchCount - a.matchCount);
  return overlaps;
}
