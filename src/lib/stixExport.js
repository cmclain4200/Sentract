import { calculateAegisScore } from './aegisScore';

function uuidv4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

function stixId(type) {
  return `${type}--${uuidv4()}`;
}

function nowIso() {
  return new Date().toISOString();
}

function toIsoDate(val) {
  if (!val) return null;
  if (typeof val === 'string') {
    // Already ISO format
    if (val.includes('T')) return val;
    // Year-only: "2019" → "2019-01-01T00:00:00Z"
    if (/^\d{4}$/.test(val)) return `${val}-01-01T00:00:00Z`;
    // Year-month: "2019-03" → "2019-03-01T00:00:00Z"
    if (/^\d{4}-\d{2}$/.test(val)) return `${val}-01T00:00:00Z`;
    // Date only: "2019-03-15" → "2019-03-15T00:00:00Z"
    if (/^\d{4}-\d{2}-\d{2}$/.test(val)) return `${val}T00:00:00Z`;
  }
  return val;
}

export function generateStixBundle(subject, profileData, caseData, { reconNarrative } = {}) {
  const now = nowIso();
  const objects = [];

  // Aegis score
  const aegis = calculateAegisScore(profileData);

  // Identity object for the subject
  const identityId = stixId('identity');
  objects.push({
    type: 'identity',
    spec_version: '2.1',
    id: identityId,
    created: now,
    modified: now,
    name: subject?.name || 'Unknown Subject',
    identity_class: 'individual',
    description: `Subject from Sentract case: ${caseData?.name || 'Unknown'}`,
    ...(profileData?.identity?.full_name && { x_full_name: profileData.identity.full_name }),
    ...(profileData?.professional?.organization && { x_organization: profileData.professional.organization }),
    x_sentract_aegis_score: aegis.composite,
    x_sentract_risk_level: aegis.riskLevel,
  });

  // Indicators for email addresses
  for (const email of profileData?.contact?.email_addresses || []) {
    if (!email.address) continue;
    const indId = stixId('indicator');
    objects.push({
      type: 'indicator',
      spec_version: '2.1',
      id: indId,
      created: now,
      modified: now,
      name: `Email: ${email.address}`,
      description: `Email address associated with subject (type: ${email.type || 'unknown'})`,
      pattern: `[email-addr:value = '${email.address.replace(/'/g, "\\'")}']`,
      pattern_type: 'stix',
      valid_from: now,
      indicator_types: ['attribution'],
    });
    objects.push({
      type: 'relationship',
      spec_version: '2.1',
      id: stixId('relationship'),
      created: now,
      modified: now,
      relationship_type: 'indicates',
      source_ref: indId,
      target_ref: identityId,
    });
  }

  // Indicators for phone numbers
  for (const phone of profileData?.contact?.phone_numbers || []) {
    if (!phone.number) continue;
    const indId = stixId('indicator');
    objects.push({
      type: 'indicator',
      spec_version: '2.1',
      id: indId,
      created: now,
      modified: now,
      name: `Phone: ${phone.number}`,
      description: `Phone number associated with subject (type: ${phone.type || 'unknown'})`,
      pattern: `[x-phone-number:value = '${phone.number.replace(/'/g, "\\'")}']`,
      pattern_type: 'stix',
      valid_from: now,
      indicator_types: ['attribution'],
    });
    objects.push({
      type: 'relationship',
      spec_version: '2.1',
      id: stixId('relationship'),
      created: now,
      modified: now,
      relationship_type: 'indicates',
      source_ref: indId,
      target_ref: identityId,
    });
  }

  // Indicators for social handles
  for (const account of profileData?.digital?.social_accounts || []) {
    if (!account.handle && !account.url) continue;
    const indId = stixId('indicator');
    const value = account.handle || account.url;
    objects.push({
      type: 'indicator',
      spec_version: '2.1',
      id: indId,
      created: now,
      modified: now,
      name: `Social: ${account.platform || 'unknown'} - ${value}`,
      description: `Social media account on ${account.platform || 'unknown platform'} (visibility: ${account.visibility || 'unknown'})`,
      pattern: `[user-account:account_login = '${value.replace(/'/g, "\\'")}']`,
      pattern_type: 'stix',
      valid_from: now,
      indicator_types: ['attribution'],
    });
    objects.push({
      type: 'relationship',
      spec_version: '2.1',
      id: stixId('relationship'),
      created: now,
      modified: now,
      relationship_type: 'indicates',
      source_ref: indId,
      target_ref: identityId,
    });
  }

  // Observed-data for breach records (with fixed first_observed)
  for (const breach of profileData?.breaches?.records || []) {
    if (!breach.breach_name) continue;
    const observed = toIsoDate(breach.breach_date) || now;
    objects.push({
      type: 'observed-data',
      spec_version: '2.1',
      id: stixId('observed-data'),
      created: now,
      modified: now,
      first_observed: observed,
      last_observed: observed,
      number_observed: 1,
      object_refs: [identityId],
      x_breach_name: breach.breach_name,
      x_breach_severity: breach.severity || 'unknown',
      x_data_types: breach.data_types || [],
    });
  }

  // Location objects for addresses
  for (const addr of profileData?.locations?.addresses || []) {
    const locId = stixId('location');
    const locName = [addr.street, addr.city, addr.state, addr.zip, addr.country].filter(Boolean).join(', ') || 'Unknown';
    objects.push({
      type: 'location',
      spec_version: '2.1',
      id: locId,
      created: now,
      modified: now,
      name: locName,
      ...(addr.city && { city: addr.city }),
      ...(addr.state && { administrative_area: addr.state }),
      ...(addr.country && { country: addr.country }),
      ...(addr.street && { street_address: addr.street }),
      ...(addr.zip && { postal_code: addr.zip }),
      ...(addr.type && { x_address_type: addr.type }),
      ...(addr.confidence && { x_confidence: addr.confidence }),
    });
    objects.push({
      type: 'relationship',
      spec_version: '2.1',
      id: stixId('relationship'),
      created: now,
      modified: now,
      relationship_type: 'located-at',
      source_ref: identityId,
      target_ref: locId,
    });
  }

  // Note object for Recon Mirror narrative
  if (reconNarrative) {
    objects.push({
      type: 'note',
      spec_version: '2.1',
      id: stixId('note'),
      created: now,
      modified: now,
      content: reconNarrative,
      object_refs: [identityId],
      x_note_type: 'recon_mirror_assessment',
    });
  }

  // Report object summarizing the bundle
  const reportId = stixId('report');
  objects.push({
    type: 'report',
    spec_version: '2.1',
    id: reportId,
    created: now,
    modified: now,
    name: `Sentract Intelligence Report: ${subject?.name || 'Unknown'}`,
    description: `Adversarial risk intelligence assessment for case: ${caseData?.name || 'Unknown'}`,
    published: now,
    report_types: ['threat-report'],
    object_refs: objects.map((o) => o.id),
  });

  const bundle = {
    type: 'bundle',
    id: stixId('bundle'),
    spec_version: '2.1',
    created: now,
    objects,
  };

  return JSON.stringify(bundle, null, 2);
}

export function downloadStixBundle(subject, profileData, caseData, options = {}) {
  const json = generateStixBundle(subject, profileData, caseData, options);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const date = new Date().toISOString().slice(0, 10);
  const name = (subject?.name || 'Report').replace(/\s+/g, '_');
  a.href = url;
  a.download = `Sentract_IOC_${name}_${date}.stix.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
