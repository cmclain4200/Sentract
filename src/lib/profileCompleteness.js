// Data-volume-aware completeness scoring.
// Each section scores based on how much data is present, not just whether any exists.

function clamp(val, max) {
  return Math.min(val, max);
}

function countFilledFields(obj, fields) {
  if (!obj) return 0;
  return fields.filter((f) => {
    const v = obj[f];
    return v != null && v !== '' && v !== false;
  }).length;
}

const SECTIONS = [
  {
    key: 'identity',
    weight: 15,
    label: 'Identity',
    score: (d) => {
      const id = d.identity || {};
      const fields = countFilledFields(id, ['full_name', 'date_of_birth', 'gender', 'nationality', 'aliases']);
      const aliasCount = (id.aliases?.length || 0);
      // full_name is essential (40%), rest scales with volume
      const namePoints = id.full_name?.length > 0 ? 0.4 : 0;
      const fieldPoints = clamp((fields - (id.full_name ? 1 : 0)) / 4, 1) * 0.3;
      const aliasPoints = clamp(aliasCount / 3, 1) * 0.3;
      return namePoints + fieldPoints + aliasPoints;
    },
  },
  {
    key: 'professional',
    weight: 10,
    label: 'Professional info',
    score: (d) => {
      const pro = d.professional || {};
      const fields = countFilledFields(pro, ['title', 'organization', 'industry', 'linkedin_url', 'employment_history']);
      const historyCount = pro.employment_history?.length || 0;
      const fieldPortion = clamp(fields / 5, 1) * 0.6;
      const historyPortion = clamp(historyCount / 3, 1) * 0.4;
      return fieldPortion + historyPortion;
    },
  },
  {
    key: 'locations',
    weight: 12,
    label: 'Locations',
    score: (d) => {
      const addrs = d.locations?.addresses || [];
      if (addrs.length === 0) return 0;
      // More addresses = more complete picture
      const countScore = clamp(addrs.length / 4, 1) * 0.5;
      // Addresses with more fields filled are more valuable
      const detailScore = addrs.reduce((sum, a) => {
        return sum + countFilledFields(a, ['street', 'city', 'state', 'zip', 'country', 'type', 'confidence']) / 7;
      }, 0) / Math.max(addrs.length, 1) * 0.5;
      return countScore + detailScore;
    },
  },
  {
    key: 'contact',
    weight: 8,
    label: 'Contact info',
    score: (d) => {
      const phones = d.contact?.phone_numbers?.filter((p) => p.number)?.length || 0;
      const emails = d.contact?.email_addresses?.filter((e) => e.address)?.length || 0;
      const phonePortion = clamp(phones / 3, 1) * 0.5;
      const emailPortion = clamp(emails / 3, 1) * 0.5;
      return phonePortion + emailPortion;
    },
  },
  {
    key: 'social',
    weight: 12,
    label: 'Social accounts',
    score: (d) => {
      const accounts = d.digital?.social_accounts || [];
      if (accounts.length === 0) return 0;
      // Volume of accounts matters
      const countScore = clamp(accounts.length / 6, 1) * 0.6;
      // Accounts with more detail (username, url, visibility) are more valuable
      const detailScore = accounts.reduce((sum, a) => {
        return sum + countFilledFields(a, ['platform', 'username', 'url', 'visibility', 'followers']) / 5;
      }, 0) / Math.max(accounts.length, 1) * 0.4;
      return countScore + detailScore;
    },
  },
  {
    key: 'brokers',
    weight: 8,
    label: 'Data broker listings',
    score: (d) => {
      const brokers = d.digital?.data_broker_listings || [];
      if (brokers.length === 0) return 0;
      return clamp(brokers.length / 5, 1);
    },
  },
  {
    key: 'breaches',
    weight: 10,
    label: 'Breach data',
    score: (d) => {
      const records = d.breaches?.records || [];
      if (records.length === 0) return 0;
      const countScore = clamp(records.length / 5, 1) * 0.5;
      // Records with severity and data_types are more informative
      const detailScore = records.reduce((sum, b) => {
        return sum + countFilledFields(b, ['breach_name', 'severity', 'data_types', 'date', 'source']) / 5;
      }, 0) / Math.max(records.length, 1) * 0.5;
      return countScore + detailScore;
    },
  },
  {
    key: 'family',
    weight: 8,
    label: 'Family details',
    score: (d) => {
      const members = d.network?.family_members || [];
      if (members.length === 0) return 0;
      const countScore = clamp(members.length / 5, 1) * 0.5;
      const detailScore = members.reduce((sum, m) => {
        return sum + countFilledFields(m, ['name', 'relationship', 'notes', 'social_media']) / 4;
      }, 0) / Math.max(members.length, 1) * 0.5;
      return countScore + detailScore;
    },
  },
  {
    key: 'associates',
    weight: 5,
    label: 'Associates',
    score: (d) => {
      const assocs = d.network?.associates || [];
      if (assocs.length === 0) return 0;
      return clamp(assocs.length / 4, 1);
    },
  },
  {
    key: 'public_records',
    weight: 5,
    label: 'Public records',
    score: (d) => {
      const pr = d.public_records || {};
      const propCount = pr.properties?.length || 0;
      const filingCount = pr.corporate_filings?.length || 0;
      const courtCount = pr.court_records?.length || 0;
      const total = propCount + filingCount + courtCount;
      if (total === 0) return 0;
      return clamp(total / 5, 1);
    },
  },
  {
    key: 'behavioral',
    weight: 7,
    label: 'Behavioral patterns',
    score: (d) => {
      const routines = d.behavioral?.routines || [];
      if (routines.length === 0) return 0;
      const countScore = clamp(routines.length / 4, 1) * 0.5;
      const detailScore = routines.reduce((sum, r) => {
        return sum + countFilledFields(r, ['name', 'schedule', 'location', 'consistency', 'data_source']) / 5;
      }, 0) / Math.max(routines.length, 1) * 0.5;
      return countScore + detailScore;
    },
  },
  {
    key: 'enriched',
    weight: 5,
    label: 'Enriched data',
    score: (d) => {
      const emails = d.contact?.email_addresses || [];
      const checked = emails.filter((e) => e.enrichment?.status === 'checked').length;
      if (checked === 0) return 0;
      return clamp(checked / Math.max(emails.length, 1), 1);
    },
  },
];

export function calculateCompleteness(profileData) {
  if (!profileData) return { score: 0, details: {}, missing: SECTIONS.map((s) => s.label) };

  let score = 0;
  const details = {};
  const missing = [];

  SECTIONS.forEach((s) => {
    const sectionScore = s.score(profileData); // 0.0 to 1.0
    const points = Math.round(sectionScore * s.weight);
    details[s.key] = sectionScore > 0;
    if (sectionScore === 0) {
      missing.push(s.label);
    }
    score += points;
  });

  return { score: Math.min(score, 100), details, missing };
}
