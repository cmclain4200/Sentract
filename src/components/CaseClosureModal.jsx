import { useState, useEffect } from "react";
import { CheckCircle, Circle, ChevronRight, X } from "lucide-react";
import { supabase } from "../lib/supabase";

const CLOSURE_REASONS = [
  { value: "completed", label: "Completed" },
  { value: "suspended", label: "Suspended" },
  { value: "client_request", label: "Client Request" },
  { value: "other", label: "Other" },
];

export default function CaseClosureModal({ caseData, subjects, aegisScores, onClose, onClosed }) {
  const [step, setStep] = useState(1);
  const [checks, setChecks] = useState([]);
  const [closureReason, setClosureReason] = useState("completed");
  const [closureNotes, setClosureNotes] = useState("");
  const [loading, setLoading] = useState(false);

  // Build QA checklist on mount
  useEffect(() => {
    async function buildChecklist() {
      const items = [];
      // Check profile completeness
      const primarySubject = subjects?.[0];
      const completeness = primarySubject?.data_completeness || 0;
      items.push({
        id: "completeness",
        label: "Subject profile >40% complete",
        auto: completeness > 40,
        checked: completeness > 40,
      });

      // Check for Aegis score
      let hasAegis = false;
      for (const s of subjects || []) {
        if (aegisScores?.[s.id] != null) { hasAegis = true; break; }
      }
      items.push({
        id: "aegis",
        label: "Aegis Score generated",
        auto: hasAegis,
        checked: hasAegis,
      });

      // Check for Recon Mirror assessment
      let hasRecon = false;
      if (primarySubject?.id) {
        const { data } = await supabase
          .from("assessments")
          .select("id")
          .eq("subject_id", primarySubject.id)
          .eq("module", "recon_mirror")
          .limit(1);
        hasRecon = data?.length > 0;
      }
      items.push({
        id: "recon",
        label: "Recon Mirror assessment generated",
        auto: hasRecon,
        checked: hasRecon,
      });

      // Check enrichment
      const emails = primarySubject?.profile_data?.contact?.email_addresses || [];
      const enriched = emails.some((e) => e.enrichment?.last_checked);
      items.push({
        id: "enrichment",
        label: "All enrichment sources checked",
        auto: enriched,
        checked: enriched,
      });

      setChecks(items);
    }
    buildChecklist();
  }, [subjects, aegisScores]);

  function toggleCheck(id) {
    setChecks((prev) => prev.map((c) => (c.id === id ? { ...c, checked: !c.checked } : c)));
  }

  async function handleClose() {
    setLoading(true);
    const closureInfo = `\n\n---\nClosure: ${closureReason}${closureNotes ? "\n" + closureNotes : ""}`;
    const newDescription = (caseData.description || "") + closureInfo;
    await supabase.from("cases").update({ status: "closed", description: newDescription }).eq("id", caseData.id);
    setLoading(false);
    onClosed();
  }

  const completedChecks = checks.filter((c) => c.checked).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.7)" }} onClick={onClose}>
      <div className="surface w-full fade-in" style={{ maxWidth: 520, padding: "28px 32px" }} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <span className="section-label">Close Case</span>
            <h2 className="text-white text-[20px] font-semibold mt-1">{caseData?.name}</h2>
          </div>
          <button onClick={onClose} className="rounded cursor-pointer flex items-center justify-center" style={{ background: "transparent", border: "none", width: 36, height: 36 }}>
            <X size={18} color="#555" />
          </button>
        </div>

        {/* Step indicators */}
        <div className="flex items-center gap-2 mb-6">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center gap-2">
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-[12px] font-semibold"
                style={{
                  background: step >= s ? "#09BC8A" : "#1a1a1a",
                  color: step >= s ? "#0a0a0a" : "#555",
                }}
              >
                {s}
              </div>
              {s < 3 && <ChevronRight size={12} color="#333" />}
            </div>
          ))}
          <span className="text-[12px] ml-2" style={{ color: "#555" }}>
            {step === 1 ? "QA Checklist" : step === 2 ? "Closure Notes" : "Confirm"}
          </span>
        </div>

        {/* Step 1: QA Checklist */}
        {step === 1 && (
          <div>
            <p className="text-[13px] mb-4" style={{ color: "#888" }}>
              Review the quality checks below before closing this case.
            </p>
            <div className="space-y-2 mb-6">
              {checks.map((c) => (
                <button
                  key={c.id}
                  onClick={() => toggleCheck(c.id)}
                  className="w-full flex items-center gap-3 p-3 rounded text-left cursor-pointer transition-all"
                  style={{ background: c.checked ? "rgba(9,188,138,0.05)" : "#0d0d0d", border: `1px solid ${c.checked ? "rgba(9,188,138,0.2)" : "#1a1a1a"}` }}
                >
                  {c.checked ? <CheckCircle size={16} color="#09BC8A" /> : <Circle size={16} color="#333" />}
                  <span className="text-[14px]" style={{ color: c.checked ? "#e0e0e0" : "#666" }}>{c.label}</span>
                  {c.auto && <span className="text-[9px] font-mono ml-auto" style={{ color: "#09BC8A" }}>AUTO</span>}
                </button>
              ))}
            </div>
            <div className="text-[12px] mb-4" style={{ color: "#555" }}>
              {completedChecks}/{checks.length} checks passed
            </div>
            <button
              onClick={() => setStep(2)}
              className="w-full rounded text-[14px] font-semibold cursor-pointer"
              style={{ background: "#09BC8A", color: "#0a0a0a", border: "none", padding: "12px 24px", minHeight: 44 }}
            >
              Continue
            </button>
          </div>
        )}

        {/* Step 2: Closure Notes */}
        {step === 2 && (
          <div>
            <div className="mb-4">
              <label className="sub-label block mb-2">Closure Reason</label>
              <select
                value={closureReason}
                onChange={(e) => setClosureReason(e.target.value)}
                className="w-full rounded text-[14px] text-white outline-none cursor-pointer"
                style={{ background: "#0d0d0d", border: "1px solid #1e1e1e", padding: "10px 14px", minHeight: 40 }}
              >
                {CLOSURE_REASONS.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </div>
            <div className="mb-6">
              <label className="sub-label block mb-2">Closure Notes</label>
              <textarea
                value={closureNotes}
                onChange={(e) => setClosureNotes(e.target.value)}
                rows={4}
                className="w-full rounded text-[14px] text-white outline-none resize-none"
                style={{ background: "#0d0d0d", border: "1px solid #1e1e1e", padding: "10px 14px" }}
                placeholder="Final notes, findings summary, or handoff details..."
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setStep(1)}
                className="rounded text-[14px] cursor-pointer"
                style={{ background: "transparent", border: "1px solid #333", color: "#888", padding: "10px 20px", minHeight: 44 }}
              >
                Back
              </button>
              <button
                onClick={() => setStep(3)}
                className="flex-1 rounded text-[14px] font-semibold cursor-pointer"
                style={{ background: "#09BC8A", color: "#0a0a0a", border: "none", padding: "12px 24px", minHeight: 44 }}
              >
                Continue
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Confirm */}
        {step === 3 && (
          <div>
            <div className="p-4 rounded mb-6" style={{ background: "#0d0d0d", border: "1px solid #1a1a1a" }}>
              <div className="text-[13px] mb-2" style={{ color: "#888" }}>
                <span className="font-semibold text-white">Case:</span> {caseData?.name}
              </div>
              <div className="text-[13px] mb-2" style={{ color: "#888" }}>
                <span className="font-semibold text-white">Reason:</span> {CLOSURE_REASONS.find((r) => r.value === closureReason)?.label}
              </div>
              <div className="text-[13px] mb-2" style={{ color: "#888" }}>
                <span className="font-semibold text-white">QA Checks:</span> {completedChecks}/{checks.length} passed
              </div>
              {closureNotes && (
                <div className="text-[13px]" style={{ color: "#888" }}>
                  <span className="font-semibold text-white">Notes:</span> {closureNotes.slice(0, 100)}{closureNotes.length > 100 ? "..." : ""}
                </div>
              )}
            </div>
            <p className="text-[13px] mb-6" style={{ color: "#f59e0b" }}>
              This will mark the case as closed. You can reopen it later from the case view.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setStep(2)}
                className="rounded text-[14px] cursor-pointer"
                style={{ background: "transparent", border: "1px solid #333", color: "#888", padding: "10px 20px", minHeight: 44 }}
              >
                Back
              </button>
              <button
                onClick={handleClose}
                disabled={loading}
                className="flex-1 rounded text-[14px] font-semibold cursor-pointer"
                style={{ background: loading ? "#1a1a1a" : "#ef4444", color: loading ? "#555" : "#fff", border: "none", padding: "12px 24px", minHeight: 44 }}
              >
                {loading ? "Closing..." : "Close Case"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
