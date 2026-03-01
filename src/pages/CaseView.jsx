import { useState, useEffect, useCallback } from "react";
import { useParams, Outlet, Navigate } from "react-router-dom";
import { Plus, User, FileDown, EyeOff, Eye, Trash2, AlertTriangle, MoreVertical, MessageSquare, ChevronDown } from "lucide-react";
import { supabase } from "../lib/supabase";
import { generateReport } from "../lib/reportExport";
import { generateReportV2 } from "../lib/reportExportV2";
import { REPORT_TEMPLATES } from "../lib/reportTemplates";
import { syncRelationships } from "../lib/relationshipSync";
import { useAuth } from "../contexts/AuthContext";
import Sidebar from "../components/Sidebar";
import CaseChat from "../features/chat/CaseChat";

export default function CaseView() {
  const { caseId } = useParams();
  const { user } = useAuth();
  const [caseData, setCaseData] = useState(null);
  const [subjects, setSubjects] = useState([]);
  const [activeSubject, setActiveSubject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showCreateSubject, setShowCreateSubject] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [showHiddenSubjects, setShowHiddenSubjects] = useState(false);
  const [subjectMenu, setSubjectMenu] = useState(null);
  const [confirmDeleteSubject, setConfirmDeleteSubject] = useState(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [reportTemplate, setReportTemplate] = useState("full");
  const [showTemplateMenu, setShowTemplateMenu] = useState(false);

  const fetchSubjects = useCallback(async () => {
    const { data: sData, error: sErr } = await supabase
      .from("subjects")
      .select("*")
      .eq("case_id", caseId)
      .order("created_at", { ascending: true });
    if (sErr) return [];

    const list = sData || [];
    setSubjects(list);
    setActiveSubject((prev) => {
      if (list.length === 0) return prev;
      if (!prev) return list[0];
      const refreshed = list.find((s) => s.id === prev.id);
      return refreshed || list[0];
    });
    return list;
  }, [caseId]);

  useEffect(() => {
    async function fetchCase() {
      setLoading(true);
      const { data: cData, error: cErr } = await supabase
        .from("cases")
        .select("*")
        .eq("id", caseId)
        .single();

      if (cErr) {
        setError(cErr.message);
        setLoading(false);
        return;
      }

      setCaseData(cData);
      const list = await fetchSubjects();
      setLoading(false);

      if (list.length === 0) {
        setShowCreateSubject(true);
      }
    }

    fetchCase();
  }, [caseId]);

  async function handleCreateSubject(name) {
    const { data, error: err } = await supabase
      .from("subjects")
      .insert({ case_id: caseId, name, profile_data: {} })
      .select()
      .single();

    if (!err && data) {
      setSubjects((prev) => [...prev, data]);
      setActiveSubject(data);
      setShowCreateSubject(false);
      // Fire-and-forget: sync relationships for new subject
      if (user?.id) {
        syncRelationships(data, user.id);
      }
    }
  }

  function refreshSubject() {
    fetchSubjects();
  }

  async function hideSubject(id) {
    await supabase.from("subjects").update({ hidden: true }).eq("id", id);
    setSubjects((prev) => prev.map((s) => (s.id === id ? { ...s, hidden: true } : s)));
    if (activeSubject?.id === id) {
      const next = subjects.find((s) => s.id !== id && !s.hidden);
      setActiveSubject(next || null);
    }
    setSubjectMenu(null);
  }

  async function unhideSubject(id) {
    await supabase.from("subjects").update({ hidden: false }).eq("id", id);
    setSubjects((prev) => prev.map((s) => (s.id === id ? { ...s, hidden: false } : s)));
    setSubjectMenu(null);
  }

  async function deleteSubject(id) {
    await supabase.from("subjects").delete().eq("id", id);
    setSubjects((prev) => prev.filter((s) => s.id !== id));
    if (activeSubject?.id === id) {
      const remaining = subjects.filter((s) => s.id !== id && !s.hidden);
      setActiveSubject(remaining[0] || null);
    }
    setConfirmDeleteSubject(null);
    setSubjectMenu(null);
  }

  const visibleSubjects = showHiddenSubjects ? subjects : subjects.filter((s) => !s.hidden);
  const hiddenSubjectCount = subjects.filter((s) => s.hidden).length;

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="flex items-center gap-2">
          <span className="pulse-dot" />
          <span className="pulse-dot" />
          <span className="pulse-dot" />
        </div>
      </div>
    );
  }

  if (error || !caseData) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="h-full flex">
      <Sidebar caseName={caseData.name} caseType={caseData.type} />
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Subject selector bar */}
        {subjects.length > 0 && (
          <div
            className="flex items-center gap-3 px-6 shrink-0 flex-wrap"
            style={{ borderBottom: "1px solid #1a1a1a", background: "#0a0a0a", minHeight: 48, padding: "8px 24px" }}
          >
            <span className="sub-label mr-1" style={{ color: "#444" }}>Subject</span>
            {visibleSubjects.map((s) => (
              <div key={s.id} className="relative flex items-center" style={{ zIndex: subjectMenu === s.id ? 50 : undefined }}>
                <button
                  onClick={() => setActiveSubject(s)}
                  className="flex items-center gap-2 rounded-l text-[13px] cursor-pointer transition-all"
                  style={{
                    background: activeSubject?.id === s.id ? "#1a1a1a" : "transparent",
                    border: `1px solid ${activeSubject?.id === s.id ? "#333" : "#1e1e1e"}`,
                    borderRight: "none",
                    color: activeSubject?.id === s.id ? "#fff" : "#888",
                    opacity: s.hidden ? 0.5 : 1,
                    padding: "6px 10px 6px 14px",
                    minHeight: 34,
                  }}
                >
                  <User size={13} />
                  {s.name}
                  {s.hidden && <span className="text-[9px] font-mono ml-1" style={{ color: "#555" }}>HIDDEN</span>}
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); setSubjectMenu(subjectMenu === s.id ? null : s.id); }}
                  className="flex items-center justify-center rounded-r text-[13px] cursor-pointer transition-all"
                  style={{
                    background: activeSubject?.id === s.id ? "#1a1a1a" : "transparent",
                    border: `1px solid ${activeSubject?.id === s.id ? "#333" : "#1e1e1e"}`,
                    borderLeft: `1px solid ${activeSubject?.id === s.id ? "#333" : "#1e1e1e"}`,
                    padding: "6px 6px",
                    minHeight: 34,
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "#222")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = activeSubject?.id === s.id ? "#1a1a1a" : "transparent")}
                >
                  <MoreVertical size={12} color="#555" />
                </button>
                {subjectMenu === s.id && (
                  <div
                    className="absolute left-0 top-full mt-1 w-[170px] rounded-md overflow-hidden z-50 fade-in"
                    style={{ background: "#111", border: "1px solid #222", boxShadow: "0 8px 32px rgba(0,0,0,0.6)" }}
                  >
                    <button
                      onClick={(e) => { e.stopPropagation(); s.hidden ? unhideSubject(s.id) : hideSubject(s.id); }}
                      className="w-full flex items-center gap-2.5 px-4 text-left transition-all duration-150 cursor-pointer"
                      style={{ background: "transparent", border: "none", minHeight: 38, padding: "0 14px", color: "#888" }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "#1a1a1a")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                    >
                      {s.hidden ? <Eye size={13} /> : <EyeOff size={13} />}
                      <span className="text-[13px]">{s.hidden ? "Unhide" : "Hide"}</span>
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setConfirmDeleteSubject(s); setSubjectMenu(null); }}
                      className="w-full flex items-center gap-2.5 px-4 text-left transition-all duration-150 cursor-pointer"
                      style={{ background: "transparent", border: "none", minHeight: 38, padding: "0 14px", color: "#ef4444" }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "#1a1a1a")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                    >
                      <Trash2 size={13} />
                      <span className="text-[13px]">Delete</span>
                    </button>
                  </div>
                )}
              </div>
            ))}
            <button
              onClick={() => setShowCreateSubject(true)}
              className="flex items-center gap-1.5 rounded text-[13px] cursor-pointer"
              style={{ background: "transparent", border: "1px dashed #333", color: "#555", padding: "6px 14px", minHeight: 34 }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "#09BC8A";
                e.currentTarget.style.color = "#09BC8A";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "#333";
                e.currentTarget.style.color = "#555";
              }}
            >
              <Plus size={13} /> Add
            </button>
            {hiddenSubjectCount > 0 && (
              <button
                onClick={() => setShowHiddenSubjects(!showHiddenSubjects)}
                className="flex items-center gap-1.5 text-[11px] font-mono cursor-pointer transition-colors"
                style={{ background: "transparent", border: "none", color: showHiddenSubjects ? "#09BC8A" : "#444" }}
              >
                {showHiddenSubjects ? <EyeOff size={11} /> : <Eye size={11} />}
                {hiddenSubjectCount} hidden
              </button>
            )}
            {activeSubject && (
              <div className="flex items-center gap-2 ml-auto">
                <button
                  onClick={() => setChatOpen(!chatOpen)}
                  className="flex items-center gap-1.5 rounded text-[13px] cursor-pointer"
                  style={{
                    background: chatOpen ? "#1a1a1a" : "transparent",
                    border: `1px solid ${chatOpen ? "#09BC8A" : "#333"}`,
                    color: chatOpen ? "#09BC8A" : "#888",
                    padding: "6px 14px",
                    minHeight: 34,
                  }}
                >
                  <MessageSquare size={13} />
                  Chat
                </button>
                <div className="relative flex">
                  <button
                    onClick={async () => {
                      setExporting(true);
                      try {
                        await generateReportV2({
                          subject: activeSubject,
                          caseData,
                          profileData: activeSubject.profile_data,
                          supabase,
                          template: reportTemplate,
                        });
                      } finally {
                        setExporting(false);
                      }
                    }}
                    disabled={exporting}
                    className="flex items-center gap-1.5 rounded-l text-[13px] cursor-pointer"
                    style={{
                      background: "transparent",
                      border: "1px solid #333",
                      borderRight: "none",
                      color: exporting ? "#555" : "#09BC8A",
                      padding: "6px 14px",
                      minHeight: 34,
                    }}
                    onMouseEnter={(e) => { if (!exporting) e.currentTarget.style.background = "#1a1a1a"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                  >
                    <FileDown size={13} />
                    {exporting ? "Exporting..." : `Export ${REPORT_TEMPLATES[reportTemplate]?.label || "PDF"}`}
                  </button>
                  <button
                    onClick={() => setShowTemplateMenu(!showTemplateMenu)}
                    className="flex items-center justify-center rounded-r text-[13px] cursor-pointer"
                    style={{ background: "transparent", border: "1px solid #333", padding: "6px 6px", minHeight: 34 }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "#1a1a1a")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    <ChevronDown size={12} color="#555" />
                  </button>
                  {showTemplateMenu && (
                    <div
                      className="absolute right-0 top-full mt-1 w-[200px] rounded-md overflow-hidden z-50 fade-in"
                      style={{ background: "#111", border: "1px solid #222", boxShadow: "0 8px 32px rgba(0,0,0,0.6)" }}
                    >
                      {Object.values(REPORT_TEMPLATES).map((t) => (
                        <button
                          key={t.id}
                          onClick={() => { setReportTemplate(t.id); setShowTemplateMenu(false); }}
                          className="w-full flex flex-col px-4 py-2.5 text-left transition-all cursor-pointer"
                          style={{ background: reportTemplate === t.id ? "#1a1a1a" : "transparent", border: "none" }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = "#1a1a1a")}
                          onMouseLeave={(e) => (e.currentTarget.style.background = reportTemplate === t.id ? "#1a1a1a" : "transparent")}
                        >
                          <span className="text-[13px]" style={{ color: reportTemplate === t.id ? "#09BC8A" : "#ccc" }}>{t.label}</span>
                          <span className="text-[11px]" style={{ color: "#555" }}>{t.description}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          <Outlet context={{ caseData, subjects, subject: activeSubject, refreshSubject }} />
        </div>
      </div>

      {/* Chat Panel */}
      {chatOpen && activeSubject && (
        <CaseChat
          isOpen={chatOpen}
          onClose={() => setChatOpen(false)}
          subject={activeSubject}
          caseData={caseData}
        />
      )}

      {/* Close menus on outside click */}
      {showTemplateMenu && (
        <div className="fixed inset-0 z-40" onClick={() => setShowTemplateMenu(false)} />
      )}
      {subjectMenu && (
        <div className="fixed inset-0 z-40" onClick={() => setSubjectMenu(null)} />
      )}

      {/* Delete subject confirmation */}
      {confirmDeleteSubject && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.7)" }}
          onClick={() => setConfirmDeleteSubject(null)}
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
                <h3 className="text-white text-[18px] font-semibold">Delete Subject</h3>
                <p className="text-[13px] mt-0.5" style={{ color: "#666" }}>This action cannot be undone.</p>
              </div>
            </div>
            <p className="text-[14px] mb-6" style={{ color: "#888" }}>
              Permanently delete <span className="text-white font-semibold">{confirmDeleteSubject.name}</span> and all associated profile data, assessments, and uploads? This data cannot be recovered.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => deleteSubject(confirmDeleteSubject.id)}
                className="flex-1 rounded text-[14px] font-semibold cursor-pointer"
                style={{ background: "#ef4444", color: "#fff", border: "none", padding: "12px 24px", minHeight: 44 }}
              >
                Delete Permanently
              </button>
              <button
                onClick={() => setConfirmDeleteSubject(null)}
                className="rounded text-[14px] cursor-pointer"
                style={{ background: "transparent", border: "1px solid #333", color: "#888", padding: "10px 20px", minHeight: 44 }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Subject Modal */}
      {showCreateSubject && (
        <CreateSubjectModal
          onClose={() => setShowCreateSubject(false)}
          onCreate={handleCreateSubject}
          isFirst={subjects.length === 0}
        />
      )}
    </div>
  );
}

function CreateSubjectModal({ onClose, onCreate, isFirst }) {
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    await onCreate(name.trim());
    setLoading(false);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.7)" }}
      onClick={isFirst ? undefined : onClose}
    >
      <div
        className="surface w-full fade-in"
        style={{ maxWidth: 480, padding: "28px 32px" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-6">
          <span className="section-label">
            {isFirst ? "Getting Started" : "New Subject"}
          </span>
          <h2 className="text-white text-[22px] font-semibold mt-1">
            {isFirst ? "Add Your First Subject" : "Add Subject"}
          </h2>
          {isFirst && (
            <p className="text-[14px] mt-2" style={{ color: "#666" }}>
              A subject is the individual you're building an intelligence profile for.
            </p>
          )}
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div>
            <label className="sub-label block mb-2">Subject Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoFocus
              className="form-input"
              placeholder="e.g., Jonathan R. Mercer"
            />
          </div>
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={loading || !name.trim()}
              className="flex-1 rounded text-[15px] font-semibold cursor-pointer"
              style={{
                background: loading || !name.trim() ? "#1a1a1a" : "#09BC8A",
                color: loading || !name.trim() ? "#555" : "#0a0a0a",
                border: "none",
                padding: "12px 24px",
                minHeight: 44,
              }}
            >
              {loading ? "Creating..." : "Create Subject"}
            </button>
            {!isFirst && (
              <button
                type="button"
                onClick={onClose}
                className="rounded text-[14px] cursor-pointer"
                style={{ background: "transparent", border: "1px solid #333", color: "#888", padding: "10px 20px", minHeight: 44 }}
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
