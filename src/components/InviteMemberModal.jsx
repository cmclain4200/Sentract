import { useState } from "react";
import { X, Send } from "lucide-react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";

const ROLE_LABELS = {
  org_owner: "Owner",
  team_manager: "Manager",
  analyst: "Analyst",
  reviewer: "Reviewer",
  client: "Client",
};

export default function InviteMemberModal({ orgId, roles, teams, onClose, onInvited }) {
  const { user } = useAuth();
  const [email, setEmail] = useState("");
  const [roleId, setRoleId] = useState(roles.find((r) => r.name === "analyst")?.id || roles[0]?.id || "");
  const [teamId, setTeamId] = useState(teams[0]?.id || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error: err } = await supabase.from("invitations").insert({
      email: email.trim().toLowerCase(),
      org_id: orgId,
      role_id: roleId,
      team_id: teamId || null,
      invited_by: user.id,
    });

    if (err) {
      setError(err.message);
      setLoading(false);
      return;
    }

    onInvited();
  }

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
            <span className="section-label">Team</span>
            <h2 className="text-white text-[20px] font-semibold mt-1">Invite Member</h2>
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
          <div className="mb-4 p-3 rounded text-[13px]" style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", color: "#ef4444" }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div>
            <label className="sub-label block mb-2">Email Address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
              className="w-full rounded text-[15px] text-white outline-none"
              style={{ background: "#0d0d0d", border: "1px solid #1e1e1e", padding: "10px 14px", minHeight: 44 }}
              onFocus={(e) => (e.target.style.borderColor = "#333")}
              onBlur={(e) => (e.target.style.borderColor = "#1e1e1e")}
              placeholder="colleague@company.com"
            />
          </div>

          <div>
            <label className="sub-label block mb-2">Role</label>
            <select
              value={roleId}
              onChange={(e) => setRoleId(e.target.value)}
              className="w-full rounded text-[15px] text-white outline-none"
              style={{ background: "#0d0d0d", border: "1px solid #1e1e1e", padding: "10px 14px", minHeight: 44 }}
            >
              {roles.filter((r) => r.name !== "org_owner").map((r) => (
                <option key={r.id} value={r.id}>{ROLE_LABELS[r.name] || r.name}</option>
              ))}
            </select>
          </div>

          {teams.length > 1 && (
            <div>
              <label className="sub-label block mb-2">Team</label>
              <select
                value={teamId}
                onChange={(e) => setTeamId(e.target.value)}
                className="w-full rounded text-[15px] text-white outline-none"
                style={{ background: "#0d0d0d", border: "1px solid #1e1e1e", padding: "10px 14px", minHeight: 44 }}
              >
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
          )}

          <div className="text-[12px]" style={{ color: "#555" }}>
            An invitation link will be generated. Share it with the invitee to complete signup.
          </div>

          <button
            type="submit"
            disabled={loading || !email.trim()}
            className="w-full rounded text-[15px] font-semibold transition-all duration-200 cursor-pointer flex items-center justify-center gap-2"
            style={{
              background: loading || !email.trim() ? "#1a1a1a" : "#09BC8A",
              color: loading || !email.trim() ? "#555" : "#0a0a0a",
              border: "none",
              padding: "14px 32px",
              minHeight: 48,
            }}
          >
            <Send size={15} />
            {loading ? "Sending..." : "Send Invitation"}
          </button>
        </form>
      </div>
    </div>
  );
}
