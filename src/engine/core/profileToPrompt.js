import { analyzeCredentialRisk } from '../enrichment/passwordAnalysis';

export function profileToPromptText(profileData) {
  if (!profileData) return '';
  const sections = [];
  const p = profileData;

  // Identity
  if (p.identity?.full_name) {
    sections.push(`SUBJECT: ${p.identity.full_name}`);
    if (p.identity.aliases?.length) sections.push(`Aliases: ${p.identity.aliases.join(', ')}`);
    if (p.identity.age) sections.push(`Age: ${p.identity.age}`);
    if (p.identity.date_of_birth) sections.push(`DOB: ${p.identity.date_of_birth}`);
    if (p.identity.nationality) sections.push(`Nationality: ${p.identity.nationality}`);
  }

  // Professional
  if (p.professional?.title || p.professional?.organization) {
    sections.push('\nPROFESSIONAL:');
    if (p.professional.title) sections.push(`Role: ${p.professional.title}`);
    if (p.professional.organization) sections.push(`Organization: ${p.professional.organization}`);
    if (p.professional.organization_type) sections.push(`Org Type: ${p.professional.organization_type}`);
    if (p.professional.industry) sections.push(`Industry: ${p.professional.industry}`);
    if (p.professional.annual_revenue) sections.push(`Organization Revenue: ${p.professional.annual_revenue}`);
    p.professional.education?.forEach((e) => {
      sections.push(`Education: ${e.degree} — ${e.institution} (${e.year})`);
    });
  }

  // Locations
  if (p.locations?.addresses?.length) {
    sections.push('\nKNOWN LOCATIONS:');
    p.locations.addresses.forEach((a) => {
      const parts = [a.street, a.city, a.state, a.zip, a.country].filter(Boolean).join(', ');
      sections.push(`- ${(a.type || 'unknown').toUpperCase()}: ${parts} (Source: ${a.source || 'Unknown'}, Confidence: ${a.confidence || 'unverified'})`);
      if (a.coordinates) {
        sections.push(`  Coordinates: ${a.coordinates[1]}, ${a.coordinates[0]} (geocoded, confidence: ${a.geocode_confidence || 'unknown'})`);
      }
    });
  }

  // Contact
  if (p.contact?.phone_numbers?.length || p.contact?.email_addresses?.length) {
    sections.push('\nCONTACT INFORMATION:');
    p.contact.phone_numbers?.forEach((ph) => {
      sections.push(`- Phone (${ph.type}): ${ph.number}`);
    });
    p.contact.email_addresses?.forEach((em) => {
      sections.push(`- Email (${em.type}): ${em.address}`);
    });
  }

  // Digital Footprint
  if (p.digital?.social_accounts?.length) {
    sections.push('\nSOCIAL MEDIA ACCOUNTS:');
    p.digital.social_accounts.forEach((sa) => {
      sections.push(`- ${sa.platform}: ${sa.handle || sa.url} (Visibility: ${sa.visibility}, Followers: ${sa.followers || 'unknown'})${sa.notes ? ' — ' + sa.notes : ''}`);
    });
  }

  if (p.digital?.data_broker_listings?.length) {
    sections.push('\nDATA BROKER LISTINGS:');
    p.digital.data_broker_listings.forEach((db) => {
      sections.push(`- ${db.broker}: ${(db.status || 'unknown').toUpperCase()} — Data exposed: ${db.data_exposed || 'standard PII'}`);
    });
  }

  // Breaches
  if (p.breaches?.records?.length) {
    sections.push('\nBREACH EXPOSURE:');
    p.breaches.records.forEach((b) => {
      sections.push(`- ${b.breach_name}: Email ${b.email_exposed || 'unknown'}, Exposed: ${b.data_types?.join(', ') || 'unknown'} (Severity: ${b.severity || 'unknown'})`);
    });
  }

  // Credential Risk Analysis
  const credRisk = analyzeCredentialRisk(profileData);
  if (credRisk && credRisk.findings.length > 0) {
    sections.push('\nCREDENTIAL RISK ANALYSIS:');
    credRisk.findings.forEach((f) => {
      sections.push(`- [${f.severity.toUpperCase()}] ${f.title}: ${f.detail}`);
    });
  }

  // Network
  if (p.network?.family_members?.length) {
    sections.push('\nFAMILY MEMBERS:');
    p.network.family_members.forEach((fm) => {
      sections.push(`- ${fm.name} (${fm.relationship}, age ${fm.age || 'unknown'}): ${fm.occupation || ''}${fm.notes ? ' — ' + fm.notes : ''}`);
    });
  }

  if (p.network?.associates?.length) {
    sections.push('\nASSOCIATES:');
    p.network.associates.forEach((a) => {
      sections.push(`- ${a.name}: ${a.relationship}. Shared data: ${a.shared_data_points?.join(', ') || 'none'}`);
    });
  }

  // Public Records
  const pr = p.public_records || {};
  if (pr.properties?.length || pr.corporate_filings?.length || pr.court_records?.length || pr.political_donations?.length) {
    sections.push('\nPUBLIC RECORDS:');
    pr.properties?.forEach((prop) => sections.push(`- Property: ${prop.address} (${prop.type}, Value: ${prop.value || 'unknown'})`));
    pr.corporate_filings?.forEach((cf) => sections.push(`- Corporate: ${cf.entity} — Role: ${cf.role}`));
    pr.court_records?.forEach((cr) => sections.push(`- Court: ${cr.type} — ${cr.summary}`));
    pr.political_donations?.forEach((pd) => sections.push(`- Donation: ${pd.amount} to ${pd.recipient} (${pd.date})`));
  }

  // Behavioral
  if (p.behavioral?.routines?.length || p.behavioral?.travel_patterns?.length || p.behavioral?.observations?.length) {
    sections.push('\nBEHAVIORAL PATTERNS:');
    p.behavioral.routines?.forEach((r) => {
      sections.push(`- Routine: "${r.name}" — ${r.description || ''}. Schedule: ${r.schedule || 'unknown'}, Consistency: ${r.consistency != null ? Math.round(r.consistency * 100) + '%' : 'unknown'}. Source: ${r.data_source || 'Observation'}. ${r.notes || ''}`);
    });
    p.behavioral.travel_patterns?.forEach((tp) => {
      sections.push(`- Travel: ${tp.pattern}. Frequency: ${tp.frequency || 'unknown'}. Source: ${tp.data_source || 'Observation'}.`);
    });
    p.behavioral.observations?.forEach((obs) => {
      sections.push(`- Observation: "${obs.description}". Exploitability: ${obs.exploitability || 'unknown'}. Category: ${obs.category || 'unknown'}. Source: ${obs.data_source || 'Observation'}. First observed: ${obs.first_observed || 'unknown'}. ${obs.notes || ''}`);
    });
  }

  // Notes
  if (p.notes?.general) {
    sections.push(`\nINVESTIGATOR NOTES:\n${p.notes.general}`);
  }

  return sections.join('\n');
}

export function countDataPoints(pd) {
  if (!pd) return { social: 0, brokers: 0, breaches: 0, behavioral: 0, associates: 0, records: 0, total: 0 };
  const counts = {
    social: pd.digital?.social_accounts?.length || 0,
    brokers: pd.digital?.data_broker_listings?.length || 0,
    breaches: pd.breaches?.records?.length || 0,
    behavioral: (pd.behavioral?.routines?.length || 0) + (pd.behavioral?.travel_patterns?.length || 0) + (pd.behavioral?.observations?.length || 0),
    associates: (pd.network?.family_members?.length || 0) + (pd.network?.associates?.length || 0),
    records: (pd.public_records?.properties?.length || 0) + (pd.public_records?.corporate_filings?.length || 0) + (pd.public_records?.court_records?.length || 0),
  };
  counts.total = Object.values(counts).reduce((a, b) => a + b, 0);
  return counts;
}
