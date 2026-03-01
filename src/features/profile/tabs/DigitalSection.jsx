import { useState } from "react";
import { Search, CheckCircle, XCircle, ExternalLink, HelpCircle, AlertCircle, Check } from "lucide-react";
import FormField from "../components/FormField";
import RemoveBtn from "../components/RemoveBtn";
import AddBtn from "../components/AddBtn";
import SelectField from "../components/SelectField";
import SourceTag from "../components/SourceTag";
import { VISIBILITY_OPTIONS, SOCIAL_PLATFORMS, BROKER_STATUSES } from "../../../lib/profileSchema";
import { verifySocialProfile } from "../../../lib/enrichment/socialVerify";
import { generateBrokerCheckUrls } from "../../../lib/enrichment/brokerCheck";

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

function BrokerCheckPanel({ profile, update }) {
  const fullName = profile.identity?.full_name;
  const addresses = profile.locations?.addresses || [];
  const firstState = addresses.find((a) => a.state)?.state;

  const [brokerLinks, setBrokerLinks] = useState([]);
  const [generated, setGenerated] = useState(false);
  const [added, setAdded] = useState(false);

  function handleGenerate() {
    const links = generateBrokerCheckUrls(fullName, firstState);
    setBrokerLinks(links);
    setGenerated(true);
  }

  function markBroker(idx, status) {
    setBrokerLinks((prev) => prev.map((b, i) => (i === idx ? { ...b, status } : b)));
    setAdded(false);
  }

  function addResultsToProfile() {
    const checkedLinks = brokerLinks.filter((b) => b.status !== "unchecked");
    if (checkedLinks.length === 0) return;
    update((p) => {
      const existing = p.digital?.data_broker_listings || [];
      const newListings = [...existing];
      for (const b of checkedLinks) {
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
    setAdded(true);
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
              added ? (
                <span className="flex items-center gap-1.5 text-[11px] font-mono px-3 py-1.5" style={{ color: "#10b981" }}>
                  <Check size={12} /> Added to Profile
                </span>
              ) : (
                <button onClick={addResultsToProfile} className="text-[11px] font-mono px-3 py-1.5 rounded cursor-pointer" style={{ background: "transparent", border: "1px solid rgba(9, 188, 138,0.3)", color: "#09BC8A" }}>
                  Add All Results to Profile
                </button>
              )
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function DigitalSection({ profile, update, aiFields }) {
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
