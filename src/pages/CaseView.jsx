import { useState, useEffect, useCallback } from "react";
import { useParams, Outlet, Navigate } from "react-router-dom";
import { Plus, User, FileDown } from "lucide-react";
import { supabase } from "../lib/supabase";
import { generateReport } from "../lib/reportExport";
import Sidebar from "../components/Sidebar";

export default function CaseView() {
  const { caseId } = useParams();
  const [caseData, setCaseData] = useState(null);
  const [subjects, setSubjects] = useState([]);
  const [activeSubject, setActiveSubject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showCreateSubject, setShowCreateSubject] = useState(false);
  const [exporting, setExporting] = useState(false);

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
    }
  }

  function refreshSubject() {
    fetchSubjects();
  }

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
            className="flex items-center gap-3 px-6 shrink-0"
            style={{ borderBottom: "1px solid #1a1a1a", background: "#0a0a0a", minHeight: 48, padding: "8px 24px" }}
          >
            <span className="sub-label mr-1" style={{ color: "#444" }}>Subject</span>
            {subjects.map((s) => (
              <button
                key={s.id}
                onClick={() => setActiveSubject(s)}
                className="flex items-center gap-2 rounded text-[13px] cursor-pointer transition-all"
                style={{
                  background: activeSubject?.id === s.id ? "#1a1a1a" : "transparent",
                  border: `1px solid ${activeSubject?.id === s.id ? "#333" : "#1e1e1e"}`,
                  color: activeSubject?.id === s.id ? "#fff" : "#888",
                  padding: "6px 14px",
                  minHeight: 34,
                }}
              >
                <User size={13} />
                {s.name}
              </button>
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
            {activeSubject && (
              <button
                onClick={async () => {
                  setExporting(true);
                  try {
                    await generateReport({
                      subject: activeSubject,
                      caseData,
                      profileData: activeSubject.profile_data,
                      supabase,
                    });
                  } finally {
                    setExporting(false);
                  }
                }}
                disabled={exporting}
                className="flex items-center gap-1.5 rounded text-[13px] cursor-pointer ml-auto"
                style={{
                  background: "transparent",
                  border: "1px solid #333",
                  color: exporting ? "#555" : "#09BC8A",
                  padding: "6px 14px",
                  minHeight: 34,
                }}
                onMouseEnter={(e) => {
                  if (!exporting) e.currentTarget.style.background = "#1a1a1a";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
                }}
              >
                <FileDown size={13} />
                {exporting ? "Exporting..." : "Export PDF"}
              </button>
            )}
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          <Outlet context={{ caseData, subjects, subject: activeSubject, refreshSubject }} />
        </div>
      </div>

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
