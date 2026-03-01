import { useState, useEffect } from "react";
import { ClipboardCheck, Clock, ChevronDown } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import AssessmentStatusBadge from "../AssessmentStatusBadge";
import AssessmentActions from "../AssessmentActions";
import AssessmentComments from "../AssessmentComments";

const MODULE_LABELS = {
  recon_mirror: "Recon Mirror",
  aegis_score: "Aegis Score",
  pattern_lens: "Pattern Lens",
  crosswire: "CrossWire",
};

const MODULE_PATHS = {
  recon_mirror: "recon",
  aegis_score: "aegis",
  pattern_lens: "patterns",
  crosswire: "crosswire",
};

export default function ReviewQueue() {
  const [assessments, setAssessments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    supabase
      .from("assessments")
      .select("id, type, module, status, narrative_output, score_data, submitted_at, created_at, reviewer_notes, subjects(name, case_id, cases(name))")
      .eq("status", "submitted")
      .order("submitted_at", { ascending: true })
      .limit(20)
      .then(({ data }) => {
        setAssessments(data || []);
        setLoading(false);
      });
  }, []);

  function handleUpdate(updated) {
    setAssessments((prev) => prev.filter((a) => a.id !== updated.id));
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 justify-center py-12">
        <span className="pulse-dot" /><span className="pulse-dot" /><span className="pulse-dot" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-6">
        <ClipboardCheck size={16} color="#f59e0b" />
        <h2 className="text-[18px] font-semibold text-white">Review Queue</h2>
        <span className="text-[12px] font-mono" style={{ color: "#555" }}>
          {assessments.length} pending
        </span>
      </div>

      {assessments.length === 0 ? (
        <div className="surface p-8 text-center">
          <ClipboardCheck size={32} className="mx-auto mb-3" style={{ color: "#333" }} />
          <p className="text-[14px]" style={{ color: "#888" }}>No assessments pending review</p>
          <p className="text-[12px] mt-1" style={{ color: "#555" }}>Assessments submitted by analysts will appear here</p>
        </div>
      ) : (
        <div className="space-y-3">
          {assessments.map((a) => {
            const caseId = a.subjects?.case_id;
            const modulePath = MODULE_PATHS[a.module] || "profile";
            const isExpanded = expandedId === a.id;
            const preview = a.narrative_output
              ? a.narrative_output.slice(0, 200) + (a.narrative_output.length > 200 ? "..." : "")
              : a.score_data
                ? `Composite Score: ${a.score_data.composite || "N/A"}`
                : "No preview available";

            return (
              <div key={a.id} className="surface overflow-hidden">
                {/* Header */}
                <div className="flex items-center gap-4 p-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[14px] font-semibold text-white">{a.subjects?.name || "Unknown"}</span>
                      <AssessmentStatusBadge status={a.status} />
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-[11px] font-mono" style={{ color: "#555" }}>
                        {a.subjects?.cases?.name || "Unknown Case"}
                      </span>
                      <span
                        className="text-[10px] font-mono px-1.5 py-0.5 rounded"
                        style={{ color: "#888", background: "#111", border: "1px solid #1e1e1e" }}
                      >
                        {MODULE_LABELS[a.module] || a.type}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Clock size={10} color="#555" />
                    <span className="text-[10px] font-mono" style={{ color: "#555" }}>
                      {a.submitted_at ? new Date(a.submitted_at).toLocaleDateString() : ""}
                    </span>
                  </div>

                  <button
                    onClick={() => setExpandedId(isExpanded ? null : a.id)}
                    className="p-1.5 rounded cursor-pointer"
                    style={{ background: "transparent", border: "1px solid #1e1e1e" }}
                  >
                    <ChevronDown
                      size={12}
                      color="#555"
                      style={{ transform: isExpanded ? "rotate(180deg)" : "none", transition: "0.2s" }}
                    />
                  </button>

                  <button
                    onClick={() => caseId && navigate(`/case/${caseId}/${modulePath}`)}
                    className="text-[11px] px-3 py-1.5 rounded cursor-pointer"
                    style={{ background: "transparent", border: "1px solid #333", color: "#09BC8A" }}
                  >
                    Open
                  </button>
                </div>

                {/* Expanded preview */}
                {isExpanded && (
                  <div className="px-4 pb-4 fade-in" style={{ borderTop: "1px solid #1a1a1a" }}>
                    <div className="mt-3 p-3 rounded text-[12px]" style={{ background: "#0d0d0d", color: "#888" }}>
                      {preview}
                    </div>
                    <div className="mt-3">
                      <AssessmentActions assessment={a} onUpdate={handleUpdate} />
                    </div>
                    <AssessmentComments assessmentId={a.id} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
