import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Users, Plus, Trash2, Mail, Shield, ChevronDown, X, UserPlus, Building2 } from "lucide-react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";
import { useOrg } from "../contexts/OrgContext";
import InviteMemberModal from "../components/InviteMemberModal";
import CaseAssignmentModal from "../components/CaseAssignmentModal";

const ROLE_COLORS = {
  org_owner: "#09BC8A",
  team_manager: "#3b82f6",
  analyst: "#f59e0b",
  reviewer: "#8b5cf6",
  client: "#555",
};

const ROLE_LABELS = {
  org_owner: "Owner",
  team_manager: "Manager",
  analyst: "Analyst",
  reviewer: "Reviewer",
  client: "Client",
};

export default function TeamManagement() {
  const { user } = useAuth();
  const { org, role, teams, can, isOrgOwner, isRole, myTeams, refetch } = useOrg();
  const navigate = useNavigate();

  const [members, setMembers] = useState([]);
  const [invitations, setInvitations] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [showAssignment, setShowAssignment] = useState(null);
  const [activeTab, setActiveTab] = useState("members");

  useEffect(() => {
    if (!org) return;
    fetchData();
  }, [org?.id]);

  async function fetchData() {
    setLoading(true);

    const [membersRes, invitesRes, rolesRes] = await Promise.all([
      supabase
        .from("org_members")
        .select("*, roles(name), profiles(full_name, avatar_url)")
        .eq("org_id", org.id)
        .order("created_at", { ascending: true }),
      supabase
        .from("invitations")
        .select("*")
        .eq("org_id", org.id)
        .in("status", ["pending"])
        .order("created_at", { ascending: false }),
      supabase
        .from("roles")
        .select("*")
        .eq("org_id", org.id)
        .order("name", { ascending: true }),
    ]);

    setMembers(membersRes.data || []);
    setInvitations(invitesRes.data || []);
    setRoles(rolesRes.data || []);
    setLoading(false);
  }

  async function removeMember(memberId) {
    await supabase.from("org_members").delete().eq("id", memberId);
    setMembers((prev) => prev.filter((m) => m.id !== memberId));
  }

  async function updateMemberRole(memberId, roleId) {
    await supabase.from("org_members").update({ role_id: roleId }).eq("id", memberId);
    fetchData();
  }

  async function revokeInvitation(id) {
    await supabase.from("invitations").update({ status: "revoked" }).eq("id", id);
    setInvitations((prev) => prev.filter((i) => i.id !== id));
  }

  async function createTeam(name) {
    if (!name.trim() || !org) return;
    await supabase.from("teams").insert({ org_id: org.id, name: name.trim() });
    refetch();
  }

  async function deleteTeam(teamId) {
    await supabase.from("teams").delete().eq("id", teamId);
    refetch();
  }

  if (!org) {
    return (
      <div className="p-8 text-center">
        <div className="text-[15px]" style={{ color: "#555" }}>No organization found.</div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mx-auto" style={{ maxWidth: 720 }}>
        <div className="mb-10">
          <span className="section-label">Configuration</span>
          <h1 className="page-title mt-1">Settings</h1>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1 mb-8 pb-3" style={{ borderBottom: "1px solid #1e1e1e" }}>
          <button
            onClick={() => navigate("/settings")}
            className="px-4 py-2 rounded text-[13px] font-semibold cursor-pointer"
            style={{ background: "transparent", border: "1px solid #1e1e1e", color: "#555" }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#333"; e.currentTarget.style.color = "#888"; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#1e1e1e"; e.currentTarget.style.color = "#555"; }}
          >
            Profile
          </button>
          <button
            className="px-4 py-2 rounded text-[13px] font-semibold cursor-pointer"
            style={{ background: "#1a1a1a", border: "1px solid #333", color: "#09BC8A" }}
          >
            Team
          </button>
        </div>

        {/* Organization Info */}
        <div className="surface mb-6" style={{ padding: "20px 24px" }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Building2 size={18} color="#09BC8A" />
              <div>
                <div className="text-[16px] font-semibold text-white">{org.name}</div>
                <div className="text-[12px] font-mono" style={{ color: "#555" }}>{org.slug}</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span
                className="text-[11px] font-mono font-semibold px-2 py-1 rounded"
                style={{
                  color: ROLE_COLORS[role?.name] || "#888",
                  background: `${ROLE_COLORS[role?.name] || "#888"}18`,
                  border: `1px solid ${ROLE_COLORS[role?.name] || "#888"}35`,
                }}
              >
                {ROLE_LABELS[role?.name] || role?.name}
              </span>
            </div>
          </div>
        </div>

        {/* Sub-tabs: Members | Teams | Invitations */}
        <div className="flex items-center gap-1 mb-6">
          {["members", "teams", ...(can("invite_member") ? ["invitations"] : [])].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className="px-3 py-1.5 rounded text-[12px] font-mono cursor-pointer"
              style={{
                background: activeTab === tab ? "#1a1a1a" : "transparent",
                border: "none",
                color: activeTab === tab ? "#09BC8A" : "#555",
              }}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
              {tab === "invitations" && invitations.length > 0 && (
                <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: "rgba(9,188,138,0.15)", color: "#09BC8A" }}>
                  {invitations.length}
                </span>
              )}
            </button>
          ))}
          <div className="flex-1" />
          {can("invite_member") && (
            <button
              onClick={() => setShowInvite(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded text-[12px] font-semibold cursor-pointer"
              style={{ background: "#09BC8A", color: "#0a0a0a", border: "none" }}
            >
              <UserPlus size={13} /> Invite Member
            </button>
          )}
        </div>

        {loading ? (
          <div className="flex items-center gap-2 justify-center py-12">
            <span className="pulse-dot" />
            <span className="pulse-dot" />
            <span className="pulse-dot" />
          </div>
        ) : (
          <>
            {/* Members Tab */}
            {activeTab === "members" && (
              <div className="space-y-2">
                {(() => {
                  // For team_managers: only show members in their teams
                  let visibleMembers = members;
                  if (isRole("team_manager")) {
                    const managedTeamIds = new Set(myTeams().map((t) => t.id));
                    const managedUserIds = new Set();
                    teams.forEach((t) => {
                      if (managedTeamIds.has(t.id)) {
                        t.team_members?.forEach((tm) => managedUserIds.add(tm.user_id));
                      }
                    });
                    visibleMembers = members.filter((m) => managedUserIds.has(m.user_id));
                  }
                  return visibleMembers;
                })().map((m) => (
                  <div
                    key={m.id}
                    className="surface flex items-center gap-4"
                    style={{ padding: "14px 20px" }}
                  >
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-[13px] font-semibold" style={{ background: "#1a1a1a", color: "#888", border: "1px solid #2a2a2a" }}>
                      {(m.profiles?.full_name || "?")[0].toUpperCase()}
                    </div>
                    <div className="flex-1">
                      <div className="text-[14px] text-white">{m.profiles?.full_name || "Unknown"}</div>
                      <div className="text-[12px] font-mono" style={{ color: "#555" }}>{m.user_id === user?.id ? "You" : ""}</div>
                    </div>
                    <span
                      className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded"
                      style={{
                        color: ROLE_COLORS[m.roles?.name] || "#888",
                        background: `${ROLE_COLORS[m.roles?.name] || "#888"}18`,
                        border: `1px solid ${ROLE_COLORS[m.roles?.name] || "#888"}35`,
                      }}
                    >
                      {ROLE_LABELS[m.roles?.name] || m.roles?.name}
                    </span>
                    {isOrgOwner() && m.user_id !== user?.id && (
                      <div className="flex items-center gap-2">
                        <select
                          value={m.role_id}
                          onChange={(e) => updateMemberRole(m.id, e.target.value)}
                          className="text-[11px] font-mono cursor-pointer outline-none rounded"
                          style={{ background: "#111", border: "1px solid #1e1e1e", color: "#888", padding: "4px 8px" }}
                        >
                          {roles.map((r) => (
                            <option key={r.id} value={r.id}>{ROLE_LABELS[r.name] || r.name}</option>
                          ))}
                        </select>
                        <button
                          onClick={() => removeMember(m.id)}
                          className="p-1.5 rounded cursor-pointer"
                          style={{ background: "transparent", border: "1px solid #1e1e1e", color: "#555" }}
                          onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#ef4444"; e.currentTarget.style.color = "#ef4444"; }}
                          onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#1e1e1e"; e.currentTarget.style.color = "#555"; }}
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
                {members.length === 0 && (
                  <div className="text-center py-8 text-[14px]" style={{ color: "#555" }}>No members found.</div>
                )}
              </div>
            )}

            {/* Teams Tab */}
            {activeTab === "teams" && (
              <div className="space-y-2">
                {teams.map((t) => (
                  <div
                    key={t.id}
                    className="surface flex items-center gap-4"
                    style={{ padding: "14px 20px" }}
                  >
                    <Users size={16} color="#3b82f6" />
                    <div className="flex-1">
                      <div className="text-[14px] text-white">{t.name}</div>
                      <div className="text-[11px] font-mono" style={{ color: "#555" }}>
                        {t.team_members?.length || 0} member{(t.team_members?.length || 0) !== 1 ? "s" : ""}
                      </div>
                    </div>
                    {isOrgOwner() && t.name !== "General" && (
                      <button
                        onClick={() => deleteTeam(t.id)}
                        className="p-1.5 rounded cursor-pointer"
                        style={{ background: "transparent", border: "1px solid #1e1e1e", color: "#555" }}
                        onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#ef4444"; e.currentTarget.style.color = "#ef4444"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#1e1e1e"; e.currentTarget.style.color = "#555"; }}
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                ))}
                {can("manage_teams") && (
                  <NewTeamInline onCreate={createTeam} />
                )}
              </div>
            )}

            {/* Invitations Tab */}
            {activeTab === "invitations" && (
              <div className="space-y-2">
                {invitations.map((inv) => (
                  <div
                    key={inv.id}
                    className="surface flex items-center gap-4"
                    style={{ padding: "14px 20px" }}
                  >
                    <Mail size={16} color="#f59e0b" />
                    <div className="flex-1">
                      <div className="text-[14px] text-white">{inv.email}</div>
                      <div className="text-[11px] font-mono" style={{ color: "#555" }}>
                        Expires {new Date(inv.expires_at).toLocaleDateString()}
                      </div>
                    </div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded" style={{ color: "#f59e0b", background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.2)" }}>
                      Pending
                    </span>
                    {can("invite_member") && (
                      <button
                        onClick={() => revokeInvitation(inv.id)}
                        className="text-[11px] px-2 py-1 rounded cursor-pointer"
                        style={{ background: "transparent", border: "1px solid #333", color: "#555" }}
                      >
                        Revoke
                      </button>
                    )}
                  </div>
                ))}
                {invitations.length === 0 && (
                  <div className="text-center py-8 text-[14px]" style={{ color: "#555" }}>No pending invitations.</div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {showInvite && (
        <InviteMemberModal
          orgId={org.id}
          roles={roles}
          teams={teams}
          onClose={() => setShowInvite(false)}
          onInvited={() => {
            setShowInvite(false);
            fetchData();
          }}
        />
      )}

      {showAssignment && (
        <CaseAssignmentModal
          caseId={showAssignment}
          members={members}
          onClose={() => setShowAssignment(null)}
        />
      )}
    </div>
  );
}

function NewTeamInline({ onCreate }) {
  const [name, setName] = useState("");
  const [show, setShow] = useState(false);

  if (!show) {
    return (
      <button
        onClick={() => setShow(true)}
        className="flex items-center gap-1.5 text-[13px] cursor-pointer"
        style={{ background: "transparent", border: "1px dashed #333", color: "#555", padding: "10px 16px", borderRadius: 8, width: "100%" }}
        onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#09BC8A"; e.currentTarget.style.color = "#09BC8A"; }}
        onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#333"; e.currentTarget.style.color = "#555"; }}
      >
        <Plus size={14} /> Create Team
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Team name"
        autoFocus
        className="flex-1 rounded text-[14px] text-white outline-none"
        style={{ background: "#0d0d0d", border: "1px solid #1e1e1e", padding: "8px 12px" }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && name.trim()) { onCreate(name); setName(""); setShow(false); }
          if (e.key === "Escape") { setShow(false); setName(""); }
        }}
      />
      <button
        onClick={() => { if (name.trim()) { onCreate(name); setName(""); setShow(false); } }}
        className="px-3 py-2 rounded text-[13px] font-semibold cursor-pointer"
        style={{ background: "#09BC8A", color: "#0a0a0a", border: "none" }}
      >
        Create
      </button>
      <button
        onClick={() => { setShow(false); setName(""); }}
        className="p-2 rounded cursor-pointer"
        style={{ background: "transparent", border: "none", color: "#555" }}
      >
        <X size={14} />
      </button>
    </div>
  );
}
