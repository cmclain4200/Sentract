import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, X, Briefcase, Users, BarChart3, MoreVertical, Eye, EyeOff, Trash2, AlertTriangle } from "lucide-react";
import { supabase } from "../lib/supabase";
import { syncRelationships } from "../lib/relationshipSync";
import { useAuth } from "../contexts/AuthContext";
import SectionHeader from "../components/common/SectionHeader";

const CASE_TYPES = [
  { value: "EP", label: "Executive Protection", color: "#09BC8A" },
  { value: "CT", label: "Counter-Threat", color: "#f59e0b" },
  { value: "CI", label: "Corporate Intel", color: "#3b82f6" },
];

export default function Dashboard() {
  const [cases, setCases] = useState([]);
  const [aegisScores, setAegisScores] = useState({});
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showHidden, setShowHidden] = useState(false);
  const [caseMenu, setCaseMenu] = useState(null); // case id with open menu
  const [confirmDelete, setConfirmDelete] = useState(null); // case object to confirm delete
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    fetchCases();
  }, []);

  async function fetchCases() {
    const { data, error } = await supabase
      .from("cases")
      .select("*, subjects(id, name, data_completeness)")
      .order("created_at", { ascending: false });
    if (!error) {
      setCases(data || []);
      // Fetch latest Aegis scores for all subjects
      const subjectIds = (data || []).flatMap((c) => (c.subjects || []).map((s) => s.id));
      if (subjectIds.length > 0) {
        const { data: scores } = await supabase
          .from("assessments")
          .select("subject_id, score_data")
          .eq("module", "aegis_score")
          .in("subject_id", subjectIds)
          .order("created_at", { ascending: false });
        if (scores) {
          const map = {};
          for (const s of scores) {
            // First match per subject_id is the latest (ordered desc)
            if (!map[s.subject_id] && s.score_data?.composite != null) {
              map[s.subject_id] = s.score_data.composite;
            }
          }
          setAegisScores(map);
        }
      }
    }
    setLoading(false);
  }

  async function hideCase(id) {
    await supabase.from("cases").update({ status: "archived" }).eq("id", id);
    setCases((prev) => prev.map((c) => (c.id === id ? { ...c, status: "archived" } : c)));
    setCaseMenu(null);
  }

  async function unhideCase(id) {
    await supabase.from("cases").update({ status: "active" }).eq("id", id);
    setCases((prev) => prev.map((c) => (c.id === id ? { ...c, status: "active" } : c)));
    setCaseMenu(null);
  }

  async function deleteCase(id) {
    await supabase.from("cases").delete().eq("id", id);
    setCases((prev) => prev.filter((c) => c.id !== id));
    setConfirmDelete(null);
    setCaseMenu(null);
  }

  function typeColor(type) {
    return CASE_TYPES.find((t) => t.value === type)?.color || "#888";
  }

  const hiddenCount = cases.filter((c) => c.status === "archived").length;
  const visibleCases = showHidden ? cases : cases.filter((c) => c.status !== "archived");

  const stats = useMemo(() => {
    const activeCases = cases.filter((c) => c.status !== "archived");
    if (!activeCases.length) return null;
    const totalCases = activeCases.length;
    let totalSubjects = 0;
    let completenessSum = 0;
    let completenessCount = 0;
    for (const c of activeCases) {
      const subs = c.subjects || [];
      totalSubjects += subs.length;
      for (const s of subs) {
        if (s.data_completeness != null) {
          completenessSum += s.data_completeness;
          completenessCount++;
        }
      }
    }
    const avgCompleteness = completenessCount > 0 ? Math.round(completenessSum / completenessCount) : 0;
    return { totalCases, totalSubjects, avgCompleteness };
  }, [cases]);

  return (
    <div className="h-full overflow-y-auto" style={{ padding: "32px" }}>
      <div className="max-w-5xl mx-auto">
        {/* Header row: title + new case button */}
        <div className="flex items-start justify-between mb-6">
          <SectionHeader label="Dashboard" title="Cases" />
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 rounded-md text-[15px] font-semibold transition-all duration-200 cursor-pointer"
            style={{ background: "#09BC8A", color: "#0a0a0a", border: "none", padding: "12px 28px", minHeight: 44 }}
          >
            <Plus size={17} />
            New Case
          </button>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 justify-center py-20">
            <span className="pulse-dot" />
            <span className="pulse-dot" />
            <span className="pulse-dot" />
          </div>
        ) : visibleCases.length === 0 && hiddenCount === 0 ? (
          <div className="surface text-center" style={{ padding: "48px 32px" }}>
            <Briefcase size={44} color="#333" className="mx-auto mb-4" />
            <div className="text-[20px] text-white font-semibold mb-3">No cases yet</div>
            <div className="text-[15px] mb-8" style={{ color: "#555" }}>
              Create your first case to get started.
            </div>
            <button
              onClick={() => setShowCreate(true)}
              className="rounded-md text-[15px] font-semibold cursor-pointer"
              style={{ background: "#09BC8A", color: "#0a0a0a", border: "none", padding: "14px 32px", minHeight: 48 }}
            >
              Create Case
            </button>
          </div>
        ) : (
          <>
            {/* Stats Strip */}
            {stats && (
              <div className="flex items-center gap-6 pb-5 mb-6" style={{ borderBottom: "1px solid #1e1e1e" }}>
                <div className="flex items-center gap-2.5">
                  <Briefcase size={14} color="#09BC8A" />
                  <span className="text-[15px] font-semibold text-white">{stats.totalCases}</span>
                  <span className="text-[12px] font-mono" style={{ color: "#555" }}>Total Cases</span>
                </div>
                <span style={{ color: "#2a2a2a" }}>·</span>
                <div className="flex items-center gap-2.5">
                  <Users size={14} color="#3b82f6" />
                  <span className="text-[15px] font-semibold text-white">{stats.totalSubjects}</span>
                  <span className="text-[12px] font-mono" style={{ color: "#555" }}>Active Subjects</span>
                </div>
                <span style={{ color: "#2a2a2a" }}>·</span>
                <div className="flex items-center gap-2.5">
                  <BarChart3 size={14} color={stats.avgCompleteness >= 70 ? "#10b981" : stats.avgCompleteness >= 40 ? "#f59e0b" : "#ef4444"} />
                  <span className="text-[15px] font-semibold text-white">{stats.avgCompleteness}%</span>
                  <span className="text-[12px] font-mono" style={{ color: "#555" }}>Avg Completeness</span>
                </div>
                {hiddenCount > 0 && (
                  <>
                    <span style={{ color: "#2a2a2a" }}>·</span>
                    <button
                      onClick={() => setShowHidden(!showHidden)}
                      className="flex items-center gap-1.5 text-[12px] font-mono cursor-pointer transition-colors"
                      style={{ background: "transparent", border: "none", color: showHidden ? "#09BC8A" : "#444" }}
                    >
                      {showHidden ? <EyeOff size={12} /> : <Eye size={12} />}
                      {hiddenCount} hidden
                    </button>
                  </>
                )}
              </div>
            )}

            {visibleCases.length === 0 && hiddenCount > 0 && (
              <div className="surface text-center" style={{ padding: "32px" }}>
                <EyeOff size={32} color="#333" className="mx-auto mb-3" />
                <div className="text-[15px] mb-3" style={{ color: "#555" }}>All cases are hidden.</div>
                <button
                  onClick={() => setShowHidden(true)}
                  className="text-[13px] cursor-pointer"
                  style={{ background: "transparent", border: "1px solid #333", color: "#888", padding: "8px 16px", borderRadius: 6 }}
                >
                  Show hidden cases
                </button>
              </div>
            )}

            {/* Case Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {visibleCases.map((c) => {
                const subs = c.subjects || [];
                const subCount = subs.length;
                const avgComp = subCount > 0
                  ? Math.round(subs.reduce((sum, s) => sum + (s.data_completeness || 0), 0) / subCount)
                  : 0;
                const primarySubject = subs[0];
                // Best Aegis score across subjects in this case
                let bestAegis = null;
                for (const s of subs) {
                  const score = aegisScores[s.id];
                  if (score != null && (bestAegis == null || score > bestAegis)) bestAegis = score;
                }

                const isHidden = c.status === "archived";

                return (
                  <div
                    key={c.id}
                    className="surface text-left transition-all duration-200 flex flex-col cursor-pointer"
                    style={{
                      background: "#111",
                      border: `1px solid ${isHidden ? "#1a1a1a" : "#1e1e1e"}`,
                      padding: "20px 22px",
                      minHeight: 160,
                      opacity: isHidden ? 0.5 : 1,
                      position: "relative",
                      zIndex: caseMenu === c.id ? 50 : undefined,
                    }}
                    onClick={() => navigate(`/case/${c.id}/profile`)}
                    onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#333")}
                    onMouseLeave={(e) => (e.currentTarget.style.borderColor = isHidden ? "#1a1a1a" : "#1e1e1e")}
                  >
                    {/* Top row: type badge + aegis score + menu */}
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span
                          className="badge"
                          style={{
                            color: typeColor(c.type),
                            background: `${typeColor(c.type)}18`,
                            border: `1px solid ${typeColor(c.type)}35`,
                            fontSize: 11,
                            padding: "3px 8px",
                          }}
                        >
                          {c.type}
                        </span>
                        {isHidden && (
                          <span className="text-[10px] font-mono" style={{ color: "#555" }}>HIDDEN</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {bestAegis != null && (
                          <span
                            className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded"
                            style={{
                              color: bestAegis >= 75 ? "#ef4444" : bestAegis >= 55 ? "#f59e0b" : bestAegis >= 35 ? "#3b82f6" : "#09BC8A",
                              background: bestAegis >= 75 ? "rgba(239,68,68,0.1)" : bestAegis >= 55 ? "rgba(245,158,11,0.1)" : bestAegis >= 35 ? "rgba(59,130,246,0.1)" : "rgba(9,188,138,0.1)",
                              border: `1px solid ${bestAegis >= 75 ? "rgba(239,68,68,0.2)" : bestAegis >= 55 ? "rgba(245,158,11,0.2)" : bestAegis >= 35 ? "rgba(59,130,246,0.2)" : "rgba(9,188,138,0.2)"}`,
                            }}
                          >
                            {bestAegis}
                          </span>
                        )}
                        <div className="relative z-10">
                          <button
                            onClick={(e) => { e.stopPropagation(); setCaseMenu(caseMenu === c.id ? null : c.id); }}
                            className="flex items-center justify-center rounded cursor-pointer transition-colors"
                            style={{ background: "transparent", border: "none", width: 28, height: 28 }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = "#1a1a1a")}
                            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                          >
                            <MoreVertical size={14} color="#555" />
                          </button>
                          {caseMenu === c.id && (
                            <div
                              className="absolute right-0 top-full mt-1 w-[180px] rounded-md overflow-hidden z-50 fade-in"
                              style={{ background: "#111", border: "1px solid #222", boxShadow: "0 8px 32px rgba(0,0,0,0.6)" }}
                            >
                              <button
                                onClick={(e) => { e.stopPropagation(); isHidden ? unhideCase(c.id) : hideCase(c.id); }}
                                className="w-full flex items-center gap-2.5 px-4 text-left transition-all duration-150 cursor-pointer"
                                style={{ background: "transparent", border: "none", minHeight: 40, padding: "0 16px", color: "#888" }}
                                onMouseEnter={(e) => (e.currentTarget.style.background = "#1a1a1a")}
                                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                              >
                                {isHidden ? <Eye size={14} /> : <EyeOff size={14} />}
                                <span className="text-[13px]">{isHidden ? "Unhide" : "Hide"}</span>
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); setConfirmDelete(c); setCaseMenu(null); }}
                                className="w-full flex items-center gap-2.5 px-4 text-left transition-all duration-150 cursor-pointer"
                                style={{ background: "transparent", border: "none", minHeight: 40, padding: "0 16px", color: "#ef4444" }}
                                onMouseEnter={(e) => (e.currentTarget.style.background = "#1a1a1a")}
                                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                              >
                                <Trash2 size={14} />
                                <span className="text-[13px]">Delete</span>
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Title */}
                    <div className="text-white font-semibold text-[16px] mb-1 leading-snug">{c.name}</div>

                    {/* Primary subject name */}
                    {primarySubject?.name && primarySubject.name !== c.name && (
                      <div className="text-[13px] mb-1" style={{ color: "#666" }}>{primarySubject.name}</div>
                    )}

                    {/* Description */}
                    {c.description && (
                      <div className="text-[13px] line-clamp-2 mb-auto" style={{ color: "#555" }}>
                        {c.description}
                      </div>
                    )}

                    {/* Spacer to push bottom row down */}
                    <div className="flex-1" />

                    {/* Bottom row: subjects, completeness bar, date */}
                    <div className="flex items-center gap-3 mt-4 pt-3" style={{ borderTop: "1px solid #1a1a1a" }}>
                      <span className="text-[11px] font-mono shrink-0" style={{ color: "#555" }}>
                        {subCount} subj
                      </span>
                      {subCount > 0 && (
                        <div className="flex items-center gap-1.5 flex-1">
                          <div className="flex-1 h-1.5 rounded-full" style={{ background: "#1a1a1a" }}>
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${avgComp}%`,
                                background: avgComp >= 70 ? "#10b981" : avgComp >= 40 ? "#f59e0b" : "#ef4444",
                                transition: "width 0.4s ease",
                              }}
                            />
                          </div>
                          <span className="text-[10px] font-mono" style={{ color: "#555" }}>{avgComp}%</span>
                        </div>
                      )}
                      <span className="text-[11px] font-mono shrink-0" style={{ color: "#444" }}>
                        {new Date(c.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Close case menu on outside click */}
      {caseMenu && (
        <div className="fixed inset-0 z-40" onClick={() => setCaseMenu(null)} />
      )}

      {/* Delete confirmation modal */}
      {confirmDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.7)" }}
          onClick={() => setConfirmDelete(null)}
        >
          <div
            className="surface w-full fade-in"
            style={{ maxWidth: 420, padding: "28px 32px" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="flex items-center justify-center w-10 h-10 rounded-full" style={{ background: "rgba(239,68,68,0.1)" }}>
                <AlertTriangle size={20} color="#ef4444" />
              </div>
              <div>
                <h3 className="text-white text-[18px] font-semibold">Delete Case</h3>
                <p className="text-[13px] mt-0.5" style={{ color: "#666" }}>This action cannot be undone.</p>
              </div>
            </div>
            <p className="text-[14px] mb-6" style={{ color: "#888" }}>
              Permanently delete <span className="text-white font-semibold">{confirmDelete.name}</span> and all associated subjects, assessments, and uploads? This data cannot be recovered.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => deleteCase(confirmDelete.id)}
                className="flex-1 rounded text-[14px] font-semibold cursor-pointer"
                style={{ background: "#ef4444", color: "#fff", border: "none", padding: "12px 24px", minHeight: 44 }}
              >
                Delete Permanently
              </button>
              <button
                onClick={() => setConfirmDelete(null)}
                className="rounded text-[14px] cursor-pointer"
                style={{ background: "transparent", border: "1px solid #333", color: "#888", padding: "10px 20px", minHeight: 44 }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {showCreate && (
        <CreateCaseModal
          onClose={() => setShowCreate(false)}
          onCreated={(newCase) => {
            setShowCreate(false);
            navigate(`/case/${newCase.id}/profile`);
          }}
          userId={user?.id}
        />
      )}
    </div>
  );
}

function CreateCaseModal({ onClose, onCreated, userId }) {
  const [name, setName] = useState("");
  const [clientName, setClientName] = useState("");
  const [type, setType] = useState("EP");
  const [description, setDescription] = useState("");
  const [autoCreateSubject, setAutoCreateSubject] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { data, error: err } = await supabase
      .from("cases")
      .insert({
        name,
        type,
        description: description || null,
        client_name: clientName || null,
      })
      .select()
      .single();

    if (err) {
      setError(err.message);
      setLoading(false);
      return;
    }

    if (autoCreateSubject && data) {
      const { data: subjectData } = await supabase
        .from("subjects")
        .insert({ case_id: data.id, name: name })
        .select()
        .single();

      // Fire-and-forget: sync relationships for auto-created subject
      if (subjectData && userId) {
        syncRelationships(subjectData, userId);
      }
    }

    onCreated(data);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.7)" }}
      onClick={onClose}
    >
      <div
        className="surface w-full fade-in"
        style={{ maxWidth: 480, padding: "28px 32px" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-7">
          <div>
            <span className="section-label">New Case</span>
            <h2 className="text-white text-[22px] font-semibold mt-1">Create Case</h2>
          </div>
          <button
            onClick={onClose}
            className="rounded cursor-pointer flex items-center justify-center"
            style={{ background: "transparent", border: "none", width: 36, height: 36 }}
          >
            <X size={18} color="#555" />
          </button>
        </div>

        {error && (
          <div className="mb-5 p-4 rounded text-[14px]" style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", color: "#ef4444" }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div>
            <label className="sub-label block mb-2">Case Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full rounded text-[15px] text-white outline-none"
              style={{ background: "#0d0d0d", border: "1px solid #1e1e1e", padding: "10px 14px", minHeight: 44 }}
              onFocus={(e) => (e.target.style.borderColor = "#333")}
              onBlur={(e) => (e.target.style.borderColor = "#1e1e1e")}
              placeholder="e.g., Mercer EP Assessment"
            />
          </div>
          <div>
            <label className="sub-label block mb-2">Client Name</label>
            <input
              type="text"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              className="w-full rounded text-[15px] text-white outline-none"
              style={{ background: "#0d0d0d", border: "1px solid #1e1e1e", padding: "10px 14px", minHeight: 44 }}
              onFocus={(e) => (e.target.style.borderColor = "#333")}
              onBlur={(e) => (e.target.style.borderColor = "#1e1e1e")}
              placeholder="Optional — e.g., Apex Maritime"
            />
          </div>
          <div>
            <label className="sub-label block mb-2">Type</label>
            <div className="flex gap-3">
              {CASE_TYPES.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setType(t.value)}
                  className="flex-1 rounded text-[13px] font-mono font-semibold transition-all duration-150 cursor-pointer"
                  style={{
                    background: type === t.value ? `${t.color}18` : "#0d0d0d",
                    border: `1px solid ${type === t.value ? t.color + "50" : "#1e1e1e"}`,
                    color: type === t.value ? t.color : "#555",
                    padding: "10px 12px",
                    minHeight: 40,
                  }}
                >
                  {t.value}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="sub-label block mb-2">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full rounded text-[15px] text-white outline-none resize-none"
              style={{ background: "#0d0d0d", border: "1px solid #1e1e1e", padding: "10px 14px" }}
              onFocus={(e) => (e.target.style.borderColor = "#333")}
              onBlur={(e) => (e.target.style.borderColor = "#1e1e1e")}
              placeholder="Optional description..."
            />
          </div>
          <label className="flex items-center gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={autoCreateSubject}
              onChange={(e) => setAutoCreateSubject(e.target.checked)}
              className="accent-[#09BC8A] w-4 h-4"
            />
            <span className="text-[14px]" style={{ color: "#888" }}>
              Auto-create subject from case name
            </span>
          </label>
          <button
            type="submit"
            disabled={loading || !name.trim()}
            className="w-full rounded text-[15px] font-semibold transition-all duration-200 cursor-pointer"
            style={{
              background: loading || !name.trim() ? "#1a1a1a" : "#09BC8A",
              color: loading || !name.trim() ? "#555" : "#0a0a0a",
              border: "none",
              padding: "14px 32px",
              minHeight: 48,
            }}
          >
            {loading ? "Creating..." : "Create Case"}
          </button>
        </form>
      </div>
    </div>
  );
}
