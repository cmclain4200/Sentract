import { callAnthropic } from './api';

const SYSTEM_PROMPT = `You are a data extraction system. Your job is to read investigation reports, due diligence documents, or intelligence assessments and extract structured information about the subject(s).

Extract ONLY information that is explicitly stated or clearly implied in the document. Do NOT invent, assume, or hallucinate any data points.

Return a JSON object matching this exact schema. Include only fields where you found data — leave others as empty strings, empty arrays, or null:

{
  "identity": {
    "full_name": "",
    "aliases": [],
    "date_of_birth": "",
    "age": null,
    "nationality": "",
    "gender": ""
  },
  "professional": {
    "title": "",
    "organization": "",
    "organization_type": "",
    "industry": "",
    "annual_revenue": "",
    "education": [{ "institution": "", "degree": "", "year": "" }]
  },
  "locations": {
    "addresses": [{
      "type": "home|work|vacation|secondary|previous",
      "label": "",
      "street": "",
      "city": "",
      "state": "",
      "zip": "",
      "country": "",
      "source": "Extracted from uploaded report",
      "confidence": "confirmed|probable|unverified"
    }]
  },
  "contact": {
    "phone_numbers": [{ "type": "personal|work", "number": "", "source": "Extracted from uploaded report" }],
    "email_addresses": [{ "type": "personal|work|legacy", "address": "", "source": "Extracted from uploaded report" }]
  },
  "digital": {
    "social_accounts": [{
      "platform": "",
      "handle": "",
      "url": "",
      "visibility": "public|private|friends_only|semi_public",
      "followers": null,
      "notes": ""
    }],
    "data_broker_listings": [{
      "broker": "",
      "status": "active|removed",
      "data_exposed": ""
    }]
  },
  "breaches": {
    "records": [{
      "breach_name": "",
      "date": "",
      "email_exposed": "",
      "data_types": [],
      "severity": "high|medium|low",
      "notes": ""
    }]
  },
  "network": {
    "family_members": [{
      "name": "",
      "relationship": "",
      "age": null,
      "occupation": "",
      "social_media": [],
      "notes": ""
    }],
    "associates": [{
      "name": "",
      "relationship": "",
      "shared_data_points": [],
      "notes": ""
    }]
  },
  "public_records": {
    "properties": [{ "type": "", "address": "", "value": "", "source": "" }],
    "corporate_filings": [{ "entity": "", "role": "", "jurisdiction": "", "source": "" }],
    "court_records": [{ "type": "", "case": "", "jurisdiction": "", "summary": "" }],
    "political_donations": [{ "recipient": "", "amount": "", "date": "", "source": "" }]
  },
  "behavioral": {
    "routines": [{
      "name": "",
      "description": "",
      "schedule": "",
      "consistency": null,
      "location": "",
      "data_source": "",
      "notes": ""
    }],
    "travel_patterns": [{
      "pattern": "",
      "frequency": "",
      "data_source": "",
      "notes": ""
    }]
  },
  "extraction_summary": {
    "total_data_points": 0,
    "sections_populated": [],
    "confidence_notes": ""
  }
}

Return ONLY the JSON object. No markdown, no backticks, no explanation.`;

export async function extractProfileFromText(text) {
  const truncatedText = text.slice(0, 50000);

  const data = await callAnthropic({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 8000,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: `Extract structured profile data from this investigation document:\n\n${truncatedText}`,
      },
    ],
  });

  const textResponse = data.content?.[0]?.text || '';

  const cleaned = textResponse
    .replace(/```json\n?/g, '')
    .replace(/```\n?/g, '')
    .trim();

  return JSON.parse(cleaned);
}

