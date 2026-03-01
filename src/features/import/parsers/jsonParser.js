export function parseJSONImport(text) {
  const parsed = JSON.parse(text);

  // Auto-detect Sentract format
  if (parsed.identity || parsed.professional || parsed.digital) {
    return { type: "sentract", profiles: [parsed] };
  }

  // Array of Sentract profiles
  if (Array.isArray(parsed) && parsed.length > 0 && (parsed[0].identity || parsed[0].professional)) {
    return { type: "sentract", profiles: parsed };
  }

  // Generic array — treat as flat records
  if (Array.isArray(parsed)) {
    return { type: "generic", records: parsed };
  }

  // Single generic object
  return { type: "generic", records: [parsed] };
}

export function mapGenericToProfile(record) {
  const profile = { identity: {}, professional: {}, contact: {}, locations: { addresses: [] }, digital: { social_accounts: [] } };

  const nameFields = ["full_name", "name", "fullName", "subject_name"];
  for (const f of nameFields) {
    if (record[f]) { profile.identity.full_name = record[f]; break; }
  }

  if (record.email || record.email_address) {
    profile.contact.email_addresses = [{ type: "personal", address: record.email || record.email_address, source: "Import" }];
  }

  if (record.phone || record.phone_number) {
    profile.contact.phone_numbers = [{ type: "personal", number: record.phone || record.phone_number, source: "Import" }];
  }

  if (record.title || record.job_title) profile.professional.title = record.title || record.job_title;
  if (record.organization || record.company) profile.professional.organization = record.organization || record.company;
  if (record.city || record.state || record.address) {
    profile.locations.addresses.push({
      type: "home",
      street: record.address || "",
      city: record.city || "",
      state: record.state || "",
      zip: record.zip || "",
      country: record.country || "US",
      source: "Import",
      confidence: "unverified",
    });
  }

  return profile;
}
