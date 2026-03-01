import { hasMapboxToken } from "../../../lib/enrichment/geocoder";

export default function EnrichmentStatusLines({ profile }) {
  const emails = profile.contact?.email_addresses || [];
  const checkedEmails = emails.filter((e) => e.enrichment?.status === "checked");
  const addresses = profile.locations?.addresses || [];
  const geocodedAddrs = addresses.filter((a) => a.coordinates);
  const socials = profile.digital?.social_accounts || [];
  const verifiedSocials = socials.filter((a) => a.verified);
  const hasOrg = (profile.professional?.organization || "").length >= 3;
  const hasName = (profile.identity?.full_name || "").length > 0;
  const hasState = addresses.some((a) => a.state);

  const lines = [];

  // Breaches
  if (emails.length > 0) {
    if (checkedEmails.length === emails.length) {
      lines.push({ icon: "done", text: `Breaches checked (${checkedEmails.length} email${checkedEmails.length !== 1 ? "s" : ""})` });
    } else if (checkedEmails.length > 0) {
      lines.push({ icon: "partial", text: `Breach check: ${checkedEmails.length} of ${emails.length} emails` });
    } else {
      lines.push({ icon: "available", text: "Breach check available" });
    }
  }

  // Geocoding
  if (addresses.length > 0) {
    if (geocodedAddrs.length === addresses.length) {
      lines.push({ icon: "done", text: `Addresses geocoded (${geocodedAddrs.length} of ${addresses.length})` });
    } else if (geocodedAddrs.length > 0) {
      lines.push({ icon: "partial", text: `Geocoded: ${geocodedAddrs.length} of ${addresses.length}` });
    } else if (hasMapboxToken()) {
      lines.push({ icon: "available", text: "Geocoding available" });
    }
  }

  // Company lookup
  if (hasOrg) {
    const filings = profile.public_records?.corporate_filings || [];
    const enrichedFilings = filings.filter((f) => f.source === "OpenCorporates");
    if (enrichedFilings.length > 0) {
      lines.push({ icon: "done", text: "Company data enriched" });
    } else {
      lines.push({ icon: "available", text: "Company lookup available" });
    }
  }

  // Social verify
  if (socials.length > 0) {
    if (verifiedSocials.length === socials.length) {
      lines.push({ icon: "done", text: `Social profiles verified (${verifiedSocials.length})` });
    } else if (verifiedSocials.length > 0) {
      lines.push({ icon: "partial", text: `Social verify: ${verifiedSocials.length} of ${socials.length} done` });
    } else {
      lines.push({ icon: "available", text: "Social verification available" });
    }
  }

  // Broker check
  if (hasName && hasState) {
    const brokers = profile.digital?.data_broker_listings || [];
    const checkedBrokers = brokers.filter((b) => b.source === "Sentract broker check");
    if (checkedBrokers.length > 0) {
      lines.push({ icon: "done", text: `Broker check complete (${checkedBrokers.length} checked)` });
    } else {
      lines.push({ icon: "available", text: "Broker check available" });
    }
  }

  if (lines.length === 0) return null;

  const iconMap = {
    done: { symbol: "✓", color: "#10b981" },
    partial: { symbol: "○", color: "#888" },
    available: { symbol: "●", color: "#09BC8A" },
  };

  return (
    <>
      {lines.map((l, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <span className="text-[10px]" style={{ color: iconMap[l.icon].color }}>{iconMap[l.icon].symbol}</span>
          <span className="text-[11px]" style={{ color: "#888" }}>{l.text}</span>
        </div>
      ))}
    </>
  );
}
