import { useState } from "react";
import { Building2 } from "lucide-react";
import FormField from "../components/FormField";
import RemoveBtn from "../components/RemoveBtn";
import AddBtn from "../components/AddBtn";
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

export default function ProfessionalSection({ profile, update, aiFields }) {
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
