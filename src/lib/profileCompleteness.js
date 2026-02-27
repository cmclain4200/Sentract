const SECTIONS = [
  { key: 'identity', weight: 15, label: 'Identity', check: (d) => d.identity?.full_name?.length > 0 },
  { key: 'professional', weight: 10, label: 'Professional info', check: (d) => d.professional?.title?.length > 0 && d.professional?.organization?.length > 0 },
  { key: 'locations', weight: 12, label: 'Locations', check: (d) => d.locations?.addresses?.length > 0 },
  { key: 'contact', weight: 8, label: 'Contact info', check: (d) => (d.contact?.phone_numbers?.length > 0) || (d.contact?.email_addresses?.length > 0) },
  { key: 'social', weight: 12, label: 'Social accounts', check: (d) => d.digital?.social_accounts?.length > 0 },
  { key: 'brokers', weight: 8, label: 'Data broker listings', check: (d) => d.digital?.data_broker_listings?.length > 0 },
  { key: 'breaches', weight: 10, label: 'Breach data', check: (d) => d.breaches?.records?.length > 0 },
  { key: 'family', weight: 8, label: 'Family details', check: (d) => d.network?.family_members?.length > 0 },
  { key: 'associates', weight: 5, label: 'Associates', check: (d) => d.network?.associates?.length > 0 },
  { key: 'public_records', weight: 5, label: 'Public records', check: (d) => {
    const pr = d.public_records || {};
    return (pr.properties?.length > 0) || (pr.corporate_filings?.length > 0) || (pr.court_records?.length > 0);
  }},
  { key: 'behavioral', weight: 7, label: 'Behavioral patterns', check: (d) => d.behavioral?.routines?.length > 0 },
  { key: 'enriched', weight: 5, label: 'Enriched data', check: (d) => d.contact?.email_addresses?.some(e => e.enrichment?.status === 'checked') },
];

export function calculateCompleteness(profileData) {
  if (!profileData) return { score: 0, details: {}, missing: SECTIONS.map(s => s.label) };

  let score = 0;
  const details = {};
  const missing = [];

  SECTIONS.forEach((s) => {
    const filled = s.check(profileData);
    details[s.key] = filled;
    if (filled) {
      score += s.weight;
    } else {
      missing.push(s.label);
    }
  });

  return { score, details, missing };
}
