import { useState, useMemo, useRef } from "react";
import { MapPin, Mail, Search, Check, CheckCircle, XCircle, ExternalLink } from "lucide-react";
import FormField from "../components/FormField";
import RemoveBtn from "../components/RemoveBtn";
import AddBtn from "../components/AddBtn";
import SelectField from "../components/SelectField";
import SourceTag from "../components/SourceTag";
import { ADDRESS_TYPES, PHONE_TYPES, EMAIL_TYPES, CONFIDENCE_LEVELS } from "../../../lib/profileSchema";
import { analyzeEmailDomain, formatAddress } from "../../../lib/enrichment/autoEnrich";
import { checkEmailBreaches, isDuplicateBreach } from "../../../lib/enrichment/hibpService";
import { geocodeAddress, hasMapboxToken } from "../../../lib/enrichment/geocoder";

function EmailEntryCard({ email, index, setEmail, removeEmail, addBreachToProfile, setEmailEnrichment, existingBreaches }) {
  const [enrichState, setEnrichState] = useState("idle");
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

      {enrichment?.status === "checked" && enrichState === "idle" && (
        <div className="flex items-center gap-2 mt-2">
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: enrichment.breaches_found > 0 ? "#f59e0b" : "#10b981" }} />
          <span className="text-[10px] font-mono" style={{ color: "#555" }}>
            {enrichment.breaches_found > 0 ? `${enrichment.breaches_found} breach${enrichment.breaches_found > 1 ? "es" : ""}` : "No breaches"}
            {enrichment.last_checked && ` · Checked ${new Date(enrichment.last_checked).toLocaleDateString()}`}
          </span>
          {daysSinceCheck != null && daysSinceCheck > 30 && (
            <button onClick={handleCheckBreaches} className="text-[10px] font-mono cursor-pointer" style={{ background: "transparent", border: "none", color: "#09BC8A" }}>Recheck</button>
          )}
        </div>
      )}

      {email.address && enrichState === "idle" && !enrichResult && (
        <div className="mt-2 flex justify-end">
          <button onClick={handleCheckBreaches} className="flex items-center gap-1.5 text-[11px] font-mono px-2.5 py-1 rounded cursor-pointer transition-all" style={{ background: "transparent", border: "1px solid transparent", color: "#09BC8A" }} onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#2a2a2a")} onMouseLeave={(e) => (e.currentTarget.style.borderColor = "transparent")}>
            <Search size={12} /> Check Breaches
          </button>
        </div>
      )}

      {enrichState === "loading" && (
        <div className="mt-3 flex items-center gap-2">
          <span className="pulse-dot" /><span className="pulse-dot" /><span className="pulse-dot" />
          <span className="text-[11px]" style={{ color: "#888" }}>Checking...</span>
        </div>
      )}

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
              <button onClick={handleCheckBreaches} className="text-[11px] mt-2 cursor-pointer" style={{ background: "transparent", border: "none", color: "#09BC8A" }}>Retry</button>
            </>
          )}
        </div>
      )}

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
                        <button onClick={() => handleAddBreach(b)} className="text-[10px] font-mono shrink-0 cursor-pointer" style={{ background: "transparent", border: "none", color: "#09BC8A" }}>+ Add</button>
                      )}
                    </div>
                  );
                })}
              </div>
              {enrichResult.breaches.some((b) => !isDuplicateBreach(existingBreaches, b) && !addedBreaches.has(b.hibp_name)) && (
                <button onClick={handleAddAll} className="mt-3 text-[11px] font-mono px-3 py-1.5 rounded cursor-pointer transition-all" style={{ background: "transparent", border: "1px solid rgba(9, 188, 138,0.3)", color: "#09BC8A" }}>Add All to Profile</button>
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

export default function LocationsSection({ profile, update, aiFields }) {
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

  function addBreachToProfile(breach) {
    update((p) => ({
      ...p,
      breaches: { ...p.breaches, records: [...(p.breaches?.records || []), breach] },
    }));
  }

  function setEmailEnrichment(idx, enrichment) {
    update((p) => {
      const next = [...(p.contact?.email_addresses || [])];
      next[idx] = { ...next[idx], enrichment };
      return { ...p, contact: { ...p.contact, email_addresses: next } };
    });
  }

  return (
    <div className="space-y-6">
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
              <button onClick={() => triggerGeocode(i)} className="flex items-center gap-1.5 mt-2 text-[11px] font-mono cursor-pointer" style={{ background: "transparent", border: "none", color: "#09BC8A" }}>
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
