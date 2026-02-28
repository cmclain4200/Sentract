import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useOutletContext } from "react-router-dom";
import { Upload, X, Plus, Trash2, FileText, Check, AlertCircle, ChevronDown, ChevronRight, Shield, Search, Mail, MapPin, Building2, ExternalLink, CheckCircle, XCircle, HelpCircle, Zap } from "lucide-react";
import SectionHeader from "../components/common/SectionHeader";
import { supabase } from "../lib/supabase";
import { EMPTY_PROFILE, ADDRESS_TYPES, PHONE_TYPES, EMAIL_TYPES, CONFIDENCE_LEVELS, VISIBILITY_OPTIONS, SEVERITY_LEVELS, RELATIONSHIP_TYPES, BROKER_STATUSES, SOCIAL_PLATFORMS } from "../lib/profileSchema";
import { calculateCompleteness } from "../lib/profileCompleteness";
import { extractTextFromFile, isAcceptedFile } from "../lib/fileExtractor";
import { extractProfileFromText, buildExtractionSummary, mergeExtractedIntoProfile } from "../lib/profileExtractor";
import { analyzeEmailDomain, calculateAge, formatAddress } from "../lib/enrichment/autoEnrich";
import { checkEmailBreaches, checkMultipleEmails, hasHibpKey, isDuplicateBreach } from "../lib/enrichment/hibpService";
import { geocodeAddress, hasMapboxToken } from "../lib/enrichment/geocoder";
import { analyzeCredentialRisk } from "../lib/enrichment/passwordAnalysis";
import { searchCompany, getCompanyDetails } from "../lib/enrichment/companyLookup";
import { verifySocialProfile } from "../lib/enrichment/socialVerify";
import { generateBrokerCheckUrls } from "../lib/enrichment/brokerCheck";
import { syncRelationships } from "../lib/relationshipSync";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "../components/Toast";

const TABS = [
  { key: "identity", label: "Identity" },
  { key: "professional", label: "Professional" },
  { key: "locations", label: "Locations & Contact" },
  { key: "digital", label: "Digital Footprint" },
  { key: "breaches", label: "Breaches" },
  { key: "network", label: "Network" },
  { key: "public_records", label: "Public Records" },
  { key: "behavioral", label: "Behavioral" },
  { key: "notes", label: "Notes" },
];

// ── Key Exposures Generator ──

