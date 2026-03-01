import { useMemo, useState } from "react";
import { Shield, ChevronDown, ChevronRight } from "lucide-react";
import { SEVERITY_COLORS } from "../utils";

export function generateKeyExposures(profileData) {
  const exposures = [];

  // Public social accounts with high followers
  const socials = profileData.digital?.social_accounts || [];
  for (const acct of socials) {
    if (acct.visibility === "public" && acct.followers && acct.followers > 1000) {
      exposures.push({
        text: `Public ${acct.platform || "social"} account with ${acct.followers.toLocaleString()} followers`,
        severity: "red",
        category: "digital",
      });
    } else if (acct.visibility === "public" && acct.platform) {
      exposures.push({
        text: `Public ${acct.platform} profile discoverable via OSINT`,
        severity: "amber",
        category: "digital",
      });
    }
  }

  // Active broker listings
  const brokers = profileData.digital?.data_broker_listings || [];
  const activeBrokers = brokers.filter((b) => b.status === "active");
  if (activeBrokers.length > 0) {
    exposures.push({
      text: `${activeBrokers.length} active data broker listing${activeBrokers.length > 1 ? "s" : ""} exposing PII`,
      severity: "red",
      category: "digital",
    });
  }

  // High-severity breaches
  const breaches = profileData.breaches?.records || [];
  const highBreaches = breaches.filter((b) => b.severity === "high" || b.severity === "critical");
  if (highBreaches.length > 0) {
    exposures.push({
      text: `${highBreaches.length} high-severity breach${highBreaches.length > 1 ? "es" : ""} (${highBreaches.map((b) => b.breach_name).filter(Boolean).join(", ") || "unnamed"})`,
      severity: "red",
      category: "breaches",
    });
  } else if (breaches.length > 0) {
    exposures.push({
      text: `${breaches.length} breach record${breaches.length > 1 ? "s" : ""} on file`,
      severity: "amber",
      category: "breaches",
    });
  }

  // Routines with high consistency
  const routines = profileData.behavioral?.routines || [];
  const predictable = routines.filter((r) => r.consistency != null && (r.consistency > 0.8 || r.consistency > 80));
  if (predictable.length > 0) {
    exposures.push({
      text: `${predictable.length} highly predictable routine${predictable.length > 1 ? "s" : ""} (>${Math.round((predictable[0].consistency > 1 ? predictable[0].consistency : predictable[0].consistency * 100))}% consistency)`,
      severity: "amber",
      category: "behavioral",
    });
  }

  // High-exploitability observations (Phase 2)
  const observations = profileData.behavioral?.observations || [];
  const highExploit = observations.filter((o) => o.exploitability === "high");
  if (highExploit.length > 0) {
    exposures.push({
      text: `${highExploit.length} high-exploitability observation${highExploit.length > 1 ? "s" : ""} recorded`,
      severity: "red",
      category: "behavioral",
    });
  } else if (observations.length > 0) {
    exposures.push({
      text: `${observations.length} behavioral observation${observations.length > 1 ? "s" : ""} documented`,
      severity: "amber",
      category: "behavioral",
    });
  }

  // No corporate filings shielding
  const filings = profileData.public_records?.corporate_filings || [];
  const properties = profileData.public_records?.properties || [];
  if (filings.length === 0 && properties.length > 0) {
    exposures.push({
      text: "Properties held without corporate filing shield",
      severity: "amber",
      category: "records",
    });
  }

  // Exposed family members
  const family = profileData.network?.family_members || [];
  if (family.length > 0) {
    const withSocial = family.filter((f) => f.social_media && f.social_media.length > 0);
    if (withSocial.length > 0) {
      exposures.push({
        text: `${withSocial.length} family member${withSocial.length > 1 ? "s" : ""} with exposed social media`,
        severity: "red",
        category: "network",
      });
    } else {
      exposures.push({
        text: `${family.length} family member${family.length > 1 ? "s" : ""} identified — potential leverage points`,
        severity: "blue",
        category: "network",
      });
    }
  }

  return exposures;
}

export default function KeyExposures({ profile }) {
  const exposures = useMemo(() => generateKeyExposures(profile), [profile]);
  const [collapsed, setCollapsed] = useState(false);

  if (exposures.length === 0) return null;

  return (
    <div className="flex-1 min-w-0">
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center gap-2 cursor-pointer"
        style={{ background: "transparent", border: "none" }}
      >
        <Shield size={14} color="#f59e0b" />
        <span className="text-[13px] text-white font-medium">Key Exposures</span>
        <span className="text-[11px] font-mono ml-1" style={{ color: "#555" }}>({exposures.length})</span>
        <div className="flex-1" />
        {collapsed ? <ChevronRight size={13} color="#555" /> : <ChevronDown size={13} color="#555" />}
      </button>
      {!collapsed && (
        <div className="mt-3 space-y-1.5 fade-in">
          {exposures.map((exp, i) => (
            <div key={i} className="flex items-center gap-2.5 px-2 py-1.5 rounded" style={{ background: "#0d0d0d" }}>
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ background: SEVERITY_COLORS[exp.severity] || "#666" }}
              />
              <span className="text-[12px]" style={{ color: "#ccc" }}>{exp.text}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