export function buildExtractionSummary(extracted) {
  const counts = [];

  if (extracted.identity?.full_name) counts.push('Identity');
  const addrCount = extracted.locations?.addresses?.length || 0;
  if (addrCount > 0) counts.push(`${addrCount} address${addrCount > 1 ? 'es' : ''}`);
  const phoneCount = extracted.contact?.phone_numbers?.length || 0;
  const emailCount = extracted.contact?.email_addresses?.length || 0;
  if (phoneCount > 0 || emailCount > 0) counts.push(`${phoneCount} phone${phoneCount !== 1 ? 's' : ''}, ${emailCount} email${emailCount !== 1 ? 's' : ''}`);
  const socialCount = extracted.digital?.social_accounts?.length || 0;
  if (socialCount > 0) counts.push(`${socialCount} social account${socialCount > 1 ? 's' : ''}`);
  const brokerCount = extracted.digital?.data_broker_listings?.length || 0;
  if (brokerCount > 0) counts.push(`${brokerCount} broker listing${brokerCount > 1 ? 's' : ''}`);
  const breachCount = extracted.breaches?.records?.length || 0;
  if (breachCount > 0) counts.push(`${breachCount} breach record${breachCount > 1 ? 's' : ''}`);
  const familyCount = extracted.network?.family_members?.length || 0;
  if (familyCount > 0) counts.push(`${familyCount} family member${familyCount > 1 ? 's' : ''}`);
  const assocCount = extracted.network?.associates?.length || 0;
  if (assocCount > 0) counts.push(`${assocCount} associate${assocCount > 1 ? 's' : ''}`);
  const prCount = (extracted.public_records?.properties?.length || 0) +
    (extracted.public_records?.corporate_filings?.length || 0) +
    (extracted.public_records?.court_records?.length || 0) +
    (extracted.public_records?.political_donations?.length || 0);
  if (prCount > 0) counts.push(`${prCount} public record${prCount > 1 ? 's' : ''}`);
  const routineCount = extracted.behavioral?.routines?.length || 0;
  const travelCount = extracted.behavioral?.travel_patterns?.length || 0;
  if (routineCount + travelCount > 0) counts.push(`${routineCount + travelCount} behavioral pattern${routineCount + travelCount > 1 ? 's' : ''}`);

  const total = extracted.extraction_summary?.total_data_points ||
    addrCount + phoneCount + emailCount + socialCount + brokerCount +
    breachCount + familyCount + assocCount + prCount + routineCount + travelCount;

  return { counts, total, sectionsPopulated: counts.length };
}

export function mergeExtractedIntoProfile(existing, extracted) {
  const merged = JSON.parse(JSON.stringify(existing));
  const aiFields = new Set();

  // Identity — overwrite blank fields
  if (extracted.identity) {
    const id = extracted.identity;
    if (id.full_name && !merged.identity.full_name) { merged.identity.full_name = id.full_name; aiFields.add('identity.full_name'); }
    if (id.aliases?.length) { merged.identity.aliases = [...merged.identity.aliases, ...id.aliases]; aiFields.add('identity.aliases'); }
    if (id.date_of_birth && !merged.identity.date_of_birth) { merged.identity.date_of_birth = id.date_of_birth; aiFields.add('identity.date_of_birth'); }
    if (id.age && !merged.identity.age) { merged.identity.age = id.age; aiFields.add('identity.age'); }
    if (id.nationality && !merged.identity.nationality) { merged.identity.nationality = id.nationality; aiFields.add('identity.nationality'); }
    if (id.gender && !merged.identity.gender) { merged.identity.gender = id.gender; aiFields.add('identity.gender'); }
  }

  // Professional
  if (extracted.professional) {
    const p = extracted.professional;
    if (p.title && !merged.professional.title) { merged.professional.title = p.title; aiFields.add('professional.title'); }
    if (p.organization && !merged.professional.organization) { merged.professional.organization = p.organization; aiFields.add('professional.organization'); }
    if (p.organization_type && !merged.professional.organization_type) merged.professional.organization_type = p.organization_type;
    if (p.industry && !merged.professional.industry) merged.professional.industry = p.industry;
    if (p.annual_revenue && !merged.professional.annual_revenue) merged.professional.annual_revenue = p.annual_revenue;
    if (p.education?.length) { merged.professional.education = [...merged.professional.education, ...p.education]; aiFields.add('professional.education'); }
  }

  // Arrays — append extracted items
  const arrayMerges = [
    ['locations.addresses', extracted.locations?.addresses],
    ['contact.phone_numbers', extracted.contact?.phone_numbers],
    ['contact.email_addresses', extracted.contact?.email_addresses],
    ['digital.social_accounts', extracted.digital?.social_accounts],
    ['digital.data_broker_listings', extracted.digital?.data_broker_listings],
    ['breaches.records', extracted.breaches?.records],
    ['network.family_members', extracted.network?.family_members],
    ['network.associates', extracted.network?.associates],
    ['public_records.properties', extracted.public_records?.properties],
    ['public_records.corporate_filings', extracted.public_records?.corporate_filings],
    ['public_records.court_records', extracted.public_records?.court_records],
    ['public_records.political_donations', extracted.public_records?.political_donations],
    ['behavioral.routines', extracted.behavioral?.routines],
    ['behavioral.travel_patterns', extracted.behavioral?.travel_patterns],
  ];

  arrayMerges.forEach(([path, items]) => {
    if (!items?.length) return;
    const [section, field] = path.split('.');
    if (!merged[section]) merged[section] = {};
    if (!merged[section][field]) merged[section][field] = [];
    const tagged = items.map((item) => ({ ...item, _aiExtracted: true }));
    merged[section][field] = [...merged[section][field], ...tagged];
    aiFields.add(path);
  });

  return { merged, aiFields };
}
