export function calculateFreshness(updatedAt) {
  if (!updatedAt) return { status: "stale", daysSince: 999, color: "#ef4444" };
  const days = Math.floor((Date.now() - new Date(updatedAt).getTime()) / (1000 * 60 * 60 * 24));
  if (days < 30) return { status: "fresh", daysSince: days, color: "#09BC8A" };
  if (days < 90) return { status: "aging", daysSince: days, color: "#f59e0b" };
  return { status: "stale", daysSince: days, color: "#ef4444" };
}

const SECTION_KEYS = ["identity", "professional", "locations", "contact", "digital", "breaches", "network", "public_records", "behavioral", "notes"];

export function getProfileFreshness(profileData, subjectUpdatedAt) {
  const result = {};
  for (const key of SECTION_KEYS) {
    const section = profileData?.[key];
    // Check for enrichment timestamps within the section
    let sectionTimestamp = null;
    if (key === "breaches" && section?.records) {
      for (const r of section.records) {
        if (r.enrichment?.last_checked) {
          const t = new Date(r.enrichment.last_checked).getTime();
          if (!sectionTimestamp || t > sectionTimestamp) sectionTimestamp = t;
        }
      }
    }
    if (key === "digital" && section?.social_accounts) {
      for (const a of section.social_accounts) {
        if (a.last_checked) {
          const t = new Date(a.last_checked).getTime();
          if (!sectionTimestamp || t > sectionTimestamp) sectionTimestamp = t;
        }
      }
    }
    if (key === "contact") {
      for (const email of section?.email_addresses || []) {
        if (email.enrichment?.last_checked) {
          const t = new Date(email.enrichment.last_checked).getTime();
          if (!sectionTimestamp || t > sectionTimestamp) sectionTimestamp = t;
        }
      }
    }
    const ts = sectionTimestamp ? new Date(sectionTimestamp).toISOString() : subjectUpdatedAt;
    result[key] = calculateFreshness(ts);
  }
  return result;
}
