import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, X, Briefcase, Users, BarChart3 } from "lucide-react";
import { supabase } from "../lib/supabase";
import SectionHeader from "../components/common/SectionHeader";

const CASE_TYPES = [
  { value: "EP", label: "Executive Protection", color: "#00d4aa" },
  { value: "CT", label: "Counter-Threat", color: "#f59e0b" },
  { value: "CI", label: "Corporate Intel", color: "#3b82f6" },
];

export default function Dashboard() {
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    fetchCases();
  }, []);

  async function fetchCases() {
    const { data, error } = await supabase
      .from("cases")
      .select("*, subjects(id, data_completeness)")
      .order("created_at", { ascending: false });
    if (!error) setCases(data || []);
    setLoading(false);
  }

  function typeColor(type) {
    return CASE_TYPES.find((t) => t.value === type)?.color || "#888";
  }

  const stats = useMemo(() => {
    if (!cases.length) return null;
    const totalCases = cases.length;
    let totalSubjects = 0;
    let completenessSum = 0;
    let completenessCount = 0;
    for (const c of cases) {
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
    <div className="h-full overflow-y-auto p-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-start justify-between mb-8">
          <SectionHeader label="Dashboard" title="Cases" />
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-md text-sm font-semibold transition-all duration-200 cursor-pointer"
            style={{ background: "#00d4aa", color: "#0a0a0a", border: "none" }}
          >
            <Plus size={15} />
            New Case
          </button>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 justify-center py-20">
            <span className="pulse-dot" />
            <span className="pulse-dot" />
            <span className="pulse-dot" />
          </div>
        ) : cases.length === 0 ? (
          <div className="surface p-12 text-center">
            <Briefcase size={40} color="#333" className="mx-auto mb-4" />
            <div className="text-lg text-white font-semibold mb-2">No cases yet</div>
            <div className="text-sm mb-6" style={{ color: "#555" }}>
              Create your first case to get started.
            </div>
            <button
              onClick={() => setShowCreate(true)}
              className="px-5 py-2.5 rounded-md text-sm font-semibold cursor-pointer"
              style={{ background: "#00d4aa", color: "#0a0a0a", border: "none" }}
            >
              Create Case
            </button>
          </div>
        ) : (
          <>
            {/* Stats Bar */}
            {stats && (
              <div className="flex gap-4 mb-6">
                <div className="surface flex-1 p-4 flex items-center gap-3">
                  <Briefcase size={16} color="#00d4aa" />
                  <div>
                    <div className="text-[22px] font-bold text-white leading-none">{stats.totalCases}</div>
                    <div className="text-[10px] font-mono mt-1" style={{ color: "#555" }}>TOTAL CASES</div>
                  </div>
                </div>
                <div className="surface flex-1 p-4 flex items-center gap-3">
                  <Users size={16} color="#3b82f6" />
                  <div>
                    <div className="text-[22px] font-bold text-white leading-none">{stats.totalSubjects}</div>
                    <div className="text-[10px] font-mono mt-1" style={{ color: "#555" }}>ACTIVE SUBJECTS</div>
                  </div>
                </div>
                <div className="surface flex-1 p-4 flex items-center gap-3">
                  <BarChart3 size={16} color={stats.avgCompleteness >= 70 ? "#10b981" : stats.avgCompleteness >= 40 ? "#f59e0b" : "#ef4444"} />
                  <div>
                    <div className="text-[22px] font-bold text-white leading-none">{stats.avgCompleteness}%</div>
                    <div className="text-[10px] font-mono mt-1" style={{ color: "#555" }}>AVG COMPLETENESS</div>
                  </div>
                </div>
              </div>
            )}

            {/* Case Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {cases.map((c) => {
                const subs = c.subjects || [];
                const subCount = subs.length;
                const avgComp = subCount > 0
                  ? Math.round(subs.reduce((sum, s) => sum + (s.data_completeness || 0), 0) / subCount)
                  : 0;
                return (
                  <button
                    key={c.id}
                    onClick={() => navigate(`/case/${c.id}/profile`)}
                    className="surface p-5 text-left cursor-pointer transition-all duration-200"
                    style={{ background: "#111", border: "1px solid #1e1e1e" }}
                    onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#333")}
                    onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#1e1e1e")}
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <span
                        className="badge"
                        style={{
                          color: typeColor(c.type),
                          background: `${typeColor(c.type)}18`,
                          border: `1px solid ${typeColor(c.type)}35`,
                          fontSize: 9,
                        }}
                      >
                        {c.type}
                      </span>
                    </div>
                    <div className="text-white font-semibold text-[15px] mb-1">{c.name}</div>
                    {c.client_name && (
                      <div className="text-[11px] mb-1" style={{ color: "#555" }}>{c.client_name}</div>
                    )}
                    {c.description && (
                      <div className="text-[12px] line-clamp-2" style={{ color: "#666" }}>
                        {c.description}
                      </div>
                    )}
                    <div className="flex items-center gap-3 mt-3">
                      <span className="text-[10px] font-mono" style={{ color: "#444" }}>
                        {subCount} subject{subCount !== 1 ? "s" : ""}
                      </span>
                      {subCount > 0 && (
                        <div className="flex items-center gap-1.5 flex-1">
                          <div className="flex-1 h-1 rounded-full" style={{ background: "#1a1a1a" }}>
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${avgComp}%`,
                                background: avgComp >= 70 ? "#10b981" : avgComp >= 40 ? "#f59e0b" : "#ef4444",
                                transition: "width 0.4s ease",
                              }}
                            />
                          </div>
                          <span className="text-[9px] font-mono" style={{ color: "#555" }}>{avgComp}%</span>
                        </div>
                      )}
                      <span className="text-[10px] font-mono" style={{ color: "#444" }}>
                        {new Date(c.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>

      {showCreate && (
        <CreateCaseModal
          onClose={() => setShowCreate(false)}
          onCreated={(newCase) => {
            setShowCreate(false);
            navigate(`/case/${newCase.id}/profile`);
          }}
        />
      )}
    </div>
  );
}

function CreateCaseModal({ onClose, onCreated }) {
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

    // Auto-create subject from case name
    if (autoCreateSubject && data) {
      await supabase.from("subjects").insert({
        case_id: data.id,
        name: name,
      });
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
        className="surface p-6 w-full max-w-md fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <div>
            <span className="section-label">New Case</span>
            <h2 className="text-white text-lg font-semibold mt-1">Create Case</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded cursor-pointer"
            style={{ background: "transparent", border: "none" }}
          >
            <X size={16} color="#555" />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded text-sm" style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", color: "#ef4444" }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="sub-label block mb-1.5">Case Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full px-3 py-2 rounded text-sm text-white outline-none"
              style={{ background: "#0d0d0d", border: "1px solid #1e1e1e" }}
              onFocus={(e) => (e.target.style.borderColor = "#333")}
              onBlur={(e) => (e.target.style.borderColor = "#1e1e1e")}
              placeholder="e.g., Mercer EP Assessment"
            />
          </div>
          <div>
            <label className="sub-label block mb-1.5">Client Name</label>
            <input
              type="text"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              className="w-full px-3 py-2 rounded text-sm text-white outline-none"
              style={{ background: "#0d0d0d", border: "1px solid #1e1e1e" }}
              onFocus={(e) => (e.target.style.borderColor = "#333")}
              onBlur={(e) => (e.target.style.borderColor = "#1e1e1e")}
              placeholder="Optional — e.g., Apex Maritime"
            />
          </div>
          <div>
            <label className="sub-label block mb-1.5">Type</label>
            <div className="flex gap-2">
              {CASE_TYPES.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setType(t.value)}
                  className="flex-1 py-2 rounded text-[12px] font-mono font-semibold transition-all duration-150 cursor-pointer"
                  style={{
                    background: type === t.value ? `${t.color}18` : "#0d0d0d",
                    border: `1px solid ${type === t.value ? t.color + "50" : "#1e1e1e"}`,
                    color: type === t.value ? t.color : "#555",
                  }}
                >
                  {t.value}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="sub-label block mb-1.5">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 rounded text-sm text-white outline-none resize-none"
              style={{ background: "#0d0d0d", border: "1px solid #1e1e1e" }}
              onFocus={(e) => (e.target.style.borderColor = "#333")}
              onBlur={(e) => (e.target.style.borderColor = "#1e1e1e")}
              placeholder="Optional description..."
            />
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={autoCreateSubject}
              onChange={(e) => setAutoCreateSubject(e.target.checked)}
              className="accent-[#00d4aa] w-4 h-4"
            />
            <span className="text-[12px]" style={{ color: "#888" }}>
              Auto-create subject from case name
            </span>
          </label>
          <button
            type="submit"
            disabled={loading || !name.trim()}
            className="w-full py-2.5 rounded text-sm font-semibold transition-all duration-200 cursor-pointer"
            style={{
              background: loading || !name.trim() ? "#1a1a1a" : "#00d4aa",
              color: loading || !name.trim() ? "#555" : "#0a0a0a",
              border: "none",
            }}
          >
            {loading ? "Creating..." : "Create Case"}
          </button>
        </form>
      </div>
    </div>
  );
}
