import { useState, useEffect } from "react";
import { ClipboardCheck, Clock, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";

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

export default function ApprovalQueue() {
  const [assessments, setAssessments] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    supabase
      .from("assessments")
      .select("id, type, module, submitted_at, created_at, subjects(name, case_id, cases(name))")
      .eq("status", "submitted")
      .order("submitted_at", { ascending: true })
      .limit(10)
      .then(({ data }) => {
        setAssessments(data || []);
        setLoading(false);
      });
  }, []);

  if (loading || assessments.length === 0) return null;

  return (
    <div className="surface p-5 mt-6">
      <div className="flex items-center gap-2 mb-4">
        <ClipboardCheck size={14} color="#f59e0b" />
        <span className="section-label text-[10px]">Approval Queue ({assessments.length})</span>
      </div>

      <div className="space-y-2">
        {assessments.map((a) => {
          const caseId = a.subjects?.case_id;
          const modulePath = MODULE_PATHS[a.module] || "profile";

          return (
            <div
              key={a.id}
              className="flex items-center gap-4 px-4 py-3 rounded cursor-pointer transition-all"
              style={{ background: "#0d0d0d", border: "1px solid #1a1a1a" }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#333")}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#1a1a1a")}
              onClick={() => caseId && navigate(`/case/${caseId}/${modulePath}`)}
            >
              <div className="flex-1">
                <div className="text-[13px] text-white">{a.subjects?.name || "Unknown Subject"}</div>
                <div className="text-[11px] font-mono" style={{ color: "#555" }}>
                  {a.subjects?.cases?.name || "Unknown Case"}
                </div>
              </div>
              <span
                className="text-[10px] font-mono px-2 py-0.5 rounded"
                style={{ color: "#f59e0b", background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.2)" }}
              >
                {MODULE_LABELS[a.module] || a.type}
              </span>
              <div className="flex items-center gap-1.5">
                <Clock size={10} color="#555" />
                <span className="text-[10px] font-mono" style={{ color: "#555" }}>
                  {a.submitted_at ? new Date(a.submitted_at).toLocaleDateString() : new Date(a.created_at).toLocaleDateString()}
                </span>
              </div>
              <ArrowRight size={12} color="#555" />
            </div>
          );
        })}
      </div>
    </div>
  );
}
