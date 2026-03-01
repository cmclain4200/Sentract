import { useMemo } from "react";
import FormField from "../components/FormField";
import RemoveBtn from "../components/RemoveBtn";
import AddBtn from "../components/AddBtn";
import SelectField from "../components/SelectField";
import SourceTag from "../components/SourceTag";
import { SEVERITY_LEVELS } from "../../../lib/profileSchema";
import { analyzeCredentialRisk } from "../../../lib/enrichment/passwordAnalysis";

export default function BreachesSection({ profile, update, aiFields }) {
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
