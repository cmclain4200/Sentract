import { useState, useEffect } from "react";
import { X, UserPlus, Trash2 } from "lucide-react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";

export default function CaseAssignmentModal({ caseId, members, onClose }) {
  const { user } = useAuth();
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState("");

  useEffect(() => {
    fetchAssignments();
  }, [caseId]);

  async function fetchAssignments() {
    setLoading(true);
    const { data } = await supabase
      .from("case_assignments")
      .select("*, profiles(full_name)")
      .eq("case_id", caseId);
    setAssignments(data || []);
    setLoading(false);
  }

  async function assign() {
    if (!selectedUser) return;
    await supabase.from("case_assignments").insert({
      user_id: selectedUser,
      case_id: caseId,
      assigned_by: user.id,
    });
    setSelectedUser("");
    fetchAssignments();
  }

  async function unassign(id) {
    await supabase.from("case_assignments").delete().eq("id", id);
    setAssignments((prev) => prev.filter((a) => a.id !== id));
  }

  const assignedUserIds = new Set(assignments.map((a) => a.user_id));
  const unassignedMembers = members.filter((m) => !assignedUserIds.has(m.user_id));

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.7)" }}
      onClick={onClose}
    >
      <div
        className="surface w-full fade-in"
        style={{ maxWidth: 440, padding: "28px 32px" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <div>
            <span className="section-label">Case</span>
            <h2 className="text-white text-[20px] font-semibold mt-1">Assign Users</h2>
          </div>
          <button
            onClick={onClose}
            className="rounded cursor-pointer flex items-center justify-center"
            style={{ background: "transparent", border: "none", width: 36, height: 36 }}
          >
            <X size={18} color="#555" />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 justify-center py-8">
            <span className="pulse-dot" />
            <span className="pulse-dot" />
            <span className="pulse-dot" />
          </div>
        ) : (
          <>
            {/* Current assignments */}
            <div className="mb-5">
              <div className="text-[12px] font-mono mb-3" style={{ color: "#555" }}>ASSIGNED ({assignments.length})</div>
              <div className="space-y-2">
                {assignments.map((a) => (
                  <div
                    key={a.id}
                    className="flex items-center gap-3 px-3 py-2 rounded"
                    style={{ background: "#111", border: "1px solid #1e1e1e" }}
                  >
                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-[12px] font-semibold" style={{ background: "#1a1a1a", color: "#888", border: "1px solid #2a2a2a" }}>
                      {(a.profiles?.full_name || "?")[0].toUpperCase()}
                    </div>
                    <span className="text-[13px] text-white flex-1">{a.profiles?.full_name || "Unknown"}</span>
                    <button
                      onClick={() => unassign(a.id)}
                      className="p-1 rounded cursor-pointer"
                      style={{ background: "transparent", border: "none", color: "#555" }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = "#ef4444")}
                      onMouseLeave={(e) => (e.currentTarget.style.color = "#555")}
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Add assignment */}
            {unassignedMembers.length > 0 && (
              <div className="flex items-center gap-2">
                <select
                  value={selectedUser}
                  onChange={(e) => setSelectedUser(e.target.value)}
                  className="flex-1 rounded text-[14px] text-white outline-none"
                  style={{ background: "#0d0d0d", border: "1px solid #1e1e1e", padding: "8px 12px" }}
                >
                  <option value="">Select member...</option>
                  {unassignedMembers.map((m) => (
                    <option key={m.user_id} value={m.user_id}>
                      {m.profiles?.full_name || m.user_id}
                    </option>
                  ))}
                </select>
                <button
                  onClick={assign}
                  disabled={!selectedUser}
                  className="flex items-center gap-1.5 px-3 py-2 rounded text-[13px] font-semibold cursor-pointer"
                  style={{
                    background: selectedUser ? "#09BC8A" : "#1a1a1a",
                    color: selectedUser ? "#0a0a0a" : "#555",
                    border: "none",
                  }}
                >
                  <UserPlus size={13} /> Assign
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