function generateKeyExposures(profileData) {
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

const SEVERITY_COLORS = {
  red: "#ef4444",
  amber: "#f59e0b",
  blue: "#3b82f6",
};

// ── Enrichment Status Lines ──

function EnrichmentStatusLines({ profile }) {
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

// ── Run All Automatic Enrichments ──

async function runAllEnrichments(profile, updateProfile) {
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

    // 3. Verify social profiles (auto-verifiable platforms only)
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

    // 4. Company lookup (if org name filled and no existing enriched filings)
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

    // 5. Generate broker check URLs (if name + state available and none exist)
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
  const total = results.geocoded + results.breaches + results.socials + (results.company ? 1 : 0) + results.brokers;

  return { total, summary: parts.length > 0 ? parts.join(" · ") : "No enrichments available — add data first" };
}

export default function Profile() {
  const { subject, refreshSubject } = useOutletContext();
  const { user } = useAuth();
  const { showToast, ToastContainer } = useToast();
  const [profile, setProfile] = useState(() => {
    const base = JSON.parse(JSON.stringify(EMPTY_PROFILE));
    if (subject?.profile_data && Object.keys(subject.profile_data).length > 0) {
      return deepMerge(base, subject.profile_data);
    }
    return base;
  });
  const [activeTab, setActiveTab] = useState("identity");
  const [saveStatus, setSaveStatus] = useState("idle"); // idle | saving | saved | error
  const [aiFields, setAiFields] = useState(new Set());
  const [uploadState, setUploadState] = useState("idle"); // idle | extracting | review | error
  const [uploadError, setUploadError] = useState(null);
  const [extractionResult, setExtractionResult] = useState(null);
  const [showUpload, setShowUpload] = useState(true);
  const [dragOver, setDragOver] = useState(false);
  const [exposuresCollapsed, setExposuresCollapsed] = useState(false);
  const [showBatchEnrich, setShowBatchEnrich] = useState(false);
  const [enriching, setEnriching] = useState(false);
  const saveTimeout = useRef(null);
  const latestProfile = useRef(profile);
  const fileInputRef = useRef(null);
  const prevSyncData = useRef(null);

  // Reset all state when subject changes
  useEffect(() => {
    const base = JSON.parse(JSON.stringify(EMPTY_PROFILE));
    if (subject?.profile_data && Object.keys(subject.profile_data).length > 0) {
      setProfile(deepMerge(base, subject.profile_data));
    } else {
      setProfile(base);
    }
    setSaveStatus("idle");
    setAiFields(new Set());
    setUploadState("idle");
    setUploadError(null);
    setExtractionResult(null);
    setShowUpload(true);
    setExposuresCollapsed(false);
    setShowBatchEnrich(false);
  }, [subject?.id]);

  const completeness = calculateCompleteness(profile);
  const exposures = useMemo(() => generateKeyExposures(profile), [profile]);

  // Keep ref in sync so beforeunload can access latest data
  useEffect(() => { latestProfile.current = profile; }, [profile]);

  // Flush pending save on page unload or component unmount
  useEffect(() => {
    const flushSave = () => {
      if (saveTimeout.current && subject?.id) {
        clearTimeout(saveTimeout.current);
        saveTimeout.current = null;
        const comp = calculateCompleteness(latestProfile.current);
        supabase
          .from("subjects")
          .update({ profile_data: latestProfile.current, data_completeness: comp.score })
          .eq("id", subject.id)
          .then(() => {});
      }
    };
    const handleBeforeUnload = () => flushSave();
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      flushSave();
    };
  }, [subject?.id]);

  const emailCount = (profile.contact?.email_addresses || []).filter((e) => e.address).length;

  // Auto-save with debounce
  const autoSave = useCallback(
    (data) => {
      if (!subject?.id) return;
      if (saveTimeout.current) clearTimeout(saveTimeout.current);
      setSaveStatus("saving");
      saveTimeout.current = setTimeout(async () => {
        const comp = calculateCompleteness(data);
        const { error } = await supabase
          .from("subjects")
          .update({
            profile_data: data,
            data_completeness: comp.score,
          })
          .eq("id", subject.id);
        if (error) {
          setSaveStatus("error");
        } else {
          setSaveStatus("saved");
          setTimeout(() => setSaveStatus("idle"), 2000);

          // Check if network or professional fields changed — fire sync if so
          const syncKey = JSON.stringify({
            network: data.network,
            professional: data.professional,
            name: data.identity?.full_name,
          });
          if (prevSyncData.current !== syncKey) {
            prevSyncData.current = syncKey;
            if (user?.id) {
              syncRelationships({ ...subject, profile_data: data }, user.id).then((result) => {
                if (result.updated) showToast(result.details);
              });
            }
          }
        }
      }, 1500);
    },
    [subject?.id, user?.id, showToast]
  );

  function updateProfile(updater) {
    setProfile((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      autoSave(next);
      return next;
    });
  }

  // Immediate save
  async function handleSaveNow() {
    if (!subject?.id) return;
    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    setSaveStatus("saving");
    const comp = calculateCompleteness(profile);
    const { error } = await supabase
      .from("subjects")
      .update({
        profile_data: profile,
        data_completeness: comp.score,
      })
      .eq("id", subject.id);
    if (error) {
      setSaveStatus("error");
    } else {
      setSaveStatus("saved");
      if (refreshSubject) refreshSubject();
      setTimeout(() => setSaveStatus("idle"), 2000);
    }
  }

  // File upload handler
  async function handleFileUpload(file) {
    if (!isAcceptedFile(file.name)) {
      setUploadError("Unsupported file type. Accepted: PDF, DOCX, TXT, CSV, MD");
      setUploadState("error");
      return;
    }

    setUploadState("extracting");
    setUploadError(null);

    try {
      const text = await extractTextFromFile(file);
      const extracted = await extractProfileFromText(text);
      const summary = buildExtractionSummary(extracted);
      setExtractionResult({ extracted, summary, fileName: file.name });
      setUploadState("review");
    } catch (err) {
      setUploadError(err.message);
      setUploadState("error");
    }
  }

  function handleApplyExtraction() {
    if (!extractionResult) return;
    const { merged, aiFields: newAiFields } = mergeExtractedIntoProfile(
      profile,
      extractionResult.extracted
    );
    setProfile(merged);
    setAiFields(newAiFields);
    autoSave(merged);
    setUploadState("idle");
    setExtractionResult(null);
    setActiveTab("identity");
  }

  function handleDiscardExtraction() {
    setUploadState("idle");
    setExtractionResult(null);
  }

  function onDrop(e) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer?.files?.[0];
    if (file) handleFileUpload(file);
  }

  function onDragOver(e) {
    e.preventDefault();
    setDragOver(true);
  }

  function onDragLeave() {
    setDragOver(false);
  }

  if (!subject) {
    return (
      <div className="p-8 fade-in">
        <SectionHeader label="Subject Profile" title="Profile" />
        <div className="surface p-6 text-center">
          <p className="text-sm" style={{ color: "#666" }}>
            No subject selected. Create a subject to start building a profile.
          </p>
        </div>
      </div>
    );
  }

  const compColor = completeness.score >= 70 ? "#10b981" : completeness.score >= 40 ? "#f59e0b" : "#ef4444";

  return (
    <div className="p-8 fade-in">
      {/* Header: Name + Completeness + Save — single row */}
      <div className="flex items-start justify-between mb-6">
        <SectionHeader label="Subject Profile" title={profile.identity?.full_name || subject.name || "Profile"} />
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-semibold" style={{ color: compColor }}>{completeness.score}%</span>
            <div className="w-24 h-1.5 rounded-full" style={{ background: "#1a1a1a" }}>
              <div className="h-full rounded-full bar-transition" style={{ width: `${completeness.score}%`, background: compColor }} />
            </div>
          </div>
          {saveStatus === "saving" && (
            <span className="text-[12px] font-mono" style={{ color: "#555" }}>Saving...</span>
          )}
          {saveStatus === "saved" && (
            <span className="text-[12px] font-mono flex items-center gap-1" style={{ color: "#09BC8A" }}>
              <Check size={12} /> Saved
            </span>
          )}
          {saveStatus === "error" && (
            <span className="text-[12px] font-mono" style={{ color: "#ef4444" }}>Save failed</span>
          )}
          <button
            onClick={handleSaveNow}
            className="px-4 py-2 rounded text-sm font-semibold cursor-pointer"
            style={{ background: "#09BC8A", color: "#0a0a0a", border: "none" }}
          >
            Save Changes
          </button>
        </div>
      </div>

      {/* Key Exposures + Enrichment Panel */}
      {(exposures.length > 0 || emailCount > 0 || (profile.locations?.addresses || []).length > 0 || (profile.digital?.social_accounts || []).length > 0) && (
        <div className="surface p-4 mb-6">
          <div className="flex items-start gap-6">
            {/* Exposures side */}
            {exposures.length > 0 && (
              <div className="flex-1 min-w-0">
                <button
                  onClick={() => setExposuresCollapsed(!exposuresCollapsed)}
                  className="w-full flex items-center gap-2 cursor-pointer"
                  style={{ background: "transparent", border: "none" }}
                >
                  <Shield size={14} color="#f59e0b" />
                  <span className="text-[13px] text-white font-medium">Key Exposures</span>
                  <span className="text-[11px] font-mono ml-1" style={{ color: "#555" }}>({exposures.length})</span>
                  <div className="flex-1" />
                  {exposuresCollapsed ? <ChevronRight size={13} color="#555" /> : <ChevronDown size={13} color="#555" />}
                </button>
                {!exposuresCollapsed && (
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
            )}
            {/* Enrichment Status side */}
            <div className="shrink-0 flex flex-col items-end gap-1" style={{ borderLeft: exposures.length > 0 ? "1px solid #1e1e1e" : "none", paddingLeft: exposures.length > 0 ? 24 : 0 }}>
              <span className="text-[10px] font-mono mb-1" style={{ color: "#555" }}>ENRICHMENT STATUS</span>
              <EnrichmentStatusLines profile={profile} />
              <div className="flex gap-2 mt-2">
                {emailCount > 0 && (
                  <button
                    onClick={() => setShowBatchEnrich(true)}
                    className="flex items-center gap-1.5 text-[11px] font-mono px-3 py-1.5 rounded cursor-pointer transition-all"
                    style={{ background: "transparent", border: "1px solid #2a2a2a", color: "#09BC8A" }}
                  >
                    <Search size={11} /> Check Breaches
                  </button>
                )}
                <button
                  onClick={async () => {
                    if (enriching) return;
                    setEnriching(true);
                    try {
                      const result = await runAllEnrichments(profile, updateProfile);
                      showToast(result.summary);
                    } catch {
                      showToast("Enrichment failed");
                    } finally {
                      setEnriching(false);
                    }
                  }}
                  disabled={enriching}
                  className="flex items-center gap-1.5 text-[11px] font-mono px-3 py-1.5 rounded cursor-pointer transition-all"
                  style={{ background: "transparent", border: "1px solid #2a2a2a", color: enriching ? "#555" : "#09BC8A" }}
                >
                  {enriching ? (
                    <><span className="generating-spinner" style={{ width: 10, height: 10, borderWidth: 1.5 }} /> Running...</>
                  ) : (
                    <><Zap size={11} /> Run All</>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Upload Bar */}
      {showUpload && (
        <div className="surface p-4 mb-6">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <FileText size={14} color="#09BC8A" />
              <span className="text-[13px] text-white font-medium">
                Have an existing report? Upload to auto-fill
              </span>
            </div>
            <button
              onClick={() => setShowUpload(false)}
              className="cursor-pointer"
              style={{ background: "transparent", border: "none" }}
            >
              <X size={14} color="#555" />
            </button>
          </div>

          {uploadState === "idle" && (
            <div
              className={`drop-zone ${dragOver ? "drag-over" : ""}`}
              onDrop={onDrop}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload size={20} color="#555" className="mx-auto mb-2" />
              <div className="text-sm" style={{ color: "#888" }}>
                Drag & drop a PDF, Word doc, or text file here
              </div>
              <div className="text-[11px] mt-1" style={{ color: "#444" }}>
                or click to browse
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.docx,.txt,.csv,.md"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFileUpload(file);
                  e.target.value = "";
                }}
              />
            </div>
          )}

          {uploadState === "extracting" && (
            <div className="text-center py-6">
              <div className="flex items-center gap-2 justify-center mb-2">
                <span className="pulse-dot" />
                <span className="pulse-dot" />
                <span className="pulse-dot" />
              </div>
              <div className="text-sm" style={{ color: "#888" }}>
                Extracting intelligence from report...
              </div>
            </div>
          )}

          {uploadState === "error" && (
            <div className="p-4 rounded" style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}>
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle size={14} color="#ef4444" />
                <span className="text-sm font-medium" style={{ color: "#ef4444" }}>Extraction failed</span>
              </div>
              <div className="text-[12px]" style={{ color: "#888" }}>{uploadError}</div>
              <button
                onClick={() => setUploadState("idle")}
                className="mt-3 text-[12px] cursor-pointer"
                style={{ background: "transparent", border: "none", color: "#09BC8A" }}
              >
                Try again
              </button>
            </div>
          )}

          {uploadState === "review" && extractionResult && (
            <div className="p-4 rounded" style={{ background: "#0d0d0d", border: "1px solid #1a1a1a" }}>
              <div className="flex items-center gap-2 mb-3">
                <Check size={14} color="#09BC8A" />
                <span className="text-sm font-medium text-white">Extraction Complete</span>
              </div>
              <div className="text-[12px] mb-3" style={{ color: "#888" }}>
                From: <span style={{ color: "#ccc" }}>{extractionResult.fileName}</span>
              </div>
              <div className="text-[12px] mb-4" style={{ color: "#888" }}>
                Found: {extractionResult.summary.counts.join(" · ")}
              </div>
              <div className="text-[11px] mb-4" style={{ color: "#555" }}>
                All extracted data will be highlighted. Please review for accuracy before saving.
              </div>
              <div className="flex gap-3">
                <button
                  onClick={handleApplyExtraction}
                  className="px-4 py-2 rounded text-sm font-semibold cursor-pointer"
                  style={{ background: "#09BC8A", color: "#0a0a0a", border: "none" }}
                >
                  Review & Edit Profile
                </button>
                <button
                  onClick={handleDiscardExtraction}
                  className="px-4 py-2 rounded text-sm cursor-pointer"
                  style={{ background: "transparent", border: "1px solid #333", color: "#888" }}
                >
                  Discard
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab Bar */}
      <div className="profile-tabs mb-6">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            className={`profile-tab ${activeTab === tab.key ? "active" : ""}`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Batch Enrichment Modal */}
      {showBatchEnrich && (
        <BatchEnrichModal
          profile={profile}
          update={updateProfile}
          onClose={() => setShowBatchEnrich(false)}
        />
      )}

      {/* Tab Content */}
      <div className="tab-content">
        {activeTab === "identity" && <IdentitySection profile={profile} update={updateProfile} aiFields={aiFields} />}
        {activeTab === "professional" && <ProfessionalSection profile={profile} update={updateProfile} aiFields={aiFields} />}
        {activeTab === "locations" && <LocationsSection profile={profile} update={updateProfile} aiFields={aiFields} />}
        {activeTab === "digital" && <DigitalSection profile={profile} update={updateProfile} aiFields={aiFields} />}
        {activeTab === "breaches" && <BreachesSection profile={profile} update={updateProfile} aiFields={aiFields} />}
        {activeTab === "network" && <NetworkSection profile={profile} update={updateProfile} aiFields={aiFields} />}
        {activeTab === "public_records" && <PublicRecordsSection profile={profile} update={updateProfile} aiFields={aiFields} />}
        {activeTab === "behavioral" && <BehavioralSection profile={profile} update={updateProfile} aiFields={aiFields} />}
        {activeTab === "notes" && <NotesSection profile={profile} update={updateProfile} />}
      </div>
      <ToastContainer />
    </div>
  );
}

// ── Helper Components ──

function SourceTag({ source }) {
  if (!source) return null;
  return <span className="source-tag">{source}</span>;
}

function FormField({ label, children, className = "" }) {
  return (
    <div className={className}>
      <label className="sub-label block mb-1.5">{label}</label>
      {children}
    </div>
  );
}

function RemoveBtn({ onClick }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1 text-[11px] cursor-pointer"
      style={{ background: "transparent", border: "none", color: "#555" }}
      onMouseEnter={(e) => (e.currentTarget.style.color = "#ef4444")}
      onMouseLeave={(e) => (e.currentTarget.style.color = "#555")}
    >
      <Trash2 size={11} /> Remove
    </button>
  );
}

function AddBtn({ label, onClick }) {
  return (
    <button className="add-entry-btn" onClick={onClick}>
      <Plus size={13} className="inline mr-1" style={{ verticalAlign: "-2px" }} />
      {label}
    </button>
  );
}

function SelectField({ value, onChange, options, placeholder }) {
  return (
    <select className="form-select" value={value} onChange={(e) => onChange(e.target.value)}>
      {placeholder && <option value="">{placeholder}</option>}
      {options.map((o) => (
        <option key={o} value={o}>{o.charAt(0).toUpperCase() + o.slice(1).replace(/_/g, " ")}</option>
      ))}
    </select>
  );
}

// ── Section: Identity ──

function IdentitySection({ profile, update, aiFields }) {
  const id = profile.identity || {};
  const [ageAutoCalc, setAgeAutoCalc] = useState(false);

  function set(field, value) {
    update((p) => ({ ...p, identity: { ...p.identity, [field]: value } }));
  }

  function handleDobChange(dob) {
    const computed = calculateAge(dob);
    if (computed != null) {
      update((p) => ({ ...p, identity: { ...p.identity, date_of_birth: dob, age: computed } }));
      setAgeAutoCalc(true);
    } else {
      set("date_of_birth", dob);
      setAgeAutoCalc(false);
    }
  }

  return (
    <div className="surface p-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField label="Full Name *" className="md:col-span-2">
          <input className="form-input" value={id.full_name || ""} onChange={(e) => set("full_name", e.target.value)} placeholder="e.g., Jonathan R. Mercer" />
        </FormField>

        <FormField label="Aliases" className="md:col-span-2">
          {(id.aliases || []).map((alias, i) => (
            <div key={i} className="flex gap-2 mb-2">
              <input
                className="form-input"
                value={alias}
                onChange={(e) => {
                  const next = [...(id.aliases || [])];
                  next[i] = e.target.value;
                  set("aliases", next);
                }}
              />
              <button
                onClick={() => set("aliases", id.aliases.filter((_, j) => j !== i))}
                className="px-2 cursor-pointer"
                style={{ background: "transparent", border: "none", color: "#555" }}
              >
                <X size={14} />
              </button>
            </div>
          ))}
          <AddBtn label="Add Alias" onClick={() => set("aliases", [...(id.aliases || []), ""])} />
        </FormField>

        <FormField label="Date of Birth">
          <input className="form-input" type="text" value={id.date_of_birth || ""} onChange={(e) => handleDobChange(e.target.value)} placeholder="YYYY-MM-DD or ~YYYY" />
        </FormField>
        <FormField label="Age">
          <input className="form-input" type="number" value={id.age || ""} onChange={(e) => { set("age", e.target.value ? parseInt(e.target.value) : null); setAgeAutoCalc(false); }} />
          {ageAutoCalc && id.age != null && (
            <span className="text-[10px] font-mono mt-1 block" style={{ color: "#555" }}>Auto-calculated from DOB</span>
          )}
        </FormField>
        <FormField label="Nationality">
          <input className="form-input" value={id.nationality || ""} onChange={(e) => set("nationality", e.target.value)} />
        </FormField>
        <FormField label="Gender">
          <SelectField value={id.gender || ""} onChange={(v) => set("gender", v)} options={["male", "female", "other"]} placeholder="Select..." />
        </FormField>
      </div>
    </div>
  );
}

// ── Company Lookup Panel ──

function CompanyLookupPanel({ onSelect }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingDetails, setLoadingDetails] = useState(null);

  async function handleSearch() {
    if (!query || query.length < 3) return;
    setLoading(true);
    const res = await searchCompany(query);
    setResults(res);
    setLoading(false);
  }

  async function handleSelect(company) {
    if (company.cik) {
      setLoadingDetails(company.cik);
      const details = await getCompanyDetails(company.cik);
      setLoadingDetails(null);
      onSelect(details || company);
    } else {
      onSelect(company);
    }
  }

  return (
    <div className="mt-3 p-3 rounded fade-in" style={{ background: "#0a0a0a", border: "1px solid #1a1a1a" }}>
      <div className="text-[10px] font-mono tracking-wider mb-2" style={{ color: "#09BC8A" }}>COMPANY LOOKUP</div>
      <div className="flex gap-2 mb-3">
        <input className="form-input flex-1" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Company name..." onKeyDown={(e) => e.key === "Enter" && handleSearch()} />
        <button onClick={handleSearch} disabled={loading} className="px-3 py-1.5 rounded text-[11px] font-mono cursor-pointer" style={{ background: "transparent", border: "1px solid #2a2a2a", color: "#09BC8A" }}>
          {loading ? "..." : "Search"}
        </button>
      </div>
      {results?.error && <div className="text-[11px]" style={{ color: "#ef4444" }}>Lookup failed: {results.message}</div>}
      {results?.results && results.results.length === 0 && <div className="text-[11px]" style={{ color: "#666" }}>No companies found.</div>}
      {results?.results && results.results.length > 0 && (
        <div className="space-y-2">
          {results.results.map((c, i) => (
            <div key={i} className="flex items-start gap-3 p-2.5 rounded" style={{ background: "#111", border: "1px solid #1a1a1a" }}>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] text-white font-medium">{c.name}</div>
                <div className="text-[11px]" style={{ color: "#666" }}>
                  {[c.ticker, c.cik ? `CIK ${c.cik}` : null].filter(Boolean).join(" · ")}
                </div>
              </div>
              <button
                onClick={() => handleSelect(c)}
                disabled={loadingDetails === c.cik}
                className="text-[10px] font-mono shrink-0 px-2.5 py-1 rounded cursor-pointer"
                style={{ background: "transparent", border: "1px solid rgba(9, 188, 138,0.3)", color: "#09BC8A" }}
              >
                {loadingDetails === c.cik ? "..." : "Use This"}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Section: Professional ──

function ProfessionalSection({ profile, update, aiFields }) {
  const pro = profile.professional || {};
  const [showCompanyLookup, setShowCompanyLookup] = useState(false);

  function set(field, value) {
    update((p) => ({ ...p, professional: { ...p.professional, [field]: value } }));
  }

  function handleCompanySelect(company) {
    update((p) => {
      const next = { ...p };
      if (company.entity_type) next.professional = { ...next.professional, organization_type: company.entity_type };
      if (company.sic_description) next.professional = { ...next.professional, industry: company.sic_description };
      // Add corporate filing if we have details
      if (company.cik) {
        const filing = { entity: company.name, role: "", cik: company.cik, source: "SEC EDGAR" };
        if (company.ticker) filing.ticker = company.ticker;
        if (company.state) filing.state = company.state;
        if (company.exchanges?.length) filing.exchanges = company.exchanges;
        const filings = [...(next.public_records?.corporate_filings || [])];
        const exists = filings.some((f) => f.entity?.toLowerCase() === company.name?.toLowerCase());
        if (!exists) {
          filings.push(filing);
          next.public_records = { ...next.public_records, corporate_filings: filings };
        }
      }
      return next;
    });
    setShowCompanyLookup(false);
  }

  return (
    <div className="surface p-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <FormField label="Title / Role">
          <input className="form-input" value={pro.title || ""} onChange={(e) => set("title", e.target.value)} placeholder="e.g., Chief Financial Officer" />
        </FormField>
        <FormField label="Organization">
          <div className="flex gap-2">
            <input className="form-input flex-1" value={pro.organization || ""} onChange={(e) => set("organization", e.target.value)} placeholder="e.g., Apex Maritime Holdings" />
            {(pro.organization || "").length >= 3 && (
              <button onClick={() => setShowCompanyLookup(!showCompanyLookup)} className="px-2 py-1 rounded cursor-pointer shrink-0" style={{ background: "transparent", border: "1px solid #2a2a2a", color: "#09BC8A" }} title="Lookup company">
                <Building2 size={14} />
              </button>
            )}
          </div>
          {showCompanyLookup && <CompanyLookupPanel onSelect={handleCompanySelect} />}
        </FormField>
        <FormField label="Organization Type">
          <input className="form-input" value={pro.organization_type || ""} onChange={(e) => set("organization_type", e.target.value)} placeholder="e.g., Public Corporation" />
        </FormField>
        <FormField label="Industry">
          <input className="form-input" value={pro.industry || ""} onChange={(e) => set("industry", e.target.value)} placeholder="e.g., Shipping & Logistics" />
        </FormField>
        <FormField label="Annual Revenue">
          <input className="form-input" value={pro.annual_revenue || ""} onChange={(e) => set("annual_revenue", e.target.value)} placeholder="e.g., $2.1B" />
        </FormField>
      </div>

      <div className="mb-4">
        <span className="sub-label block mb-3">Education</span>
        {(pro.education || []).map((edu, i) => (
          <div key={i} className={`entry-card ${edu._aiExtracted ? "ai-extracted" : ""}`}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <FormField label="Institution">
                <input className="form-input" value={edu.institution || ""} onChange={(e) => {
                  const next = [...(pro.education || [])];
                  next[i] = { ...next[i], institution: e.target.value };
                  set("education", next);
                }} />
              </FormField>
              <FormField label="Degree">
                <input className="form-input" value={edu.degree || ""} onChange={(e) => {
                  const next = [...(pro.education || [])];
                  next[i] = { ...next[i], degree: e.target.value };
                  set("education", next);
                }} />
              </FormField>
              <FormField label="Year">
                <input className="form-input" value={edu.year || ""} onChange={(e) => {
                  const next = [...(pro.education || [])];
                  next[i] = { ...next[i], year: e.target.value };
                  set("education", next);
                }} />
              </FormField>
            </div>
            <div className="mt-2 flex justify-end">
              <RemoveBtn onClick={() => set("education", pro.education.filter((_, j) => j !== i))} />
            </div>
          </div>
        ))}
        <AddBtn label="Add Education" onClick={() => set("education", [...(pro.education || []), { institution: "", degree: "", year: "" }])} />
      </div>
    </div>
  );
}

// ── Section: Locations & Contact ──

function LocationsSection({ profile, update, aiFields }) {
  const loc = profile.locations || {};
  const contact = profile.contact || {};

  function setAddr(idx, field, value) {
    update((p) => {
      const next = [...(p.locations?.addresses || [])];
      next[idx] = { ...next[idx], [field]: value };
      return { ...p, locations: { ...p.locations, addresses: next } };
    });
  }
  const geocodeTimers = useRef({});

  function handleAddrBlur(idx) {
    update((p) => {
      const addrs = [...(p.locations?.addresses || [])];
      addrs[idx] = formatAddress(addrs[idx]);
      return { ...p, locations: { ...p.locations, addresses: addrs } };
    });
    // Debounced geocode
    if (geocodeTimers.current[idx]) clearTimeout(geocodeTimers.current[idx]);
    geocodeTimers.current[idx] = setTimeout(() => triggerGeocode(idx), 2000);
  }

  async function triggerGeocode(idx) {
    const addr = profile.locations?.addresses?.[idx];
    if (!addr || !addr.street || !addr.city) return;
    const result = await geocodeAddress(addr);
    if (result) {
      update((p) => {
        const addrs = [...(p.locations?.addresses || [])];
        addrs[idx] = { ...addrs[idx], coordinates: result.coordinates, geocode_confidence: result.confidence, formatted_address: result.formatted_address };
        return { ...p, locations: { ...p.locations, addresses: addrs } };
      });
    }
  }
  function removeAddr(idx) {
    update((p) => ({ ...p, locations: { ...p.locations, addresses: p.locations.addresses.filter((_, i) => i !== idx) } }));
  }
  function addAddr() {
    update((p) => ({
      ...p,
      locations: { ...p.locations, addresses: [...(p.locations?.addresses || []), { type: "home", label: "", street: "", city: "", state: "", zip: "", country: "US", source: "", confidence: "unverified" }] },
    }));
  }

  function setPhone(idx, field, value) {
    update((p) => {
      const next = [...(p.contact?.phone_numbers || [])];
      next[idx] = { ...next[idx], [field]: value };
      return { ...p, contact: { ...p.contact, phone_numbers: next } };
    });
  }
  function removePhone(idx) {
    update((p) => ({ ...p, contact: { ...p.contact, phone_numbers: p.contact.phone_numbers.filter((_, i) => i !== idx) } }));
  }
  function addPhone() {
    update((p) => ({
      ...p,
      contact: { ...p.contact, phone_numbers: [...(p.contact?.phone_numbers || []), { type: "personal", number: "", source: "" }] },
    }));
  }

  function setEmail(idx, field, value) {
    update((p) => {
      const next = [...(p.contact?.email_addresses || [])];
      next[idx] = { ...next[idx], [field]: value };
      return { ...p, contact: { ...p.contact, email_addresses: next } };
    });
  }
  function removeEmail(idx) {
    update((p) => ({ ...p, contact: { ...p.contact, email_addresses: p.contact.email_addresses.filter((_, i) => i !== idx) } }));
  }
  function addEmail() {
    update((p) => ({
      ...p,
      contact: { ...p.contact, email_addresses: [...(p.contact?.email_addresses || []), { type: "personal", address: "", source: "" }] },
    }));
  }

  // Add a single enriched breach to profile
  function addBreachToProfile(breach) {
    update((p) => ({
      ...p,
      breaches: { ...p.breaches, records: [...(p.breaches?.records || []), breach] },
    }));
  }

  // Update enrichment status on an email entry
  function setEmailEnrichment(idx, enrichment) {
    update((p) => {
      const next = [...(p.contact?.email_addresses || [])];
      next[idx] = { ...next[idx], enrichment };
      return { ...p, contact: { ...p.contact, email_addresses: next } };
    });
  }

  return (
    <div className="space-y-6">
      {/* Addresses */}
      <div className="surface p-6">
        <span className="sub-label block mb-3">Addresses</span>
        {(loc.addresses || []).map((addr, i) => (
          <div key={i} className={`entry-card relative ${addr._aiExtracted ? "ai-extracted" : ""}`}>
            <SourceTag source={addr.source} />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
              <FormField label="Type">
                <SelectField value={addr.type || ""} onChange={(v) => setAddr(i, "type", v)} options={ADDRESS_TYPES} />
              </FormField>
              <FormField label="Label" className="md:col-span-3">
                <input className="form-input" value={addr.label || ""} onChange={(e) => setAddr(i, "label", e.target.value)} placeholder="e.g., Primary Residence" />
              </FormField>
            </div>
            <FormField label="Street" className="mb-3">
              <input className="form-input" value={addr.street || ""} onChange={(e) => setAddr(i, "street", e.target.value)} />
            </FormField>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
              <FormField label="City">
                <input className="form-input" value={addr.city || ""} onChange={(e) => setAddr(i, "city", e.target.value)} onBlur={() => handleAddrBlur(i)} />
              </FormField>
              <FormField label="State">
                <input className="form-input" value={addr.state || ""} onChange={(e) => setAddr(i, "state", e.target.value)} onBlur={() => handleAddrBlur(i)} />
              </FormField>
              <FormField label="Zip">
                <input className="form-input" value={addr.zip || ""} onChange={(e) => setAddr(i, "zip", e.target.value)} onBlur={() => handleAddrBlur(i)} />
              </FormField>
              <FormField label="Country">
                <input className="form-input" value={addr.country || ""} onChange={(e) => setAddr(i, "country", e.target.value)} />
              </FormField>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Source">
                <input className="form-input" value={addr.source || ""} onChange={(e) => setAddr(i, "source", e.target.value)} placeholder="e.g., Property records" />
              </FormField>
              <FormField label="Confidence">
                <SelectField value={addr.confidence || ""} onChange={(v) => setAddr(i, "confidence", v)} options={CONFIDENCE_LEVELS} />
              </FormField>
            </div>
            {addr.coordinates && (
              <div className="flex items-center gap-1.5 mt-2">
                <MapPin size={12} color="#555" />
                <span className="text-[11px] font-mono" style={{ color: "#555" }}>
                  Geocoded: {addr.coordinates[1].toFixed(4)}°N, {Math.abs(addr.coordinates[0]).toFixed(4)}°{addr.coordinates[0] < 0 ? "W" : "E"}
                  {addr.geocode_confidence != null && ` (${addr.geocode_confidence >= 0.8 ? "high" : addr.geocode_confidence >= 0.5 ? "medium" : "low"} confidence)`}
                </span>
              </div>
            )}
            {!addr.coordinates && addr.street && addr.city && hasMapboxToken() && (
              <button
                onClick={() => triggerGeocode(i)}
                className="flex items-center gap-1.5 mt-2 text-[11px] font-mono cursor-pointer"
                style={{ background: "transparent", border: "none", color: "#09BC8A" }}
              >
                <MapPin size={11} /> Geocode Address
              </button>
            )}
            <div className="mt-2 flex justify-end">
              <RemoveBtn onClick={() => removeAddr(i)} />
            </div>
          </div>
        ))}
        <AddBtn label="Add Address" onClick={addAddr} />
      </div>

      {/* Phones */}
      <div className="surface p-6">
        <span className="sub-label block mb-3">Phone Numbers</span>
        {(contact.phone_numbers || []).map((phone, i) => (
          <div key={i} className={`entry-card relative ${phone._aiExtracted ? "ai-extracted" : ""}`}>
            <SourceTag source={phone.source} />
            <div className="grid grid-cols-3 gap-3">
              <FormField label="Type">
                <SelectField value={phone.type || ""} onChange={(v) => setPhone(i, "type", v)} options={PHONE_TYPES} />
              </FormField>
              <FormField label="Number">
                <input className="form-input" value={phone.number || ""} onChange={(e) => setPhone(i, "number", e.target.value)} />
              </FormField>
              <FormField label="Source">
                <input className="form-input" value={phone.source || ""} onChange={(e) => setPhone(i, "source", e.target.value)} />
              </FormField>
            </div>
            <div className="mt-2 flex justify-end">
              <RemoveBtn onClick={() => removePhone(i)} />
            </div>
          </div>
        ))}
        <AddBtn label="Add Phone" onClick={addPhone} />
      </div>

      {/* Emails */}
      <div className="surface p-6">
        <span className="sub-label block mb-3">Email Addresses</span>
        {(contact.email_addresses || []).map((email, i) => (
          <EmailEntryCard
            key={i}
            email={email}
            index={i}
            setEmail={setEmail}
            removeEmail={removeEmail}
            addBreachToProfile={addBreachToProfile}
            setEmailEnrichment={setEmailEnrichment}
            existingBreaches={profile.breaches?.records || []}
          />
        ))}
        <AddBtn label="Add Email" onClick={addEmail} />
      </div>
    </div>
  );
}

// ── Email Entry Card with Enrichment ──

function EmailEntryCard({ email, index, setEmail, removeEmail, addBreachToProfile, setEmailEnrichment, existingBreaches }) {
  const [enrichState, setEnrichState] = useState("idle"); // idle | loading | done | error
  const [enrichResult, setEnrichResult] = useState(null);
  const [enrichError, setEnrichError] = useState(null);
  const [addedBreaches, setAddedBreaches] = useState(new Set());

  const domainInfo = useMemo(() => analyzeEmailDomain(email.address), [email.address]);
  const enrichment = email.enrichment;

  async function handleCheckBreaches() {
    setEnrichState("loading");
    setEnrichError(null);
    const result = await checkEmailBreaches(email.address);
    if (result.error) {
      setEnrichState("error");
      setEnrichError(result);
    } else {
      setEnrichResult(result);
      setEnrichState("done");
      setEmailEnrichment(index, {
        last_checked: new Date().toISOString(),
        breaches_found: result.found ? result.count : 0,
        status: "checked",
      });
    }
  }

  function handleAddBreach(breach) {
    addBreachToProfile(breach);
    setAddedBreaches((prev) => new Set([...prev, breach.hibp_name]));
  }

  function handleAddAll() {
    if (!enrichResult?.breaches) return;
    for (const b of enrichResult.breaches) {
      if (!isDuplicateBreach(existingBreaches, b) && !addedBreaches.has(b.hibp_name)) {
        addBreachToProfile(b);
      }
    }
    setAddedBreaches(new Set(enrichResult.breaches.map((b) => b.hibp_name)));
  }

  const daysSinceCheck = enrichment?.last_checked
    ? Math.floor((Date.now() - new Date(enrichment.last_checked).getTime()) / (1000 * 60 * 60 * 24))
    : null;

  return (
    <div className={`entry-card relative ${email._aiExtracted ? "ai-extracted" : ""}`}>
      <SourceTag source={email.source} />
      <div className="grid grid-cols-3 gap-3">
        <FormField label="Type">
          <SelectField value={email.type || ""} onChange={(v) => setEmail(index, "type", v)} options={EMAIL_TYPES} />
        </FormField>
        <FormField label="Address">
          <input className="form-input" value={email.address || ""} onChange={(e) => setEmail(index, "address", e.target.value)} />
        </FormField>
        <FormField label="Source">
          <input className="form-input" value={email.source || ""} onChange={(e) => setEmail(index, "source", e.target.value)} />
        </FormField>
      </div>

      {/* Email domain detection */}
      {domainInfo && (
        <div className="flex items-center gap-1.5 mt-2">
          <Mail size={12} color="#555" />
          <span className="text-[11px] font-mono" style={{ color: "#555" }}>
            {domainInfo.encrypted
              ? `Encrypted email (${domainInfo.domain})`
              : domainInfo.type === "corporate"
              ? `Corporate domain: ${domainInfo.domain}`
              : `Personal email (${domainInfo.domain})`}
          </span>
          {domainInfo.encrypted && (
            <span className="text-[10px]" style={{ color: "#444" }}> — limits enrichment potential</span>
          )}
        </div>
      )}

      {/* Enrichment status indicator */}
      {enrichment?.status === "checked" && enrichState === "idle" && (
        <div className="flex items-center gap-2 mt-2">
          <span
            className="w-1.5 h-1.5 rounded-full"
            style={{ background: enrichment.breaches_found > 0 ? "#f59e0b" : "#10b981" }}
          />
          <span className="text-[10px] font-mono" style={{ color: "#555" }}>
            {enrichment.breaches_found > 0
              ? `${enrichment.breaches_found} breach${enrichment.breaches_found > 1 ? "es" : ""}`
              : "No breaches"}
            {enrichment.last_checked && ` · Checked ${new Date(enrichment.last_checked).toLocaleDateString()}`}
          </span>
          {daysSinceCheck != null && daysSinceCheck > 30 && (
            <button
              onClick={handleCheckBreaches}
              className="text-[10px] font-mono cursor-pointer"
              style={{ background: "transparent", border: "none", color: "#09BC8A" }}
            >
              Recheck
            </button>
          )}
        </div>
      )}

      {/* Check Breaches button */}
      {email.address && enrichState === "idle" && !enrichResult && (
        <div className="mt-2 flex justify-end">
          <button
            onClick={handleCheckBreaches}
            className="flex items-center gap-1.5 text-[11px] font-mono px-2.5 py-1 rounded cursor-pointer transition-all"
            style={{ background: "transparent", border: "1px solid transparent", color: "#09BC8A" }}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#2a2a2a")}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = "transparent")}
          >
            <Search size={12} /> Check Breaches
          </button>
        </div>
      )}

      {/* Loading state */}
      {enrichState === "loading" && (
        <div className="mt-3 flex items-center gap-2">
          <span className="pulse-dot" /><span className="pulse-dot" /><span className="pulse-dot" />
          <span className="text-[11px]" style={{ color: "#888" }}>Checking...</span>
        </div>
      )}

      {/* Error state */}
      {enrichState === "error" && enrichError && (
        <div className="mt-3 p-3 rounded" style={{ background: "#0a0a0a", borderLeft: "3px solid #ef4444", border: "1px solid rgba(9, 188, 138,0.1)" }}>
          {enrichError.error === "no_api_key" ? (
            <>
              <div className="text-[12px]" style={{ color: "#888" }}>Breach lookup requires a HaveIBeenPwned API key.</div>
              <div className="text-[11px] mt-1" style={{ color: "#555" }}>$3.50/month — haveibeenpwned.com/API/Key</div>
              <div className="text-[10px] mt-1" style={{ color: "#444" }}>Add as VITE_HIBP_API_KEY in configuration.</div>
            </>
          ) : (
            <>
              <div className="text-[12px]" style={{ color: "#ef4444" }}>Lookup failed: {enrichError.message}</div>
              <button
                onClick={handleCheckBreaches}
                className="text-[11px] mt-2 cursor-pointer"
                style={{ background: "transparent", border: "none", color: "#09BC8A" }}
              >
                Retry
              </button>
            </>
          )}
        </div>
      )}

      {/* Results panel */}
      {enrichState === "done" && enrichResult && (
        <div className="mt-3 p-3 rounded fade-in" style={{ background: "#0a0a0a", borderLeft: "3px solid #09BC8A", border: "1px solid rgba(9, 188, 138,0.15)" }}>
          <div className="text-[10px] font-mono tracking-wider mb-2" style={{ color: "#09BC8A" }}>BREACH ENRICHMENT</div>
          {!enrichResult.found ? (
            <div className="flex items-center gap-2">
              <Check size={12} color="#10b981" />
              <span className="text-[12px]" style={{ color: "#10b981" }}>No breaches found for this email.</span>
            </div>
          ) : (
            <>
              <div className="text-[12px] mb-2" style={{ color: "#888" }}>Found in {enrichResult.count} breach{enrichResult.count > 1 ? "es" : ""}:</div>
              <div className="space-y-2">
                {enrichResult.breaches.map((b) => {
                  const isExisting = isDuplicateBreach(existingBreaches, b);
                  const isAdded = addedBreaches.has(b.hibp_name);
                  return (
                    <div key={b.hibp_name} className="flex items-start gap-2">
                      <span className="shrink-0 mt-0.5" style={{ color: b.severity === "high" ? "#f59e0b" : b.severity === "medium" ? "#555" : "#444" }}>
                        {b.severity === "high" ? "!" : b.severity === "medium" ? "~" : "o"}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="text-[13px] text-white">{b.breach_name}</div>
                        <div className="text-[11px]" style={{ color: "#666" }}>{(b.data_types || []).slice(0, 5).join(", ")}</div>
                      </div>
                      {isExisting || isAdded ? (
                        <span className="text-[10px] font-mono shrink-0" style={{ color: "#555" }}>Added</span>
                      ) : (
                        <button
                          onClick={() => handleAddBreach(b)}
                          className="text-[10px] font-mono shrink-0 cursor-pointer"
                          style={{ background: "transparent", border: "none", color: "#09BC8A" }}
                        >
                          + Add
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
              {enrichResult.breaches.some((b) => !isDuplicateBreach(existingBreaches, b) && !addedBreaches.has(b.hibp_name)) && (
                <button
                  onClick={handleAddAll}
                  className="mt-3 text-[11px] font-mono px-3 py-1.5 rounded cursor-pointer transition-all"
                  style={{ background: "transparent", border: "1px solid rgba(9, 188, 138,0.3)", color: "#09BC8A" }}
                >
                  Add All to Profile
                </button>
              )}
            </>
          )}
        </div>
      )}

      <div className="mt-2 flex justify-end">
        <RemoveBtn onClick={() => removeEmail(index)} />
      </div>
    </div>
  );
}

// ── Batch Enrichment Modal ──

function BatchEnrichModal({ profile, update, onClose }) {
  const emails = useMemo(() => {
    return (profile.contact?.email_addresses || [])
      .filter((e) => e.address)
      .map((e) => e.address);
  }, [profile]);

  const [state, setState] = useState("idle"); // idle | running | done
  const [progress, setProgress] = useState({ current: 0, total: 0, email: null });
  const [results, setResults] = useState(null);
  const [addedBreaches, setAddedBreaches] = useState(new Set());
  const existingBreaches = profile.breaches?.records || [];

  async function handleRun() {
    if (!hasHibpKey()) {
      setResults({ error: "no_api_key" });
      setState("done");
      return;
    }
    setState("running");
    const res = await checkMultipleEmails(emails, (current, total, email) => {
      setProgress({ current, total, email });
    });
    setResults(res);
    setState("done");

    // Update enrichment status on all email entries
    update((p) => {
      const next = [...(p.contact?.email_addresses || [])];
      for (let i = 0; i < next.length; i++) {
        const addr = next[i].address;
        if (addr && res[addr]) {
          const r = res[addr];
          if (!r.error) {
            next[i] = {
              ...next[i],
              enrichment: {
                last_checked: new Date().toISOString(),
                breaches_found: r.found ? r.count : 0,
                status: "checked",
              },
            };
          }
        }
      }
      return { ...p, contact: { ...p.contact, email_addresses: next } };
    });
  }

  function addBreach(breach) {
    update((p) => ({
      ...p,
      breaches: { ...p.breaches, records: [...(p.breaches?.records || []), breach] },
    }));
    setAddedBreaches((prev) => new Set([...prev, breach.hibp_name + breach.email_exposed]));
  }

  function addAllNew() {
    if (!results) return;
    for (const email of Object.keys(results)) {
      const r = results[email];
      if (r.breaches) {
        for (const b of r.breaches) {
          const key = b.hibp_name + b.email_exposed;
          if (!isDuplicateBreach(existingBreaches, b) && !addedBreaches.has(key)) {
            update((p) => ({
              ...p,
              breaches: { ...p.breaches, records: [...(p.breaches?.records || []), b] },
            }));
            setAddedBreaches((prev) => new Set([...prev, key]));
          }
        }
      }
    }
  }

  // Count new breaches available
  const newBreachCount = useMemo(() => {
    if (!results) return 0;
    let count = 0;
    for (const email of Object.keys(results)) {
      const r = results[email];
      if (r.breaches) {
        for (const b of r.breaches) {
          if (!isDuplicateBreach(existingBreaches, b) && !addedBreaches.has(b.hibp_name + b.email_exposed)) {
            count++;
          }
        }
      }
    }
    return count;
  }, [results, existingBreaches, addedBreaches]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.7)" }}
      onClick={onClose}
    >
      <div
        className="surface p-6 w-full max-w-xl max-h-[80vh] flex flex-col fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5 shrink-0">
          <div>
            <span className="section-label text-[10px]">Batch Breach Enrichment</span>
          </div>
          <button onClick={onClose} className="p-1 cursor-pointer" style={{ background: "transparent", border: "none" }}>
            <X size={16} color="#555" />
          </button>
        </div>

        {state === "idle" && (
          <div>
            <div className="text-[13px] mb-4" style={{ color: "#888" }}>
              Check <span className="text-white">{emails.length}</span> email address{emails.length !== 1 ? "es" : ""} against HaveIBeenPwned breach database.
            </div>
            <div className="space-y-1 mb-5">
              {emails.map((e) => (
                <div key={e} className="text-[12px] font-mono" style={{ color: "#666" }}>{e}</div>
              ))}
            </div>
            <button
              onClick={handleRun}
              className="w-full py-2.5 rounded text-sm font-semibold cursor-pointer"
              style={{ background: "#09BC8A", color: "#0a0a0a", border: "none" }}
            >
              Check All Breaches
            </button>
          </div>
        )}

        {state === "running" && (
          <div className="py-8 text-center">
            <div className="flex items-center gap-2 justify-center mb-3">
              <span className="pulse-dot" /><span className="pulse-dot" /><span className="pulse-dot" />
            </div>
            <div className="text-[13px] mb-2" style={{ color: "#888" }}>
              Checking email {progress.current + 1} of {progress.total}...
            </div>
            {progress.email && (
              <div className="text-[11px] font-mono mb-3" style={{ color: "#555" }}>{progress.email}</div>
            )}
            <div className="w-48 mx-auto h-1.5 rounded-full" style={{ background: "#1a1a1a" }}>
              <div
                className="h-full rounded-full"
                style={{
                  width: `${progress.total > 0 ? (progress.current / progress.total) * 100 : 0}%`,
                  background: "#09BC8A",
                  transition: "width 0.3s ease",
                }}
              />
            </div>
            <div className="text-[10px] mt-2" style={{ color: "#444" }}>Rate limited: ~2 sec per email</div>
          </div>
        )}

        {state === "done" && results && (
          <div className="flex-1 overflow-y-auto min-h-0">
            {results.error === "no_api_key" ? (
              <div className="p-4 rounded" style={{ background: "#0d0d0d", border: "1px solid #1a1a1a" }}>
                <div className="text-[13px] mb-2" style={{ color: "#888" }}>Breach lookup requires a HaveIBeenPwned API key.</div>
                <div className="text-[12px]" style={{ color: "#555" }}>$3.50/month — haveibeenpwned.com/API/Key</div>
                <div className="text-[11px] mt-1" style={{ color: "#444" }}>Add as VITE_HIBP_API_KEY in configuration.</div>
              </div>
            ) : (
              <>
                <div className="text-[12px] mb-4" style={{ color: "#888" }}>
                  Checked {emails.length} email address{emails.length !== 1 ? "es" : ""}:
                </div>
                <div className="space-y-4">
                  {emails.map((emailAddr) => {
                    const r = results[emailAddr];
                    if (!r) return null;
                    if (r.error) {
                      return (
                        <div key={emailAddr}>
                          <div className="text-[13px] font-mono text-white mb-1">{emailAddr}</div>
                          <div className="text-[11px]" style={{ color: "#ef4444" }}>Error: {r.message}</div>
                        </div>
                      );
                    }
                    return (
                      <div key={emailAddr}>
                        <div className="text-[13px] font-mono text-white mb-1">
                          {emailAddr} — {r.found ? `${r.count} breach${r.count > 1 ? "es" : ""} found` : "no breaches found"}
                        </div>
                        {r.breaches && r.breaches.length > 0 && (
                          <div className="ml-3 space-y-1">
                            {r.breaches.map((b) => {
                              const key = b.hibp_name + b.email_exposed;
                              const isExisting = isDuplicateBreach(existingBreaches, b);
                              const isAdded = addedBreaches.has(key);
                              return (
                                <div key={b.hibp_name} className="flex items-center gap-2">
                                  <span className="text-[11px] font-mono" style={{ color: "#333" }}>|--</span>
                                  <span className="text-[12px] flex-1" style={{ color: "#ccc" }}>
                                    {b.breach_name} — <span style={{ color: "#666" }}>{(b.data_types || []).slice(0, 4).join(", ")}</span>
                                  </span>
                                  {isExisting || isAdded ? (
                                    <span className="text-[10px] font-mono" style={{ color: "#555" }}>Added</span>
                                  ) : (
                                    <button
                                      onClick={() => addBreach(b)}
                                      className="text-[10px] font-mono shrink-0 cursor-pointer"
                                      style={{ background: "transparent", border: "none", color: "#09BC8A" }}
                                    >
                                      + Add
                                    </button>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                        {!r.found && (
                          <div className="ml-3 flex items-center gap-1.5">
                            <Check size={11} color="#10b981" />
                            <span className="text-[11px]" style={{ color: "#10b981" }}>Clean</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                {newBreachCount > 0 && (
                  <button
                    onClick={addAllNew}
                    className="mt-5 w-full py-2.5 rounded text-sm font-semibold cursor-pointer"
                    style={{ background: "transparent", border: "1px solid rgba(9, 188, 138,0.3)", color: "#09BC8A" }}
                  >
                    Add All New to Profile ({newBreachCount})
                  </button>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Corporate Filing Card with Lookup ──

function CorporateFilingCard({ filing, index, corpHandlers, update }) {
  const [showLookup, setShowLookup] = useState(false);

  function handleSelect(company) {
    corpHandlers.set(index, "jurisdiction", company.jurisdiction || filing.jurisdiction);
    if (company.incorporation_date) corpHandlers.set(index, "incorporation_date", company.incorporation_date);
    if (company.status) corpHandlers.set(index, "status", company.status);
    if (company.registered_address) corpHandlers.set(index, "registered_address", company.registered_address);
    corpHandlers.set(index, "source", "OpenCorporates");
    // Offer to add address
    if (company.registered_address) {
      corpHandlers.set(index, "_enriched", true);
    }
    setShowLookup(false);
  }

  function addAddressToLocations() {
    if (!filing.registered_address) return;
    update((p) => {
      const addr = { type: "corporate_filing", label: filing.entity || "Corporate Filing", street: filing.registered_address, city: "", state: "", zip: "", country: "", source: "OpenCorporates", confidence: "confirmed" };
      return { ...p, locations: { ...p.locations, addresses: [...(p.locations?.addresses || []), addr] } };
    });
  }

  return (
    <div className={`entry-card relative ${filing._aiExtracted ? "ai-extracted" : ""}`}>
      <SourceTag source={filing.source} />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <FormField label="Entity">
          <div className="flex gap-2">
            <input className="form-input flex-1" value={filing.entity || ""} onChange={(e) => corpHandlers.set(index, "entity", e.target.value)} />
            {(filing.entity || "").length >= 3 && (
              <button onClick={() => setShowLookup(!showLookup)} className="px-2 py-1 rounded cursor-pointer shrink-0" style={{ background: "transparent", border: "1px solid #2a2a2a", color: "#09BC8A" }} title="Lookup entity">
                <Building2 size={14} />
              </button>
            )}
          </div>
        </FormField>
        <FormField label="Role">
          <input className="form-input" value={filing.role || ""} onChange={(e) => corpHandlers.set(index, "role", e.target.value)} />
        </FormField>
        <FormField label="Jurisdiction">
          <input className="form-input" value={filing.jurisdiction || ""} onChange={(e) => corpHandlers.set(index, "jurisdiction", e.target.value)} />
        </FormField>
      </div>
      {showLookup && <CompanyLookupPanel onSelect={handleSelect} />}
      {filing._enriched && filing.registered_address && (
        <div className="mt-2 p-2 rounded" style={{ background: "#0d0d0d", border: "1px solid #1a1a1a" }}>
          <div className="flex items-center gap-2">
            <Check size={12} color="#10b981" />
            <span className="text-[11px]" style={{ color: "#10b981" }}>Enriched: {filing.incorporation_date && `Inc. ${filing.incorporation_date}`} {filing.status && `· ${filing.status}`}</span>
          </div>
          <div className="text-[11px] mt-1" style={{ color: "#666" }}>{filing.registered_address}</div>
          <button onClick={addAddressToLocations} className="text-[10px] font-mono mt-1.5 cursor-pointer" style={{ background: "transparent", border: "none", color: "#09BC8A" }}>
            Add address to Locations →
          </button>
        </div>
      )}
      <div className="mt-2 flex justify-end">
        <RemoveBtn onClick={() => corpHandlers.remove(index)} />
      </div>
    </div>
  );
}

// ── Social Account Card with Verify ──

function SocialAccountCard({ acct, index, setSocial, removeSocial }) {
  const [verifyState, setVerifyState] = useState("idle"); // idle | loading | done
  const [verifyResult, setVerifyResult] = useState(null);

  async function handleVerify() {
    const handle = acct.url || acct.handle;
    if (!acct.platform || !handle) return;
    setVerifyState("loading");
    const result = await verifySocialProfile(acct.platform, handle);
    setVerifyResult(result);
    setVerifyState("done");
  }

  function applyVerifiedData() {
    if (!verifyResult) return;
    if (verifyResult.followers != null) setSocial(index, "followers", verifyResult.followers);
    if (verifyResult.display_name) setSocial(index, "notes", `${acct.notes ? acct.notes + " | " : ""}${verifyResult.display_name}${verifyResult.bio ? " — " + verifyResult.bio : ""}`);
    if (verifyResult.visibility) setSocial(index, "visibility", verifyResult.visibility);
    setSocial(index, "verified", true);
    setSocial(index, "verified_date", new Date().toISOString());
  }

  function markVerified() {
    setSocial(index, "verified", true);
    setSocial(index, "verified_date", new Date().toISOString());
  }

  function markNotFound() {
    setSocial(index, "verified", false);
    setSocial(index, "notes", `${acct.notes ? acct.notes + " | " : ""}Profile not found during verification`);
  }

  return (
    <div className={`entry-card relative ${acct._aiExtracted ? "ai-extracted" : ""}`}>
      <SourceTag source={acct.source} />
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-3">
        <FormField label="Platform">
          <SelectField value={acct.platform || ""} onChange={(v) => setSocial(index, "platform", v)} options={SOCIAL_PLATFORMS} placeholder="Select..." />
        </FormField>
        <FormField label="Handle / URL" className="md:col-span-2">
          <input className="form-input" value={acct.url || acct.handle || ""} onChange={(e) => setSocial(index, "url", e.target.value)} />
        </FormField>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-3">
        <FormField label="Visibility">
          <SelectField value={acct.visibility || ""} onChange={(v) => setSocial(index, "visibility", v)} options={VISIBILITY_OPTIONS} />
        </FormField>
        <FormField label="Followers">
          <input className="form-input" type="number" value={acct.followers || ""} onChange={(e) => setSocial(index, "followers", e.target.value ? parseInt(e.target.value) : null)} />
        </FormField>
        <div className="flex items-end pb-1">
          {acct.verified && (
            <span className="flex items-center gap-1 text-[10px] font-mono" style={{ color: "#10b981" }}>
              <CheckCircle size={11} /> Verified
            </span>
          )}
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <FormField label="Notes">
          <input className="form-input" value={acct.notes || ""} onChange={(e) => setSocial(index, "notes", e.target.value)} />
        </FormField>
        <FormField label="Source">
          <input className="form-input" value={acct.source || ""} onChange={(e) => setSocial(index, "source", e.target.value)} placeholder="e.g., OSINT lookup" />
        </FormField>
      </div>

      {/* Verify button */}
      {acct.platform && (acct.url || acct.handle) && verifyState === "idle" && !acct.verified && (
        <div className="mt-2 flex justify-end">
          <button onClick={handleVerify} className="flex items-center gap-1.5 text-[11px] font-mono px-2.5 py-1 rounded cursor-pointer" style={{ background: "transparent", border: "1px solid transparent", color: "#09BC8A" }} onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#2a2a2a")} onMouseLeave={(e) => (e.currentTarget.style.borderColor = "transparent")}>
            <Search size={12} /> Verify Profile
          </button>
        </div>
      )}

      {verifyState === "loading" && (
        <div className="mt-3 flex items-center gap-2">
          <span className="pulse-dot" /><span className="pulse-dot" /><span className="pulse-dot" />
          <span className="text-[11px]" style={{ color: "#888" }}>Verifying...</span>
        </div>
      )}

      {verifyState === "done" && verifyResult && (
        <div className="mt-3 p-3 rounded fade-in" style={{ background: "#0a0a0a", border: "1px solid #1a1a1a" }}>
          {verifyResult.verified === true && (
            <>
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle size={12} color="#10b981" />
                <span className="text-[12px] font-medium" style={{ color: "#10b981" }}>{verifyResult.platform} profile confirmed</span>
              </div>
              {verifyResult.display_name && <div className="text-[12px] mb-1" style={{ color: "#ccc" }}>Display Name: {verifyResult.display_name}</div>}
              {verifyResult.bio && <div className="text-[12px] mb-1" style={{ color: "#888" }}>Bio: "{verifyResult.bio}"</div>}
              <div className="text-[11px] mb-1" style={{ color: "#666" }}>
                {[verifyResult.followers != null && `Followers: ${verifyResult.followers}`, verifyResult.following != null && `Following: ${verifyResult.following}`, verifyResult.public_repos != null && `Repos: ${verifyResult.public_repos}`].filter(Boolean).join(" · ")}
              </div>
              {verifyResult.metadata?.location && <div className="text-[11px]" style={{ color: "#666" }}>Location: {verifyResult.metadata.location}</div>}
              <button onClick={applyVerifiedData} className="mt-2 text-[11px] font-mono px-3 py-1.5 rounded cursor-pointer" style={{ background: "transparent", border: "1px solid rgba(9, 188, 138,0.3)", color: "#09BC8A" }}>
                Update Profile Entry with Verified Data
              </button>
            </>
          )}
          {verifyResult.verified === false && (
            <div className="flex items-center gap-2">
              <XCircle size={12} color="#ef4444" />
              <span className="text-[12px]" style={{ color: "#ef4444" }}>{verifyResult.reason || "Profile not found"}</span>
            </div>
          )}
          {verifyResult.verified === null && verifyResult.manual_check && (
            <>
              <div className="text-[10px] font-mono tracking-wider mb-2" style={{ color: "#f59e0b" }}>MANUAL VERIFICATION</div>
              <div className="text-[12px] mb-2" style={{ color: "#888" }}>Open this link to verify the profile:</div>
              {verifyResult.url && (
                <a href={verifyResult.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-[12px] font-mono mb-2" style={{ color: "#09BC8A" }}>
                  {verifyResult.url} <ExternalLink size={11} />
                </a>
              )}
              <div className="text-[11px] mb-3" style={{ color: "#666" }}>{verifyResult.instructions}</div>
              <div className="flex gap-2">
                <button onClick={markVerified} className="flex items-center gap-1.5 text-[11px] font-mono px-3 py-1.5 rounded cursor-pointer" style={{ background: "transparent", border: "1px solid rgba(16,185,129,0.3)", color: "#10b981" }}>
                  <CheckCircle size={11} /> Mark as Verified
                </button>
                <button onClick={markNotFound} className="flex items-center gap-1.5 text-[11px] font-mono px-3 py-1.5 rounded cursor-pointer" style={{ background: "transparent", border: "1px solid rgba(239,68,68,0.3)", color: "#ef4444" }}>
                  <XCircle size={11} /> Profile Not Found
                </button>
              </div>
            </>
          )}
        </div>
      )}

      <div className="mt-2 flex justify-end">
        <RemoveBtn onClick={() => removeSocial(index)} />
      </div>
    </div>
  );
}

// ── Broker Check Panel ──

function BrokerCheckPanel({ profile, update }) {
  const fullName = profile.identity?.full_name;
  const addresses = profile.locations?.addresses || [];
  const firstState = addresses.find((a) => a.state)?.state;

  const [brokerLinks, setBrokerLinks] = useState([]);
  const [generated, setGenerated] = useState(false);

  function handleGenerate() {
    const links = generateBrokerCheckUrls(fullName, firstState);
    setBrokerLinks(links);
    setGenerated(true);
  }

  function markBroker(idx, status) {
    setBrokerLinks((prev) => prev.map((b, i) => (i === idx ? { ...b, status } : b)));
  }

  function addResultsToProfile() {
    update((p) => {
      const existing = p.digital?.data_broker_listings || [];
      const newListings = [...existing];
      for (const b of brokerLinks) {
        if (b.status === "unchecked") continue;
        const exists = existing.some((e) => e.broker?.toLowerCase() === b.name.toLowerCase());
        if (!exists) {
          newListings.push({
            broker: b.name,
            status: b.status === "listed" ? "active" : b.status === "not_listed" ? "not_listed" : "uncertain",
            data_exposed: b.notes,
            last_checked: new Date().toISOString().split("T")[0],
            source: "Sentract broker check",
          });
        }
      }
      return { ...p, digital: { ...p.digital, data_broker_listings: newListings } };
    });
  }

  const checkedCount = brokerLinks.filter((b) => b.status !== "unchecked").length;

  if (!fullName || !firstState) return null;

  return (
    <div className="surface p-6">
      <div className="section-label text-[10px] mb-2">Data Broker Presence Check</div>
      <div className="text-[11px] mb-3" style={{ color: "#666" }}>Subject: {fullName} · {firstState}</div>

      {!generated && (
        <button onClick={handleGenerate} className="flex items-center gap-1.5 text-[11px] font-mono px-3 py-1.5 rounded cursor-pointer" style={{ background: "transparent", border: "1px solid #2a2a2a", color: "#09BC8A" }}>
          <Search size={12} /> Generate Broker Check Links
        </button>
      )}

      {generated && brokerLinks.length > 0 && (
        <div className="space-y-2 mt-3">
          <div className="text-[11px] mb-2" style={{ color: "#888" }}>Check each broker for the subject's presence. Click to open, then mark the result.</div>
          {brokerLinks.map((b, i) => (
            <div key={i} className="flex items-center gap-3 p-2.5 rounded" style={{ background: "#0d0d0d", border: "1px solid #1a1a1a" }}>
              {b.status === "unchecked" && <HelpCircle size={12} color="#555" />}
              {b.status === "listed" && <AlertCircle size={12} color="#f59e0b" />}
              {b.status === "not_listed" && <CheckCircle size={12} color="#10b981" />}
              {b.status === "uncertain" && <HelpCircle size={12} color="#888" />}
              <div className="flex-1 min-w-0">
                <div className="text-[13px]" style={{ color: b.status === "listed" ? "#f59e0b" : b.status === "not_listed" ? "#10b981" : "#ccc" }}>{b.name}</div>
                <div className="text-[10px]" style={{ color: "#555" }}>{b.notes}</div>
              </div>
              {b.status !== "unchecked" && (
                <span className="text-[10px] font-mono shrink-0" style={{ color: b.status === "listed" ? "#f59e0b" : b.status === "not_listed" ? "#10b981" : "#888" }}>
                  {b.status === "listed" ? "LISTED" : b.status === "not_listed" ? "NOT FOUND" : "UNCERTAIN"}
                </span>
              )}
              <div className="flex items-center gap-1 shrink-0">
                {b.status === "unchecked" && (
                  <>
                    <button onClick={() => markBroker(i, "listed")} className="text-[9px] font-mono px-1.5 py-0.5 rounded cursor-pointer" style={{ background: "transparent", border: "1px solid rgba(245,158,11,0.3)", color: "#f59e0b" }} title="Listed">!</button>
                    <button onClick={() => markBroker(i, "not_listed")} className="text-[9px] font-mono px-1.5 py-0.5 rounded cursor-pointer" style={{ background: "transparent", border: "1px solid rgba(16,185,129,0.3)", color: "#10b981" }} title="Not found">✓</button>
                    <button onClick={() => markBroker(i, "uncertain")} className="text-[9px] font-mono px-1.5 py-0.5 rounded cursor-pointer" style={{ background: "transparent", border: "1px solid #333", color: "#888" }} title="Uncertain">?</button>
                  </>
                )}
                <a href={b.url} target="_blank" rel="noopener noreferrer" className="text-[10px] font-mono px-1.5 py-0.5 rounded" style={{ background: "transparent", border: "1px solid #2a2a2a", color: "#888" }}>
                  Open <ExternalLink size={9} className="inline" style={{ verticalAlign: "-1px" }} />
                </a>
              </div>
            </div>
          ))}
          <div className="flex items-center justify-between mt-3 pt-3" style={{ borderTop: "1px solid #1e1e1e" }}>
            <span className="text-[11px]" style={{ color: "#555" }}>{checkedCount} of {brokerLinks.length} checked</span>
            {checkedCount > 0 && (
              <button onClick={addResultsToProfile} className="text-[11px] font-mono px-3 py-1.5 rounded cursor-pointer" style={{ background: "transparent", border: "1px solid rgba(9, 188, 138,0.3)", color: "#09BC8A" }}>
                Add All Results to Profile
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Section: Digital Footprint ──

function DigitalSection({ profile, update, aiFields }) {
  const dig = profile.digital || {};

  function setSocial(idx, field, value) {
    update((p) => {
      const next = [...(p.digital?.social_accounts || [])];
      next[idx] = { ...next[idx], [field]: value };
      return { ...p, digital: { ...p.digital, social_accounts: next } };
    });
  }
  function removeSocial(idx) {
    update((p) => ({ ...p, digital: { ...p.digital, social_accounts: p.digital.social_accounts.filter((_, i) => i !== idx) } }));
  }
  function addSocial() {
    update((p) => ({
      ...p,
      digital: { ...p.digital, social_accounts: [...(p.digital?.social_accounts || []), { platform: "", handle: "", url: "", visibility: "public", followers: null, notes: "", source: "" }] },
    }));
  }

  function setBroker(idx, field, value) {
    update((p) => {
      const next = [...(p.digital?.data_broker_listings || [])];
      next[idx] = { ...next[idx], [field]: value };
      return { ...p, digital: { ...p.digital, data_broker_listings: next } };
    });
  }
  function removeBroker(idx) {
    update((p) => ({ ...p, digital: { ...p.digital, data_broker_listings: p.digital.data_broker_listings.filter((_, i) => i !== idx) } }));
  }
  function addBroker() {
    update((p) => ({
      ...p,
      digital: { ...p.digital, data_broker_listings: [...(p.digital?.data_broker_listings || []), { broker: "", status: "active", data_exposed: "", last_checked: "", source: "" }] },
    }));
  }

  return (
    <div className="space-y-6">
      {/* Broker Check Panel */}
      <BrokerCheckPanel profile={profile} update={update} />

      <div className="surface p-6">
        <span className="sub-label block mb-3">Social Accounts</span>
        {(dig.social_accounts || []).map((acct, i) => (
          <SocialAccountCard key={i} acct={acct} index={i} setSocial={setSocial} removeSocial={removeSocial} />
        ))}
        <AddBtn label="Add Social Account" onClick={addSocial} />
      </div>

      <div className="surface p-6">
        <span className="sub-label block mb-3">Data Broker Listings</span>
        {(dig.data_broker_listings || []).map((broker, i) => (
          <div key={i} className={`entry-card relative ${broker._aiExtracted ? "ai-extracted" : ""}`}>
            <SourceTag source={broker.source} />
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-3">
              <FormField label="Broker">
                <input className="form-input" value={broker.broker || ""} onChange={(e) => setBroker(i, "broker", e.target.value)} placeholder="e.g., Spokeo" />
              </FormField>
              <FormField label="Status">
                <SelectField value={broker.status || ""} onChange={(v) => setBroker(i, "status", v)} options={BROKER_STATUSES} />
              </FormField>
              <FormField label="Last Checked">
                <input className="form-input" type="date" value={broker.last_checked || ""} onChange={(e) => setBroker(i, "last_checked", e.target.value)} />
              </FormField>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <FormField label="Data Exposed">
                <input className="form-input" value={broker.data_exposed || ""} onChange={(e) => setBroker(i, "data_exposed", e.target.value)} placeholder="e.g., name, address, phone, relatives" />
              </FormField>
              <FormField label="Source">
                <input className="form-input" value={broker.source || ""} onChange={(e) => setBroker(i, "source", e.target.value)} placeholder="e.g., Manual search" />
              </FormField>
            </div>
            <div className="mt-2 flex justify-end">
              <RemoveBtn onClick={() => removeBroker(i)} />
            </div>
          </div>
        ))}
        <AddBtn label="Add Broker Listing" onClick={addBroker} />
      </div>
    </div>
  );
}

// ── Section: Breaches ──

function BreachesSection({ profile, update, aiFields }) {
  const breaches = profile.breaches?.records || [];

  function setBreach(idx, field, value) {
    update((p) => {
      const next = [...(p.breaches?.records || [])];
      next[idx] = { ...next[idx], [field]: value };
      return { ...p, breaches: { ...p.breaches, records: next } };
    });
  }
  function removeBreach(idx) {
    update((p) => ({ ...p, breaches: { ...p.breaches, records: p.breaches.records.filter((_, i) => i !== idx) } }));
  }
  function addBreach() {
    update((p) => ({
      ...p,
      breaches: { ...p.breaches, records: [...(p.breaches?.records || []), { breach_name: "", date: "", email_exposed: "", data_types: [], severity: "medium", notes: "", source: "" }] },
    }));
  }

  const credRisk = useMemo(() => analyzeCredentialRisk(profile), [profile]);

  return (
    <div className="space-y-6">
      {credRisk && credRisk.findings.length > 0 && (
        <div className="surface p-6">
          <div className="section-label text-[10px] mb-4">Credential Risk Analysis</div>
          <div className="text-[11px] mb-4" style={{ color: "#555" }}>Auto-analyzed from breach records</div>
          <div className="space-y-2">
            {credRisk.findings.map((f, i) => (
              <div key={i} className="p-3 rounded-md" style={{ background: "#0d0d0d", border: "1px solid #1a1a1a" }}>
                <div className="flex items-start justify-between gap-3 mb-1.5">
                  <span className="text-[14px] font-semibold text-white">{f.title}</span>
                  <span className="text-[10px] font-mono shrink-0 px-2 py-0.5 rounded" style={{
                    color: f.severity === "critical" ? "#ef4444" : f.severity === "high" ? "#f59e0b" : "#eab308",
                    background: f.severity === "critical" ? "rgba(239,68,68,0.08)" : f.severity === "high" ? "rgba(245,158,11,0.08)" : "rgba(234,179,8,0.08)",
                  }}>
                    {f.severity.toUpperCase()}
                  </span>
                </div>
                <div className="text-[13px] mb-1.5" style={{ color: "#888" }}>{f.detail}</div>
                <div className="text-[11px] font-mono" style={{ color: "#09BC8A" }}>Impact on Aegis Score: +{f.aegis_impact}</div>
              </div>
            ))}
          </div>
        </div>
      )}

    <div className="surface p-6">
      <span className="sub-label block mb-3">Breach Records</span>
      {breaches.map((b, i) => (
        <div key={i} className={`entry-card relative ${b._aiExtracted ? "ai-extracted" : ""}`}>
          <SourceTag source={b.source} />
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-3">
            <FormField label="Breach Name">
              <input className="form-input" value={b.breach_name || ""} onChange={(e) => setBreach(i, "breach_name", e.target.value)} placeholder="e.g., LinkedIn (2021)" />
            </FormField>
            <FormField label="Date">
              <input className="form-input" value={b.date || ""} onChange={(e) => setBreach(i, "date", e.target.value)} placeholder="e.g., 2021" />
            </FormField>
            <FormField label="Severity">
              <SelectField value={b.severity || ""} onChange={(v) => setBreach(i, "severity", v)} options={SEVERITY_LEVELS} />
            </FormField>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
            <FormField label="Email Exposed">
              <input className="form-input" value={b.email_exposed || ""} onChange={(e) => setBreach(i, "email_exposed", e.target.value)} />
            </FormField>
            <FormField label="Data Types (comma-separated)">
              <input className="form-input" value={Array.isArray(b.data_types) ? b.data_types.join(", ") : ""} onChange={(e) => setBreach(i, "data_types", e.target.value.split(",").map((s) => s.trim()).filter(Boolean))} />
            </FormField>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <FormField label="Notes">
              <input className="form-input" value={b.notes || ""} onChange={(e) => setBreach(i, "notes", e.target.value)} />
            </FormField>
            <FormField label="Source">
              <input className="form-input" value={b.source || ""} onChange={(e) => setBreach(i, "source", e.target.value)} placeholder="e.g., HIBP" />
            </FormField>
          </div>
          <div className="mt-2 flex justify-end">
            <RemoveBtn onClick={() => removeBreach(i)} />
          </div>
        </div>
      ))}
      <AddBtn label="Add Breach Record" onClick={addBreach} />
    </div>
    </div>
  );
}

// ── Section: Network ──

function NetworkSection({ profile, update, aiFields }) {
  const net = profile.network || {};

  function setFamily(idx, field, value) {
    update((p) => {
      const next = [...(p.network?.family_members || [])];
      next[idx] = { ...next[idx], [field]: value };
      return { ...p, network: { ...p.network, family_members: next } };
    });
  }
  function removeFamily(idx) {
    update((p) => ({ ...p, network: { ...p.network, family_members: p.network.family_members.filter((_, i) => i !== idx) } }));
  }
  function addFamily() {
    update((p) => ({
      ...p,
      network: { ...p.network, family_members: [...(p.network?.family_members || []), { name: "", relationship: "", age: null, occupation: "", social_media: [], notes: "", source: "" }] },
    }));
  }

  function setAssoc(idx, field, value) {
    update((p) => {
      const next = [...(p.network?.associates || [])];
      next[idx] = { ...next[idx], [field]: value };
      return { ...p, network: { ...p.network, associates: next } };
    });
  }
  function removeAssoc(idx) {
    update((p) => ({ ...p, network: { ...p.network, associates: p.network.associates.filter((_, i) => i !== idx) } }));
  }
  function addAssoc() {
    update((p) => ({
      ...p,
      network: { ...p.network, associates: [...(p.network?.associates || []), { name: "", relationship: "", shared_data_points: [], notes: "", source: "" }] },
    }));
  }

  return (
    <div className="space-y-6">
      <div className="surface p-6">
        <span className="sub-label block mb-3">Family Members</span>
        {(net.family_members || []).map((fam, i) => (
          <div key={i} className={`entry-card relative ${fam._aiExtracted ? "ai-extracted" : ""}`}>
            <SourceTag source={fam.source} />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
              <FormField label="Name" className="md:col-span-2">
                <input className="form-input" value={fam.name || ""} onChange={(e) => setFamily(i, "name", e.target.value)} />
              </FormField>
              <FormField label="Relationship">
                <SelectField value={fam.relationship || ""} onChange={(v) => setFamily(i, "relationship", v)} options={RELATIONSHIP_TYPES} placeholder="Select..." />
              </FormField>
              <FormField label="Age">
                <input className="form-input" type="number" value={fam.age || ""} onChange={(e) => setFamily(i, "age", e.target.value ? parseInt(e.target.value) : null)} />
              </FormField>
            </div>
            <FormField label="Occupation" className="mb-3">
              <input className="form-input" value={fam.occupation || ""} onChange={(e) => setFamily(i, "occupation", e.target.value)} />
            </FormField>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <FormField label="Risk Notes">
                <input className="form-input" value={fam.notes || ""} onChange={(e) => setFamily(i, "notes", e.target.value)} placeholder="e.g., Active Instagram reveals family locations" />
              </FormField>
              <FormField label="Source">
                <input className="form-input" value={fam.source || ""} onChange={(e) => setFamily(i, "source", e.target.value)} placeholder="e.g., Spokeo" />
              </FormField>
            </div>
            <div className="mt-2 flex justify-end">
              <RemoveBtn onClick={() => removeFamily(i)} />
            </div>
          </div>
        ))}
        <AddBtn label="Add Family Member" onClick={addFamily} />
      </div>

      <div className="surface p-6">
        <span className="sub-label block mb-3">Associates</span>
        {(net.associates || []).map((assoc, i) => (
          <div key={i} className={`entry-card relative ${assoc._aiExtracted ? "ai-extracted" : ""}`}>
            <SourceTag source={assoc.source} />
            {assoc.source === "auto-synced from linked subject" && (
              <span className="sync-badge" style={{ position: "absolute", top: 8, right: assoc.source ? 140 : 8 }}>&#x21C4; Synced</span>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
              <FormField label="Name">
                <input className="form-input" value={assoc.name || ""} onChange={(e) => setAssoc(i, "name", e.target.value)} />
              </FormField>
              <FormField label="Relationship">
                <input className="form-input" value={assoc.relationship || ""} onChange={(e) => setAssoc(i, "relationship", e.target.value)} placeholder="e.g., CEO, Apex Maritime" />
              </FormField>
            </div>
            <FormField label="Shared Data Points (comma-separated)" className="mb-3">
              <input className="form-input" value={Array.isArray(assoc.shared_data_points) ? assoc.shared_data_points.join(", ") : ""} onChange={(e) => setAssoc(i, "shared_data_points", e.target.value.split(",").map((s) => s.trim()).filter(Boolean))} />
            </FormField>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <FormField label="Notes">
                <input className="form-input" value={assoc.notes || ""} onChange={(e) => setAssoc(i, "notes", e.target.value)} />
              </FormField>
              <FormField label="Source">
                <input className="form-input" value={assoc.source || ""} onChange={(e) => setAssoc(i, "source", e.target.value)} placeholder="e.g., LinkedIn" />
              </FormField>
            </div>
            <div className="mt-2 flex justify-end">
              <RemoveBtn onClick={() => removeAssoc(i)} />
            </div>
          </div>
        ))}
        <AddBtn label="Add Associate" onClick={addAssoc} />
      </div>
    </div>
  );
}

// ── Section: Public Records ──

function PublicRecordsSection({ profile, update, aiFields }) {
  const pr = profile.public_records || {};

  function makeArrayHandlers(section) {
    return {
      set: (idx, field, value) => {
        update((p) => {
          const next = [...(p.public_records?.[section] || [])];
          next[idx] = { ...next[idx], [field]: value };
          return { ...p, public_records: { ...p.public_records, [section]: next } };
        });
      },
      remove: (idx) => {
        update((p) => ({ ...p, public_records: { ...p.public_records, [section]: p.public_records[section].filter((_, i) => i !== idx) } }));
      },
    };
  }

  const propHandlers = makeArrayHandlers("properties");
  const corpHandlers = makeArrayHandlers("corporate_filings");
  const courtHandlers = makeArrayHandlers("court_records");
  const donationHandlers = makeArrayHandlers("political_donations");

  return (
    <div className="space-y-6">
      <div className="surface p-6">
        <span className="sub-label block mb-3">Properties</span>
        {(pr.properties || []).map((prop, i) => (
          <div key={i} className={`entry-card relative ${prop._aiExtracted ? "ai-extracted" : ""}`}>
            <SourceTag source={prop.source} />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
              <FormField label="Type">
                <input className="form-input" value={prop.type || ""} onChange={(e) => propHandlers.set(i, "type", e.target.value)} placeholder="e.g., Residential" />
              </FormField>
              <FormField label="Value">
                <input className="form-input" value={prop.value || ""} onChange={(e) => propHandlers.set(i, "value", e.target.value)} placeholder="e.g., $4.2M" />
              </FormField>
              <FormField label="Source">
                <input className="form-input" value={prop.source || ""} onChange={(e) => propHandlers.set(i, "source", e.target.value)} />
              </FormField>
            </div>
            <FormField label="Address">
              <input className="form-input" value={prop.address || ""} onChange={(e) => propHandlers.set(i, "address", e.target.value)} />
            </FormField>
            <div className="mt-2 flex justify-end">
              <RemoveBtn onClick={() => propHandlers.remove(i)} />
            </div>
          </div>
        ))}
        <AddBtn label="Add Property" onClick={() => update((p) => ({ ...p, public_records: { ...p.public_records, properties: [...(p.public_records?.properties || []), { type: "", address: "", value: "", source: "" }] } }))} />
      </div>

      <div className="surface p-6">
        <span className="sub-label block mb-3">Corporate Filings</span>
        {(pr.corporate_filings || []).map((filing, i) => (
          <CorporateFilingCard key={i} filing={filing} index={i} corpHandlers={corpHandlers} update={update} />
        ))}
        <AddBtn label="Add Filing" onClick={() => update((p) => ({ ...p, public_records: { ...p.public_records, corporate_filings: [...(p.public_records?.corporate_filings || []), { entity: "", role: "", jurisdiction: "", source: "" }] } }))} />
      </div>

      <div className="surface p-6">
        <span className="sub-label block mb-3">Court Records</span>
        {(pr.court_records || []).map((rec, i) => (
          <div key={i} className={`entry-card relative ${rec._aiExtracted ? "ai-extracted" : ""}`}>
            <SourceTag source={rec.source} />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
              <FormField label="Type">
                <input className="form-input" value={rec.type || ""} onChange={(e) => courtHandlers.set(i, "type", e.target.value)} placeholder="e.g., Civil" />
              </FormField>
              <FormField label="Case">
                <input className="form-input" value={rec.case || ""} onChange={(e) => courtHandlers.set(i, "case", e.target.value)} />
              </FormField>
              <FormField label="Jurisdiction">
                <input className="form-input" value={rec.jurisdiction || ""} onChange={(e) => courtHandlers.set(i, "jurisdiction", e.target.value)} />
              </FormField>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <FormField label="Summary">
                <input className="form-input" value={rec.summary || ""} onChange={(e) => courtHandlers.set(i, "summary", e.target.value)} />
              </FormField>
              <FormField label="Source">
                <input className="form-input" value={rec.source || ""} onChange={(e) => courtHandlers.set(i, "source", e.target.value)} placeholder="e.g., PACER" />
              </FormField>
            </div>
            <div className="mt-2 flex justify-end">
              <RemoveBtn onClick={() => courtHandlers.remove(i)} />
            </div>
          </div>
        ))}
        <AddBtn label="Add Court Record" onClick={() => update((p) => ({ ...p, public_records: { ...p.public_records, court_records: [...(p.public_records?.court_records || []), { type: "", case: "", jurisdiction: "", summary: "", source: "" }] } }))} />
      </div>

      <div className="surface p-6">
        <span className="sub-label block mb-3">Political Donations</span>
        {(pr.political_donations || []).map((don, i) => (
          <div key={i} className={`entry-card relative ${don._aiExtracted ? "ai-extracted" : ""}`}>
            <SourceTag source={don.source} />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <FormField label="Recipient">
                <input className="form-input" value={don.recipient || ""} onChange={(e) => donationHandlers.set(i, "recipient", e.target.value)} />
              </FormField>
              <FormField label="Amount">
                <input className="form-input" value={don.amount || ""} onChange={(e) => donationHandlers.set(i, "amount", e.target.value)} />
              </FormField>
              <FormField label="Date">
                <input className="form-input" value={don.date || ""} onChange={(e) => donationHandlers.set(i, "date", e.target.value)} />
              </FormField>
              <FormField label="Source">
                <input className="form-input" value={don.source || ""} onChange={(e) => donationHandlers.set(i, "source", e.target.value)} />
              </FormField>
            </div>
            <div className="mt-2 flex justify-end">
              <RemoveBtn onClick={() => donationHandlers.remove(i)} />
            </div>
          </div>
        ))}
        <AddBtn label="Add Donation" onClick={() => update((p) => ({ ...p, public_records: { ...p.public_records, political_donations: [...(p.public_records?.political_donations || []), { recipient: "", amount: "", date: "", source: "" }] } }))} />
      </div>
    </div>
  );
}

// ── Section: Behavioral ──

function BehavioralSection({ profile, update, aiFields }) {
  const beh = profile.behavioral || {};

  function setRoutine(idx, field, value) {
    update((p) => {
      const next = [...(p.behavioral?.routines || [])];
      next[idx] = { ...next[idx], [field]: value };
      return { ...p, behavioral: { ...p.behavioral, routines: next } };
    });
  }
  function removeRoutine(idx) {
    update((p) => ({ ...p, behavioral: { ...p.behavioral, routines: p.behavioral.routines.filter((_, i) => i !== idx) } }));
  }
  function addRoutine() {
    update((p) => ({
      ...p,
      behavioral: { ...p.behavioral, routines: [...(p.behavioral?.routines || []), { name: "", description: "", schedule: "", consistency: null, location: "", data_source: "", notes: "" }] },
    }));
  }

  function setTravel(idx, field, value) {
    update((p) => {
      const next = [...(p.behavioral?.travel_patterns || [])];
      next[idx] = { ...next[idx], [field]: value };
      return { ...p, behavioral: { ...p.behavioral, travel_patterns: next } };
    });
  }
  function removeTravel(idx) {
    update((p) => ({ ...p, behavioral: { ...p.behavioral, travel_patterns: p.behavioral.travel_patterns.filter((_, i) => i !== idx) } }));
  }
  function addTravel() {
    update((p) => ({
      ...p,
      behavioral: { ...p.behavioral, travel_patterns: [...(p.behavioral?.travel_patterns || []), { pattern: "", frequency: "", data_source: "", notes: "" }] },
    }));
  }

  return (
    <div className="space-y-6">
      <div className="surface p-6">
        <span className="sub-label block mb-3">Routines</span>
        {(beh.routines || []).map((r, i) => (
          <div key={i} className={`entry-card relative ${r._aiExtracted ? "ai-extracted" : ""}`}>
            <SourceTag source={r.data_source} />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
              <FormField label="Name">
                <input className="form-input" value={r.name || ""} onChange={(e) => setRoutine(i, "name", e.target.value)} placeholder="e.g., Morning Run" />
              </FormField>
              <FormField label="Schedule">
                <input className="form-input" value={r.schedule || ""} onChange={(e) => setRoutine(i, "schedule", e.target.value)} placeholder="e.g., Mon-Fri, 6:15 AM" />
              </FormField>
            </div>
            <FormField label="Description" className="mb-3">
              <input className="form-input" value={r.description || ""} onChange={(e) => setRoutine(i, "description", e.target.value)} />
            </FormField>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
              <FormField label="Consistency (0-100%)">
                <div className="flex items-center gap-3">
                  <input className="form-input" type="number" min="0" max="100" value={r.consistency != null ? Math.round(r.consistency * (r.consistency <= 1 ? 100 : 1)) : ""} onChange={(e) => setRoutine(i, "consistency", e.target.value ? parseFloat(e.target.value) / 100 : null)} />
                  {r.consistency != null && (
                    <div className="w-20 h-1.5 rounded-full shrink-0" style={{ background: "#1a1a1a" }}>
                      <div className="h-full rounded-full" style={{ width: `${Math.round(r.consistency * (r.consistency <= 1 ? 100 : 1))}%`, background: "#09BC8A" }} />
                    </div>
                  )}
                </div>
              </FormField>
              <FormField label="Location">
                <input className="form-input" value={r.location || ""} onChange={(e) => setRoutine(i, "location", e.target.value)} />
              </FormField>
              <FormField label="Data Source">
                <input className="form-input" value={r.data_source || ""} onChange={(e) => setRoutine(i, "data_source", e.target.value)} placeholder="e.g., Strava" />
              </FormField>
            </div>
            <FormField label="Notes">
              <input className="form-input" value={r.notes || ""} onChange={(e) => setRoutine(i, "notes", e.target.value)} />
            </FormField>
            <div className="mt-2 flex justify-end">
              <RemoveBtn onClick={() => removeRoutine(i)} />
            </div>
          </div>
        ))}
        <AddBtn label="Add Routine" onClick={addRoutine} />
      </div>

      <div className="surface p-6">
        <span className="sub-label block mb-3">Travel Patterns</span>
        {(beh.travel_patterns || []).map((t, i) => (
          <div key={i} className={`entry-card relative ${t._aiExtracted ? "ai-extracted" : ""}`}>
            <SourceTag source={t.data_source} />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
              <FormField label="Pattern">
                <input className="form-input" value={t.pattern || ""} onChange={(e) => setTravel(i, "pattern", e.target.value)} placeholder="e.g., Weekend trips to Carmel" />
              </FormField>
              <FormField label="Frequency">
                <input className="form-input" value={t.frequency || ""} onChange={(e) => setTravel(i, "frequency", e.target.value)} placeholder="e.g., Every 3-4 weeks" />
              </FormField>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <FormField label="Data Source">
                <input className="form-input" value={t.data_source || ""} onChange={(e) => setTravel(i, "data_source", e.target.value)} />
              </FormField>
              <FormField label="Notes">
                <input className="form-input" value={t.notes || ""} onChange={(e) => setTravel(i, "notes", e.target.value)} />
              </FormField>
            </div>
            <div className="mt-2 flex justify-end">
              <RemoveBtn onClick={() => removeTravel(i)} />
            </div>
          </div>
        ))}
        <AddBtn label="Add Travel Pattern" onClick={addTravel} />
      </div>
    </div>
  );
}

// ── Section: Notes ──

function NotesSection({ profile, update }) {
  const notes = profile.notes || {};

  function setGeneral(value) {
    update((p) => ({ ...p, notes: { ...p.notes, general: value } }));
  }

  function setSource(idx, field, value) {
    update((p) => {
      const next = [...(p.notes?.raw_sources || [])];
      next[idx] = { ...next[idx], [field]: value };
      return { ...p, notes: { ...p.notes, raw_sources: next } };
    });
  }
  function removeSource(idx) {
    update((p) => ({ ...p, notes: { ...p.notes, raw_sources: p.notes.raw_sources.filter((_, i) => i !== idx) } }));
  }
  function addSource() {
    update((p) => ({
      ...p,
      notes: { ...p.notes, raw_sources: [...(p.notes?.raw_sources || []), { source: "", url: "", notes: "" }] },
    }));
  }

  return (
    <div className="space-y-6">
      <div className="surface p-6">
        <FormField label="General Notes">
          <textarea
            className="form-input"
            rows={6}
            value={notes.general || ""}
            onChange={(e) => setGeneral(e.target.value)}
            placeholder="Free-form notes, observations, analysis..."
          />
        </FormField>
      </div>

      <div className="surface p-6">
        <span className="sub-label block mb-3">Source References</span>
        {(notes.raw_sources || []).map((src, i) => (
          <div key={i} className="entry-card">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
              <FormField label="Source">
                <input className="form-input" value={src.source || ""} onChange={(e) => setSource(i, "source", e.target.value)} placeholder="e.g., Spokeo search — Feb 20, 2026" />
              </FormField>
              <FormField label="URL">
                <input className="form-input" value={src.url || ""} onChange={(e) => setSource(i, "url", e.target.value)} />
              </FormField>
            </div>
            <FormField label="Notes">
              <input className="form-input" value={src.notes || ""} onChange={(e) => setSource(i, "notes", e.target.value)} />
            </FormField>
            <div className="mt-2 flex justify-end">
              <RemoveBtn onClick={() => removeSource(i)} />
            </div>
          </div>
        ))}
        <AddBtn label="Add Source" onClick={addSource} />
      </div>
    </div>
  );
}

// ── Utils ──

function deepMerge(target, source) {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    if (source[key] && typeof source[key] === "object" && !Array.isArray(source[key]) && target[key] && typeof target[key] === "object" && !Array.isArray(target[key])) {
      result[key] = deepMerge(target[key], source[key]);
    } else {
      result[key] = source[key];
    }
  }
  return result;
}
