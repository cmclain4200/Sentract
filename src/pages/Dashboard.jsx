import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, X, Briefcase, Users, BarChart3, MoreVertical, Eye, EyeOff, Trash2, AlertTriangle, Target, Upload, ArrowLeft, FileText, Filter, Clock, UserPlus, Shield, Brain, Activity } from "lucide-react";
import { AreaChart, Area, ResponsiveContainer } from "recharts";
import { supabase } from "../lib/supabase";
import { syncRelationships } from "../lib/relationshipSync";
import { useAuth } from "../contexts/AuthContext";
import SectionHeader from "../components/common/SectionHeader";
import BulkImport from "../features/import/BulkImport";
import { CASE_TEMPLATES } from "../lib/caseTemplates";
import { calculateCasePriority, PRIORITY_COLORS } from "../lib/casePriority";

const CASE_TYPES = [
  { value: "EP", label: "Executive Protection", color: "#09BC8A" },
  { value: "CT", label: "Counter-Threat", color: "#f59e0b" },
  { value: "CI", label: "Corporate Intel", color: "#3b82f6" },
];

export default function Dashboard() {
  const [cases, setCases] = useState([]);
  const [aegisScores, setAegisScores] = useState({});
  const [aegisHistory, setAegisHistory] = useState({});
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showHidden, setShowHidden] = useState(false);
  const [caseMenu, setCaseMenu] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [view, setView] = useState("cases");
  const [subjectSort, setSubjectSort] = useState("recent");
  const [showImport, setShowImport] = useState(false);
  const [statusFilter, setStatusFilter] = useState("active");
  const [recentActivity, setRecentActivity] = useState([]);
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    fetchCases();
  }, []);

  async function fetchCases() {
    const { data, error } = await supabase
      .from("cases")
      .select("*, subjects(id, name, data_completeness, profile_data, created_at, updated_at)")
      .order("created_at", { ascending: false });
    if (!error) {
      setCases(data || []);
      // Fetch ALL Aegis scores for all subjects (for sparklines + latest)
      const subjectIds = (data || []).flatMap((c) => (c.subjects || []).map((s) => s.id));
      if (subjectIds.length > 0) {
        const { data: scores } = await supabase
          .from("assessments")
          .select("subject_id, score_data, created_at")
          .eq("module", "aegis_score")
          .in("subject_id", subjectIds)
          .order("created_at", { ascending: false });
        if (scores) {
          const latestMap = {};
          const historyMap = {};
          for (const s of scores) {
            if (s.score_data?.composite != null) {
              if (!latestMap[s.subject_id]) latestMap[s.subject_id] = s.score_data.composite;
              if (!historyMap[s.subject_id]) historyMap[s.subject_id] = [];
              historyMap[s.subject_id].push({ created_at: s.created_at, composite: s.score_data.composite });
            }
          }
          setAegisScores(latestMap);
          setAegisHistory(historyMap);
        }
      }
      // Fetch recent activity from multiple tables
      fetchActivity(data || []);
    }
    setLoading(false);
  }

  async function fetchActivity(casesData) {
    const caseMap = {};
    for (const c of casesData) {
      caseMap[c.id] = c.name;
      for (const s of c.subjects || []) caseMap[s.id] = { caseName: c.name, caseId: c.id };
    }
    const subjectIds = casesData.flatMap((c) => (c.subjects || []).map((s) => s.id));
    const items = [];

    // Case creation events
    for (const c of casesData) {
      items.push({
        id: `case-${c.id}`,
        type: "case_created",
        label: "Case created",
        caseName: c.name,
        caseId: c.id,
        time: c.created_at,
      });
    }

    // Subject creation events
    for (const c of casesData) {
      for (const s of c.subjects || []) {
        items.push({
          id: `subj-${s.id}`,
          type: "subject_added",
          label: `Subject added: ${s.name}`,
          caseName: c.name,
          caseId: c.id,
          time: s.created_at,
        });
      }
    }

    // Recent assessments
    if (subjectIds.length > 0) {
      const { data: assessments } = await supabase
        .from("assessments")
        .select("id, subject_id, module, type, created_at")
        .in("subject_id", subjectIds)
        .order("created_at", { ascending: false })
        .limit(50);
      if (assessments) {
        const moduleLabels = {
          aegis_score: "Aegis Score generated",
          recon_mirror: "Recon Mirror assessment",
          pattern_lens: "Pattern Lens analysis",
          profile_snapshot: "Profile snapshot saved",
        };
        for (const a of assessments) {
          if (a.module === "profile_snapshot") continue;
          const info = caseMap[a.subject_id];
          items.push({
            id: `assess-${a.id}`,
            type: "assessment",
            label: moduleLabels[a.module] || `Assessment: ${a.module}`,
            caseName: info?.caseName || "Unknown",
            caseId: info?.caseId,
            time: a.created_at,
          });
        }
      }
    }

    // Recent uploads
    if (subjectIds.length > 0) {
      const { data: uploads } = await supabase
        .from("uploads")
        .select("id, subject_id, file_name, created_at")
        .in("subject_id", subjectIds)
        .order("created_at", { ascending: false })
        .limit(20);
      if (uploads) {
        for (const u of uploads) {
          const info = caseMap[u.subject_id];
          items.push({
            id: `upload-${u.id}`,
            type: "upload",
            label: `File imported: ${u.file_name}`,
            caseName: info?.caseName || "Unknown",
            caseId: info?.caseId,
            time: u.created_at,
          });
        }
      }
    }

    items.sort((a, b) => new Date(b.time) - new Date(a.time));
    setRecentActivity(items.slice(0, 30));
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
  const filteredByStatus = statusFilter === "all" ? cases : statusFilter === "closed" ? cases.filter((c) => c.status === "closed") : cases.filter((c) => c.status !== "closed");
  const visibleCases = showHidden ? filteredByStatus : filteredByStatus.filter((c) => c.status !== "archived");

  // Priority map for cases
  const casePriorities = useMemo(() => {
    const map = {};
    for (const c of cases) {
      map[c.id] = calculateCasePriority(c, c.subjects, aegisScores);
    }
    return map;
  }, [cases, aegisScores]);

  // Sort visible cases - closed always at bottom unless filtered
  const sortedCases = useMemo(() => {
    if (subjectSort === "priority" && view === "cases") {
      return [...visibleCases].sort((a, b) => {
        if (a.status === "closed" && b.status !== "closed") return 1;
        if (a.status !== "closed" && b.status === "closed") return -1;
        return (casePriorities[b.id]?.score || 0) - (casePriorities[a.id]?.score || 0);
      });
    }
    return [...visibleCases].sort((a, b) => {
      if (statusFilter !== "closed") {
        if (a.status === "closed" && b.status !== "closed") return 1;
        if (a.status !== "closed" && b.status === "closed") return -1;
      }
      return 0;
    });
  }, [visibleCases, subjectSort, view, casePriorities, statusFilter]);

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

  // Build flat subject list from nested case data
  const allSubjects = useMemo(() => {
    const list = [];
    for (const c of cases) {
      if (c.status === "archived") continue;
      for (const s of c.subjects || []) {
        list.push({
          ...s,
          case_id: c.id,
          case_name: c.name,
          case_type: c.type,
          profile_data: s.profile_data || {},
          aegis: aegisScores[s.id] ?? null,
        });
      }
    }
    // Sort
    if (subjectSort === "name") {
      list.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    } else if (subjectSort === "score") {
      list.sort((a, b) => {
        if (a.aegis == null && b.aegis == null) return 0;
        if (a.aegis == null) return 1;
        if (b.aegis == null) return -1;
        return b.aegis - a.aegis;
      });
    } else {
      // recent — by created_at desc
      list.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
    }
    return list;
  }, [cases, aegisScores, subjectSort]);

  const subjectStats = useMemo(() => {
    if (!allSubjects.length) return null;
    const total = allSubjects.length;
    let compSum = 0, compCount = 0, scored = 0;
    for (const s of allSubjects) {
      if (s.data_completeness != null) { compSum += s.data_completeness; compCount++; }
      if (s.aegis != null) scored++;
    }
    const avgComp = compCount > 0 ? Math.round(compSum / compCount) : 0;
    return { total, avgComp, scored };
  }, [allSubjects]);

  function aegisColor(score) {
    if (score >= 75) return "#ef4444";
    if (score >= 55) return "#f97316";
    if (score >= 35) return "#f59e0b";
    return "#09BC8A";
  }

  function activityIcon(type) {
    switch (type) {
      case "case_created": return <Briefcase size={13} color="#09BC8A" />;
      case "subject_added": return <UserPlus size={13} color="#3b82f6" />;
      case "assessment": return <Shield size={13} color="#f59e0b" />;
      case "upload": return <Upload size={13} color="#8b5cf6" />;
      default: return <Clock size={13} color="#555" />;
    }
  }

  function activityIconBg(type) {
    switch (type) {
      case "case_created": return "rgba(9,188,138,0.1)";
      case "subject_added": return "rgba(59,130,246,0.1)";
      case "assessment": return "rgba(245,158,11,0.1)";
      case "upload": return "rgba(139,92,246,0.1)";
      default: return "rgba(255,255,255,0.03)";
    }
  }

  function formatActivityTime(time) {
    const d = new Date(time);
    const now = new Date();
    const diffMs = now - d;
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHrs = Math.floor(diffMins / 60);
    if (diffHrs < 24) return `${diffHrs}h ago`;
    const diffDays = Math.floor(diffHrs / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString();
  }

  function aegisBg(score) {
    if (score >= 75) return "rgba(239,68,68,0.1)";
    if (score >= 55) return "rgba(249,115,22,0.1)";
    if (score >= 35) return "rgba(245,158,11,0.1)";
    return "rgba(9,188,138,0.1)";
  }

  function aegisBorder(score) {
    if (score >= 75) return "rgba(239,68,68,0.25)";
    if (score >= 55) return "rgba(249,115,22,0.25)";
    if (score >= 35) return "rgba(245,158,11,0.25)";
    return "rgba(9,188,138,0.25)";
  }

  return (
    <div className="h-full overflow-y-auto" style={{ padding: "32px" }}>
      <div>
        {/* Header row: title + toggle + new case button */}
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center gap-4">
            <SectionHeader label="Dashboard" title="Cases" />
            <div className="view-toggle" style={{ marginTop: 24 }}>
              <button className={view === "cases" ? "active" : ""} onClick={() => setView("cases")}>Cases</button>
              <button className={view === "subjects" ? "active" : ""} onClick={() => setView("subjects")}>Subjects</button>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowImport(true)}
              className="flex items-center gap-2 rounded-md text-[15px] font-semibold transition-all duration-200 cursor-pointer"
              style={{ background: "transparent", border: "1px solid #333", color: "#888", padding: "12px 22px", minHeight: 44 }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#09BC8A"; e.currentTarget.style.color = "#09BC8A"; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#333"; e.currentTarget.style.color = "#888"; }}
            >
              <Upload size={17} />
              Import
            </button>
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-2 rounded-md text-[15px] font-semibold transition-all duration-200 cursor-pointer"
              style={{ background: "#09BC8A", color: "#0a0a0a", border: "none", padding: "12px 28px", minHeight: 44 }}
            >
              <Plus size={17} />
              New Case
            </button>
          </div>
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
            {view === "cases" && stats && (
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
                <div className="ml-auto flex items-center gap-2">
                  <Filter size={11} color="#444" />
                  {["active", "closed", "all"].map((f) => (
                    <button
                      key={f}
                      onClick={() => setStatusFilter(f)}
                      className="text-[11px] font-mono cursor-pointer px-2 py-1 rounded"
                      style={{ background: statusFilter === f ? "#1a1a1a" : "transparent", border: "none", color: statusFilter === f ? "#09BC8A" : "#444" }}
                    >
                      {f.charAt(0).toUpperCase() + f.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {view === "subjects" && subjectStats && (
              <div className="flex items-center gap-6 pb-5 mb-6" style={{ borderBottom: "1px solid #1e1e1e" }}>
                <div className="flex items-center gap-2.5">
                  <Users size={14} color="#3b82f6" />
                  <span className="text-[15px] font-semibold text-white">{subjectStats.total}</span>
                  <span className="text-[12px] font-mono" style={{ color: "#555" }}>Total Subjects</span>
                </div>
                <span style={{ color: "#2a2a2a" }}>·</span>
                <div className="flex items-center gap-2.5">
                  <BarChart3 size={14} color={subjectStats.avgComp >= 70 ? "#10b981" : subjectStats.avgComp >= 40 ? "#f59e0b" : "#ef4444"} />
                  <span className="text-[15px] font-semibold text-white">{subjectStats.avgComp}%</span>
                  <span className="text-[12px] font-mono" style={{ color: "#555" }}>Avg Completeness</span>
                </div>
                <span style={{ color: "#2a2a2a" }}>·</span>
                <div className="flex items-center gap-2.5">
                  <Target size={14} color="#09BC8A" />
                  <span className="text-[15px] font-semibold text-white">{subjectStats.scored}</span>
                  <span className="text-[12px] font-mono" style={{ color: "#555" }}>Scored (Aegis)</span>
                </div>
                {/* Sort dropdown */}
                <div className="ml-auto flex items-center gap-2">
                  <span className="text-[11px] font-mono" style={{ color: "#444" }}>Sort:</span>
                  <select
                    value={subjectSort}
                    onChange={(e) => setSubjectSort(e.target.value)}
                    className="text-[12px] font-mono cursor-pointer outline-none"
                    style={{
                      background: "#111",
                      border: "1px solid #1e1e1e",
                      color: "#888",
                      padding: "4px 8px",
                      borderRadius: 4,
                    }}
                  >
                    <option value="recent">Recent</option>
                    <option value="name">Name</option>
                    <option value="score">Score</option>
                  </select>
                </div>
              </div>
            )}

            {view === "cases" && visibleCases.length === 0 && hiddenCount > 0 && (
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
            {view === "cases" && <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {sortedCases.map((c) => {
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
                      padding: "24px 26px",
                      minHeight: 190,
                      opacity: isHidden ? 0.5 : 1,
                      position: "relative",
                      zIndex: caseMenu === c.id ? 50 : undefined,
                    }}
                    onClick={() => navigate(`/case/${c.id}/profile`)}
                    onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#333")}
                    onMouseLeave={(e) => (e.currentTarget.style.borderColor = isHidden ? "#1a1a1a" : "#1e1e1e")}
                  >
                    {/* Top row: type badge + priority + aegis score + menu */}
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
                        {(() => {
                          const p = casePriorities[c.id];
                          if (!p) return null;
                          const col = PRIORITY_COLORS[p.priority];
                          return (
                            <span className="text-[9px] font-mono font-bold tracking-wider px-1.5 py-0.5 rounded-sm" style={{ color: col, background: `${col}15`, border: `1px solid ${col}30` }}>
                              {p.priority.toUpperCase()}
                            </span>
                          );
                        })()}
                        {c.status === "closed" && (
                          <span className="text-[9px] font-mono font-bold tracking-wider px-1.5 py-0.5 rounded-sm" style={{ color: "#ef4444", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)" }}>CLOSED</span>
                        )}
                        {isHidden && (
                          <span className="text-[10px] font-mono" style={{ color: "#555" }}>HIDDEN</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {bestAegis != null && (
                          <div className="flex items-center gap-1.5">
                            {(() => {
                              // Find the subject with best score and render sparkline
                              const bestSubId = subs.find((s) => aegisScores[s.id] === bestAegis)?.id;
                              const history = bestSubId ? aegisHistory[bestSubId] : null;
                              if (history && history.length >= 2) {
                                return <SubjectSparkline history={history} />;
                              }
                              return null;
                            })()}
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
                          </div>
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
            </div>}

            {/* Subjects Grid */}
            {view === "subjects" && (
              allSubjects.length === 0 ? (
                <div className="surface text-center" style={{ padding: "48px 32px" }}>
                  <Users size={44} color="#333" className="mx-auto mb-4" />
                  <div className="text-[20px] text-white font-semibold mb-3">No subjects yet</div>
                  <div className="text-[15px]" style={{ color: "#555" }}>
                    Create a case first, then add subjects.
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                  {allSubjects.map((s) => {
                    const comp = s.data_completeness || 0;
                    const prof = s.profile_data?.professional;
                    const titleOrg = [prof?.title, prof?.organization].filter(Boolean).join(", ");

                    return (
                      <div
                        key={s.id}
                        className="surface text-left transition-all duration-200 flex flex-col cursor-pointer"
                        style={{
                          background: "#111",
                          border: "1px solid #1e1e1e",
                          padding: "24px 26px",
                          minHeight: 180,
                        }}
                        onClick={() => navigate(`/case/${s.case_id}/profile`)}
                        onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#333")}
                        onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#1e1e1e")}
                      >
                        {/* Top row: case type badge + Aegis score */}
                        <div className="flex items-center justify-between mb-3">
                          <span
                            className="badge"
                            style={{
                              color: typeColor(s.case_type),
                              background: `${typeColor(s.case_type)}18`,
                              border: `1px solid ${typeColor(s.case_type)}35`,
                              fontSize: 11,
                              padding: "3px 8px",
                            }}
                          >
                            {s.case_type}
                          </span>
                          <div className="flex items-center gap-1.5">
                            {aegisHistory[s.id]?.length >= 2 && <SubjectSparkline history={aegisHistory[s.id]} />}
                            <span
                              className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded"
                              style={{
                                color: s.aegis != null ? aegisColor(s.aegis) : "#444",
                                background: s.aegis != null ? aegisBg(s.aegis) : "rgba(255,255,255,0.03)",
                                border: `1px solid ${s.aegis != null ? aegisBorder(s.aegis) : "#1e1e1e"}`,
                              }}
                            >
                              {s.aegis != null ? s.aegis : "\u2014"}
                            </span>
                          </div>
                        </div>

                        {/* Subject name */}
                        <div className="text-white font-semibold text-[16px] mb-1 leading-snug">{s.name}</div>

                        {/* Title, Organization */}
                        {titleOrg && (
                          <div className="text-[13px] mb-1" style={{ color: "#666" }}>{titleOrg}</div>
                        )}

                        {/* Case name */}
                        <div className="text-[12px] font-mono" style={{ color: "#444" }}>
                          Case: {s.case_name}
                        </div>

                        <div className="flex-1" />

                        {/* Bottom row: completeness bar + date */}
                        <div className="flex items-center gap-3 mt-4 pt-3" style={{ borderTop: "1px solid #1a1a1a" }}>
                          <div className="flex items-center gap-1.5 flex-1">
                            <div className="flex-1 h-1.5 rounded-full" style={{ background: "#1a1a1a" }}>
                              <div
                                className="h-full rounded-full"
                                style={{
                                  width: `${comp}%`,
                                  background: comp >= 70 ? "#10b981" : comp >= 40 ? "#f59e0b" : "#ef4444",
                                  transition: "width 0.4s ease",
                                }}
                              />
                            </div>
                            <span className="text-[10px] font-mono" style={{ color: "#555" }}>{comp}%</span>
                          </div>
                          <span className="text-[11px] font-mono shrink-0" style={{ color: "#444" }}>
                            {new Date(s.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )
            )}

            {/* Recent Activity Feed */}
            {recentActivity.length > 0 && (
              <div className="mt-10">
                <div className="flex items-center gap-2.5 mb-5">
                  <Activity size={15} color="#09BC8A" />
                  <span className="text-[15px] font-semibold text-white">Recent Activity</span>
                  <span className="text-[11px] font-mono" style={{ color: "#444" }}>{recentActivity.length} events</span>
                </div>
                <div className="surface" style={{ background: "#111", border: "1px solid #1e1e1e", padding: 0, overflow: "hidden" }}>
                  {recentActivity.slice(0, 15).map((item, i) => (
                    <div
                      key={item.id}
                      className="flex items-center gap-4 px-5 py-3 transition-colors cursor-pointer"
                      style={{ borderBottom: i < Math.min(recentActivity.length, 15) - 1 ? "1px solid #1a1a1a" : "none" }}
                      onClick={() => item.caseId && navigate(`/case/${item.caseId}/profile`)}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "#151515")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                    >
                      <div className="flex items-center justify-center w-7 h-7 rounded-full shrink-0" style={{ background: activityIconBg(item.type) }}>
                        {activityIcon(item.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[13px] text-white truncate">{item.label}</div>
                        <div className="text-[11px] font-mono truncate" style={{ color: "#444" }}>{item.caseName}</div>
                      </div>
                      <div className="text-[11px] font-mono shrink-0" style={{ color: "#333" }}>
                        {formatActivityTime(item.time)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
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

      {showImport && (
        <BulkImport
          onClose={() => setShowImport(false)}
          onImported={(caseId) => {
            setShowImport(false);
            if (caseId) navigate(`/case/${caseId}/profile`);
            else fetchCases();
          }}
        />
      )}
    </div>
  );
}

function SubjectSparkline({ history }) {
  const data = [...history].reverse().slice(-10).map((h) => ({ v: h.composite }));
  return (
    <div style={{ width: 56, height: 24 }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 2, right: 0, left: 0, bottom: 2 }}>
          <defs>
            <linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#09BC8A" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#09BC8A" stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area type="monotone" dataKey="v" stroke="#09BC8A" strokeWidth={1.5} fill="url(#sparkGrad)" dot={false} />
        </AreaChart>
      </ResponsiveContainer>
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
  const [selectedTemplate, setSelectedTemplate] = useState(null);

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

        {/* Template Selection Step */}
        {selectedTemplate === null ? (
          <div>
            <p className="text-[13px] mb-4" style={{ color: "#666" }}>Choose a template or start blank</p>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <button
                onClick={() => setSelectedTemplate("blank")}
                className="p-4 rounded text-left cursor-pointer transition-all"
                style={{ background: "#0d0d0d", border: "1px solid #1e1e1e" }}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#09BC8A")}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#1e1e1e")}
              >
                <div className="text-[14px] font-semibold text-white mb-1">Blank Case</div>
                <div className="text-[11px]" style={{ color: "#555" }}>Start from scratch</div>
              </button>
              {CASE_TEMPLATES.map((t) => (
                <button
                  key={t.id}
                  onClick={() => {
                    setSelectedTemplate(t);
                    setType(t.type);
                    setDescription(t.description + "\n\n---\nChecklist:\n" + t.checklist.map((c) => `- [ ] ${c}`).join("\n"));
                  }}
                  className="p-4 rounded text-left cursor-pointer transition-all"
                  style={{ background: "#0d0d0d", border: "1px solid #1e1e1e" }}
                  onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#09BC8A")}
                  onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#1e1e1e")}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[14px] font-semibold text-white">{t.name}</span>
                  </div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-sm" style={{ color: typeColor(t.type), background: `${typeColor(t.type)}18`, border: `1px solid ${typeColor(t.type)}35` }}>{t.type}</span>
                    <span className="text-[10px] font-mono" style={{ color: "#555" }}>{t.checklist.length} items</span>
                  </div>
                  <div className="text-[11px] line-clamp-2" style={{ color: "#555" }}>{t.description}</div>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {selectedTemplate !== "blank" && (
              <button
                onClick={() => { setSelectedTemplate(null); setDescription(""); }}
                className="flex items-center gap-1.5 text-[12px] mb-3 cursor-pointer"
                style={{ background: "transparent", border: "none", color: "#555" }}
              >
                <ArrowLeft size={12} /> Change template
              </button>
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
          </>
        )}
      </div>
    </div>
  );
}
