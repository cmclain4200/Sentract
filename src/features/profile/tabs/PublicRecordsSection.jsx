import { useState } from "react";
import { Building2, Check } from "lucide-react";
import FormField from "../components/FormField";
import RemoveBtn from "../components/RemoveBtn";
import AddBtn from "../components/AddBtn";
import SourceTag from "../components/SourceTag";
import { searchCompany, getCompanyDetails } from "../../../lib/enrichment/companyLookup";

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

export default function PublicRecordsSection({ profile, update, aiFields }) {
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
