import { useState } from "react";
import { geocodeAddress, hasMapboxToken } from "../../../lib/enrichment/geocoder";
import { checkEmailBreaches, hasHibpKey, isDuplicateBreach } from "../../../lib/enrichment/hibpService";
import { verifySocialProfile } from "../../../lib/enrichment/socialVerify";
import { searchCompany, getCompanyDetails } from "../../../lib/enrichment/companyLookup";
import { generateBrokerCheckUrls } from "../../../lib/enrichment/brokerCheck";

export default function useEnrichment() {
  const [enriching, setEnriching] = useState(false);

  async function runAll(profile, updateProfile) {
    const results = { geocoded: 0, breaches: 0, socials: 0, company: false, brokers: 0, errors: 0 };

    try {
      // 1. Geocode all un-geocoded addresses
      const addresses = profile.locations?.addresses || [];
      for (let i = 0; i < addresses.length; i++) {
        const addr = addresses[i];
        if (!addr.coordinates && addr.street && addr.city) {
          try {
            const result = await geocodeAddress(addr);
            if (result) {
              updateProfile((p) => {
                const addrs = [...(p.locations?.addresses || [])];
                addrs[i] = { ...addrs[i], coordinates: result.coordinates, geocode_confidence: result.confidence, formatted_address: result.formatted_address };
                return { ...p, locations: { ...p.locations, addresses: addrs } };
              });
              results.geocoded++;
            }
          } catch { results.errors++; }
        }
      }

      // 2. Check all unchecked emails for breaches
      if (hasHibpKey()) {
        const emails = profile.contact?.email_addresses || [];
        for (let i = 0; i < emails.length; i++) {
          const email = emails[i];
          if (email.address && email.enrichment?.status !== "checked") {
            try {
              const result = await checkEmailBreaches(email.address);
              if (!result.error) {
                updateProfile((p) => {
                  const next = [...(p.contact?.email_addresses || [])];
                  next[i] = { ...next[i], enrichment: { last_checked: new Date().toISOString(), breaches_found: result.found ? result.count : 0, status: "checked" } };
                  let breaches = p.breaches?.records || [];
                  if (result.found && result.breaches) {
                    for (const b of result.breaches) {
                      if (!isDuplicateBreach(breaches, b)) {
                        breaches = [...breaches, b];
                      }
                    }
                  }
                  return { ...p, contact: { ...p.contact, email_addresses: next }, breaches: { ...p.breaches, records: breaches } };
                });
                results.breaches++;
              }
            } catch { results.errors++; }
          }
        }
      }

      // 3. Verify social profiles
      const socials = profile.digital?.social_accounts || [];
      for (let i = 0; i < socials.length; i++) {
        const acct = socials[i];
        const handle = acct.url || acct.handle;
        if (handle && acct.platform && !acct.verified) {
          const platform = acct.platform.toLowerCase();
          if (platform === "github") {
            try {
              const result = await verifySocialProfile(acct.platform, handle);
              if (result && result.verified) {
                updateProfile((p) => {
                  const next = [...(p.digital?.social_accounts || [])];
                  next[i] = {
                    ...next[i],
                    verified: true,
                    verified_date: new Date().toISOString(),
                    visibility: result.visibility || next[i].visibility,
                    followers: result.followers ?? next[i].followers,
                  };
                  return { ...p, digital: { ...p.digital, social_accounts: next } };
                });
                results.socials++;
              }
            } catch { results.errors++; }
          }
        }
      }

      // 4. Company lookup
      const orgName = profile.professional?.organization;
      const existingEnrichedFilings = (profile.public_records?.corporate_filings || []).filter(f => f.source === "OpenCorporates" || f.source === "SEC EDGAR");
      if (orgName && orgName.length >= 3 && existingEnrichedFilings.length === 0) {
        try {
          const searchResult = await searchCompany(orgName);
          if (searchResult?.results?.length > 0) {
            const topMatch = searchResult.results[0];
            if (topMatch.cik) {
              const details = await getCompanyDetails(topMatch.cik);
              if (details) {
                updateProfile((p) => {
                  const filings = [...(p.public_records?.corporate_filings || [])];
                  const exists = filings.some(f => f.source === "SEC EDGAR" && f.entity === details.name);
                  if (!exists) {
                    filings.push({
                      entity: details.name,
                      role: p.professional?.title || "Associated",
                      jurisdiction: details.state || "",
                      source: "SEC EDGAR",
                      ticker: details.ticker,
                      sic_description: details.sic_description,
                      entity_type: details.entity_type,
                    });
                  }
                  return { ...p, public_records: { ...p.public_records, corporate_filings: filings } };
                });
                results.company = true;
              }
            }
          }
        } catch { results.errors++; }
      }

      // 5. Generate broker check URLs
      const fullName = profile.identity?.full_name;
      const firstState = (profile.locations?.addresses || []).find(a => a.state)?.state;
      const existingBrokerChecks = (profile.digital?.data_broker_listings || []).filter(b => b.source === "Sentract broker check");
      if (fullName && firstState && existingBrokerChecks.length === 0) {
        try {
          const links = generateBrokerCheckUrls(fullName, firstState);
          if (links.length > 0) {
            updateProfile((p) => {
              const existing = p.digital?.data_broker_listings || [];
              const newListings = [...existing];
              for (const b of links) {
                const exists = existing.some(e => e.broker?.toLowerCase() === b.name.toLowerCase());
                if (!exists) {
                  newListings.push({
                    broker: b.name,
                    status: "pending_check",
                    url: b.url,
                    data_exposed: b.notes,
                    last_checked: new Date().toISOString().split("T")[0],
                    source: "Sentract broker check",
                  });
                }
              }
              return { ...p, digital: { ...p.digital, data_broker_listings: newListings } };
            });
            results.brokers = links.length;
          }
        } catch { results.errors++; }
      }
    } catch (err) {
      console.error("runAllEnrichments error:", err);
      results.errors++;
    }

    // Build summary
    const parts = [];
    if (results.geocoded > 0) parts.push(`${results.geocoded} address${results.geocoded > 1 ? "es" : ""} geocoded`);
    if (results.breaches > 0) parts.push(`${results.breaches} email${results.breaches > 1 ? "s" : ""} checked`);
    if (results.socials > 0) parts.push(`${results.socials} social${results.socials > 1 ? "s" : ""} verified`);
    if (results.company) parts.push("company data enriched");
    if (results.brokers > 0) parts.push(`${results.brokers} broker checks queued`);
    if (results.errors > 0) parts.push(`${results.errors} failed`);

    return { total: results.geocoded + results.breaches + results.socials + (results.company ? 1 : 0) + results.brokers, summary: parts.length > 0 ? parts.join(" · ") : "No enrichments available — add data first" };
  }

  return { enriching, setEnriching, runAll };
}
