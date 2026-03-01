import { useState, useEffect } from "react";
import { Briefcase, FileDown, Shield, Clock, ChevronDown } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";

export default function ClientPortal() {
  const [cases, setCases] = useState([]);
  const [deliverables, setDeliverables] = useState({});
  const [loading, setLoading] = useState(true);
  const [expandedCase, setExpandedCase] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    async function fetchData() {
      setLoading(true);

      // Fetch cases the client can see (RLS handles access)
      const { data: caseData } = await supabase
        .from("cases")
        .select("id, name, type, status, created_at, updated_at")
        .order("updated_at", { ascending: false });

      setCases(caseData || []);

      // Fetch published assessments for all visible cases
      if (caseData?.length > 0) {
        const { data: assessments } = await supabase
          .from("assessments")
          .select("id, type, module, created_at, published_at, subjects(name, case_id)")
          .eq("status", "published")
          .order("published_at", { ascending: false });

        // Group by case_id
        const grouped = {};
        (assessments || []).forEach((a) => {
          const cid = a.subjects?.case_id;
          if (!cid) return;
          if (!grouped[cid]) grouped[cid] = [];
          grouped[cid].push(a);
        });
        setDeliverables(grouped);
      }

      setLoading(false);
    }

    fetchData();
  }, []);

  const CASE_TYPE_COLORS = {
    EP: "#09BC8A",
    CT: "#f59e0b",
    CI: "#3b82f6",
  };

  const MODULE_LABELS = {
    recon_mirror: "Adversarial Assessment",
    aegis_score: "Risk Score",
    pattern_lens: "Behavioral Analysis",
    crosswire: "Cross-Case Intel",
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 justify-center py-12">
        <span className="pulse-dot" /><span className="pulse-dot" /><span className="pulse-dot" />
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mx-auto" style={{ maxWidth: 800 }}>
        <div className="mb-8">
          <span className="section-label">Client Portal</span>
          <h1 className="page-title mt-1">Your Cases</h1>
          <p className="text-[14px] mt-2" style={{ color: "#555" }}>
            View your assigned cases and published deliverables
          </p>
        </div>

        {cases.length === 0 ? (
          <div className="surface p-8 text-center">
            <Briefcase size={32} className="mx-auto mb-3" style={{ color: "#333" }} />
            <p className="text-[14px]" style={{ color: "#888" }}>No cases assigned to you yet</p>
            <p className="text-[12px] mt-1" style={{ color: "#555" }}>
              Your organization will grant you access to cases when ready
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {cases.map((c) => {
              const caseDeliverables = deliverables[c.id] || [];
              const isExpanded = expandedCase === c.id;
              const typeColor = CASE_TYPE_COLORS[c.type] || "#888";

              return (
                <div key={c.id} className="surface overflow-hidden">
                  <button
                    onClick={() => setExpandedCase(isExpanded ? null : c.id)}
                    className="w-full flex items-center gap-4 p-5 text-left cursor-pointer transition-all"
                    style={{ background: "transparent", border: "none" }}
                  >
                    <Briefcase size={16} color={typeColor} />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-[15px] font-semibold text-white">{c.name}</span>
                        <span
                          className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded"
                          style={{ color: typeColor, background: `${typeColor}15`, border: `1px solid ${typeColor}30` }}
                        >
                          {c.type}
                        </span>
                      </div>
                      <div className="text-[11px] font-mono" style={{ color: "#555" }}>
                        Updated {new Date(c.updated_at).toLocaleDateString()}
                      </div>
                    </div>

                    <span
                      className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded"
                      style={{
                        color: c.status === "active" ? "#09BC8A" : "#ef4444",
                        background: c.status === "active" ? "rgba(9,188,138,0.1)" : "rgba(239,68,68,0.1)",
                        border: `1px solid ${c.status === "active" ? "rgba(9,188,138,0.2)" : "rgba(239,68,68,0.2)"}`,
                      }}
                    >
                      {c.status === "active" ? "ACTIVE" : "CLOSED"}
                    </span>

                    {caseDeliverables.length > 0 && (
                      <span className="text-[11px] font-mono" style={{ color: "#3b82f6" }}>
                        {caseDeliverables.length} deliverable{caseDeliverables.length !== 1 ? "s" : ""}
                      </span>
                    )}

                    <ChevronDown
                      size={14}
                      color="#555"
                      style={{ transform: isExpanded ? "rotate(180deg)" : "none", transition: "0.2s" }}
                    />
                  </button>

                  {isExpanded && (
                    <div className="px-5 pb-5 fade-in" style={{ borderTop: "1px solid #1a1a1a" }}>
                      {caseDeliverables.length === 0 ? (
                        <div className="pt-4 text-center">
                          <p className="text-[13px]" style={{ color: "#555" }}>No published deliverables yet</p>
                        </div>
                      ) : (
                        <div className="pt-4 space-y-2">
                          {caseDeliverables.map((d) => (
                            <div
                              key={d.id}
                              className="flex items-center gap-3 p-3 rounded cursor-pointer transition-all"
                              style={{ background: "#0d0d0d", border: "1px solid #1a1a1a" }}
                              onClick={() => navigate(`/case/${c.id}/${d.module === "recon_mirror" ? "recon" : d.module === "aegis_score" ? "aegis" : d.module === "pattern_lens" ? "patterns" : "profile"}`)}
                              onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#333")}
                              onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#1a1a1a")}
                            >
                              <Shield size={13} color="#3b82f6" />
                              <div className="flex-1">
                                <div className="text-[13px] text-white">
                                  {MODULE_LABELS[d.module] || d.type}
                                </div>
                                <div className="text-[11px] font-mono" style={{ color: "#555" }}>
                                  {d.subjects?.name || "Unknown Subject"}
                                </div>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <Clock size={10} color="#555" />
                                <span className="text-[10px] font-mono" style={{ color: "#555" }}>
                                  {d.published_at ? new Date(d.published_at).toLocaleDateString() : new Date(d.created_at).toLocaleDateString()}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
