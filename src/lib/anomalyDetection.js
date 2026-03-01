export function detectAnomalies(currentProfile, previousProfile) {
  if (!currentProfile || !previousProfile) return [];
  const anomalies = [];

  // New social accounts
  const prevSocials = new Set((previousProfile.digital?.social_accounts || []).map((a) => `${a.platform}:${a.handle || a.url}`).filter(Boolean));
  for (const a of currentProfile.digital?.social_accounts || []) {
    const key = `${a.platform}:${a.handle || a.url}`;
    if (key && !prevSocials.has(key)) {
      anomalies.push({ type: "new_social", section: "digital", description: `New social account: ${a.platform} (${a.handle || a.url})`, severity: "medium" });
    }
  }

  // New breaches
  const prevBreaches = new Set((previousProfile.breaches?.records || []).map((b) => b.breach_name?.toLowerCase()).filter(Boolean));
  for (const b of currentProfile.breaches?.records || []) {
    if (b.breach_name && !prevBreaches.has(b.breach_name.toLowerCase())) {
      anomalies.push({ type: "new_breach", section: "breaches", description: `New breach detected: ${b.breach_name}`, severity: "high" });
    }
  }

  // New/removed addresses
  const prevAddresses = new Set((previousProfile.locations?.addresses || []).map((a) => [a.street, a.city, a.state].filter(Boolean).join(",").toLowerCase()));
  const currAddresses = new Set((currentProfile.locations?.addresses || []).map((a) => [a.street, a.city, a.state].filter(Boolean).join(",").toLowerCase()));
  for (const addr of currAddresses) {
    if (addr && !prevAddresses.has(addr)) {
      anomalies.push({ type: "new_address", section: "locations", description: `New address added: ${addr}`, severity: "medium" });
    }
  }
  for (const addr of prevAddresses) {
    if (addr && !currAddresses.has(addr)) {
      anomalies.push({ type: "removed_address", section: "locations", description: `Address removed: ${addr}`, severity: "low" });
    }
  }

  // New/removed phone numbers
  const prevPhones = new Set((previousProfile.contact?.phone_numbers || []).map((p) => p.number).filter(Boolean));
  const currPhones = new Set((currentProfile.contact?.phone_numbers || []).map((p) => p.number).filter(Boolean));
  for (const p of currPhones) {
    if (!prevPhones.has(p)) {
      anomalies.push({ type: "new_phone", section: "contact", description: `New phone number: ${p}`, severity: "medium" });
    }
  }
  for (const p of prevPhones) {
    if (!currPhones.has(p)) {
      anomalies.push({ type: "removed_phone", section: "contact", description: `Phone number removed: ${p}`, severity: "low" });
    }
  }

  // New/removed emails
  const prevEmails = new Set((previousProfile.contact?.email_addresses || []).map((e) => e.address?.toLowerCase()).filter(Boolean));
  const currEmails = new Set((currentProfile.contact?.email_addresses || []).map((e) => e.address?.toLowerCase()).filter(Boolean));
  for (const e of currEmails) {
    if (!prevEmails.has(e)) {
      anomalies.push({ type: "new_email", section: "contact", description: `New email address: ${e}`, severity: "medium" });
    }
  }

  // New associates/family members
  const prevPeople = new Set([
    ...(previousProfile.network?.associates || []).map((a) => a.name?.toLowerCase()),
    ...(previousProfile.network?.family_members || []).map((f) => f.name?.toLowerCase()),
  ].filter(Boolean));
  const currPeople = [
    ...(currentProfile.network?.associates || []).map((a) => ({ name: a.name, type: "associate" })),
    ...(currentProfile.network?.family_members || []).map((f) => ({ name: f.name, type: "family member" })),
  ];
  for (const person of currPeople) {
    if (person.name && !prevPeople.has(person.name.toLowerCase())) {
      anomalies.push({ type: "new_person", section: "network", description: `New ${person.type}: ${person.name}`, severity: "medium" });
    }
  }

  // Data broker status changes
  const prevBrokers = {};
  for (const b of previousProfile.digital?.data_broker_listings || []) {
    if (b.broker) prevBrokers[b.broker.toLowerCase()] = b.status;
  }
  for (const b of currentProfile.digital?.data_broker_listings || []) {
    if (b.broker) {
      const prevStatus = prevBrokers[b.broker.toLowerCase()];
      if (prevStatus && prevStatus !== b.status) {
        anomalies.push({
          type: "broker_status_change",
          section: "digital",
          description: `${b.broker} status changed: ${prevStatus} → ${b.status}`,
          severity: b.status === "active" ? "high" : "low",
        });
      }
    }
  }

  return anomalies;
}
