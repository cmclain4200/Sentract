import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Users, Plus, Trash2, Mail, Shield, ChevronDown, X, UserPlus, Building2, Copy, Pencil, Check, Briefcase } from "lucide-react";
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
  const [copiedId, setCopiedId] = useState(null);
  const [editingOrgName, setEditingOrgName] = useState(false);
  const [orgNameDraft, setOrgNameDraft] = useState("");
  const [savingOrgName, setSavingOrgName] = useState(false);
  const [expandedTeam, setExpandedTeam] = useState(null);
  const [teamCaseCounts, setTeamCaseCounts] = useState({});

  useEffect(() => {
    if (!org) return;
    fetchData();
    // Fetch case counts per team
    supabase
      .from("cases")
      .select("team_id")
      .not("team_id", "is", null)
      .then(({ data }) => {
        if (!data) return;
        const counts = {};
        for (const c of data) {
          counts[c.team_id] = (counts[c.team_id] || 0) + 1;
        }
        setTeamCaseCounts(counts);
      });
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

  async function removeMember(member) {
    await supabase.from("team_members").delete().eq("user_id", member.user_id);
    await supabase.from("case_assignments").delete().eq("user_id", member.user_id);
    await supabase.from("org_members").delete().eq("id", member.id);
    setMembers((prev) => prev.filter((m) => m.id !== member.id));
    refetch();
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

  async function removeTeamMember(teamId, userId) {
    await supabase.from("team_members").delete().match({ team_id: teamId, user_id: userId });
    refetch();
  }

  async function addTeamMember(teamId, userId) {
    await supabase.from("team_members").insert({ team_id: teamId, user_id: userId });
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
                {editingOrgName ? (
                  <form
                    className="flex items-center gap-2"
                    onSubmit={async (e) => {
                      e.preventDefault();
                      const trimmed = orgNameDraft.trim();
                      if (!trimmed || trimmed === org.name) { setEditingOrgName(false); return; }
                      setSavingOrgName(true);
                      const { error } = await supabase
                        .from("organizations")
                        .update({ name: trimmed })
                        .eq("id", org.id);
                      setSavingOrgName(false);
                      if (!error) {
                        setEditingOrgName(false);
                        refetch();
                      }
                    }}
                  >
                    <input
                      type="text"
                      value={orgNameDraft}
                      onChange={(e) => setOrgNameDraft(e.target.value)}
                      autoFocus
                      className="rounded text-[16px] font-semibold text-white outline-none"
                      style={{ background: "#0d0d0d", border: "1px solid #333", padding: "4px 10px", width: 240 }}
                      onKeyDown={(e) => e.key === "Escape" && setEditingOrgName(false)}
                    />
                    <button
                      type="submit"
                      disabled={savingOrgName}
                      className="flex items-center justify-center rounded cursor-pointer"
                      style={{ background: "rgba(9,188,138,0.15)", border: "1px solid rgba(9,188,138,0.3)", width: 32, height: 32 }}
                    >
                      <Check size={14} color="#09BC8A" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingOrgName(false)}
                      className="flex items-center justify-center rounded cursor-pointer"
                      style={{ background: "transparent", border: "1px solid #333", width: 32, height: 32 }}
                    >
                      <X size={14} color="#555" />
                    </button>
                  </form>
                ) : (
                  <div className="flex items-center gap-2">
                    <div className="text-[16px] font-semibold text-white">{org.name}</div>
                    {isOrgOwner() && (
                      <button
                        onClick={() => { setOrgNameDraft(org.name); setEditingOrgName(true); }}
                        className="flex items-center justify-center rounded cursor-pointer"
                        style={{ background: "transparent", border: "none", width: 28, height: 28 }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = "#1a1a1a")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                      >
                        <Pencil size={12} color="#555" />
                      </button>
                    )}
                  </div>
                )}
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
        <div className="flex items-center gap-3 mb-6">
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
                          onClick={() => removeMember(m)}
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
                {teams.length === 0 && (
                  <div className="surface text-center" style={{ padding: "32px 24px" }}>
                    <Users size={28} color="#333" style={{ margin: "0 auto 12px" }} />
                    <div className="text-[15px] font-semibold text-white mb-1">No teams yet</div>
                    <div className="text-[13px]" style={{ color: "#555" }}>Create a team to organize members and cases.</div>
                  </div>
                )}
                {teams.map((t) => {
                  const isExpanded = expandedTeam === t.id;
                  const memberCount = t.team_members?.length || 0;
                  const caseCount = teamCaseCounts[t.id] || 0;
                  const teamMemberIds = new Set((t.team_members || []).map((tm) => tm.user_id));
                  const teamMemberDetails = members.filter((m) => teamMemberIds.has(m.user_id));
                  const availableMembers = members.filter((m) => !teamMemberIds.has(m.user_id));

                  return (
                    <div key={t.id} className="surface overflow-hidden" style={{ border: isExpanded ? "1px solid #333" : undefined }}>
                      {/* Header row */}
                      <div
                        className="flex items-center gap-4 cursor-pointer"
                        style={{ padding: "14px 20px" }}
                        onClick={() => setExpandedTeam(isExpanded ? null : t.id)}
                      >
                        <Users size={16} color="#3b82f6" />
                        <div className="flex-1">
                          <div className="text-[14px] text-white">{t.name}</div>
                          <div className="flex items-center gap-3 text-[11px] font-mono" style={{ color: "#555" }}>
                            <span>{memberCount} member{memberCount !== 1 ? "s" : ""}</span>
                            <span>·</span>
                            <span className="flex items-center gap-1"><Briefcase size={10} /> {caseCount} case{caseCount !== 1 ? "s" : ""}</span>
                          </div>
                        </div>
                        <ChevronDown
                          size={14}
                          color="#555"
                          style={{ transform: isExpanded ? "rotate(180deg)" : "none", transition: "0.2s" }}
                        />
                        {isOrgOwner() && t.name !== "General" && (
                          <button
                            onClick={(e) => { e.stopPropagation(); deleteTeam(t.id); }}
                            className="p-1.5 rounded cursor-pointer"
                            style={{ background: "transparent", border: "1px solid #1e1e1e", color: "#555" }}
                            onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#ef4444"; e.currentTarget.style.color = "#ef4444"; }}
                            onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#1e1e1e"; e.currentTarget.style.color = "#555"; }}
                          >
                            <Trash2 size={12} />
                          </button>
                        )}
                      </div>

                      {/* Expanded section */}
                      {isExpanded && (
                        <div className="fade-in" style={{ borderTop: "1px solid #1a1a1a", padding: "12px 20px" }}>
                          {teamMemberDetails.length === 0 && (
                            <div className="text-[13px] py-2" style={{ color: "#555" }}>No members in this team.</div>
                          )}
                          {teamMemberDetails.map((m) => (
                            <div key={m.id} className="flex items-center gap-3 py-2" style={{ borderBottom: "1px solid #111" }}>
                              <div className="w-7 h-7 rounded-full flex items-center justify-center text-[12px] font-semibold" style={{ background: "#1a1a1a", color: "#888", border: "1px solid #2a2a2a" }}>
                                {(m.profiles?.full_name || "?")[0].toUpperCase()}
                              </div>
                              <div className="flex-1">
                                <span className="text-[13px] text-white">{m.profiles?.full_name || "Unknown"}</span>
                              </div>
                              <span
                                className="text-[9px] font-mono font-semibold px-1.5 py-0.5 rounded"
                                style={{
                                  color: ROLE_COLORS[m.roles?.name] || "#888",
                                  background: `${ROLE_COLORS[m.roles?.name] || "#888"}18`,
                                  border: `1px solid ${ROLE_COLORS[m.roles?.name] || "#888"}35`,
                                }}
                              >
                                {ROLE_LABELS[m.roles?.name] || m.roles?.name}
                              </span>
                              {isOrgOwner() && (
                                <button
                                  onClick={() => removeTeamMember(t.id, m.user_id)}
                                  className="text-[11px] px-2 py-1 rounded cursor-pointer"
                                  style={{ background: "transparent", border: "1px solid #1e1e1e", color: "#555" }}
                                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#ef4444"; e.currentTarget.style.color = "#ef4444"; }}
                                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#1e1e1e"; e.currentTarget.style.color = "#555"; }}
                                >
                                  Remove
                                </button>
                              )}
                            </div>
                          ))}
                          {isOrgOwner() && availableMembers.length > 0 && (
                            <AddTeamMemberInline members={availableMembers} onAdd={(userId) => addTeamMember(t.id, userId)} />
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
                <NewTeamInline onCreate={createTeam} />
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
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(`${window.location.origin}/signup?invite=${inv.id}`);
                        setCopiedId(inv.id);
                        setTimeout(() => setCopiedId(null), 2000);
                      }}
                      className="flex items-center gap-1 text-[11px] px-2 py-1 rounded cursor-pointer"
                      style={{
                        background: "transparent",
                        border: `1px solid ${copiedId === inv.id ? "#09BC8A" : "#333"}`,
                        color: copiedId === inv.id ? "#09BC8A" : "#555",
                      }}
                    >
                      <Copy size={10} />
                      {copiedId === inv.id ? "Copied!" : "Copy Link"}
                    </button>
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
          orgName={org.name}
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

function AddTeamMemberInline({ members, onAdd }) {
  const [show, setShow] = useState(false);
  const [selected, setSelected] = useState("");

  if (!show) {
    return (
      <button
        onClick={() => setShow(true)}
        className="flex items-center gap-1.5 text-[12px] cursor-pointer mt-2"
        style={{ background: "transparent", border: "1px dashed #333", color: "#555", padding: "6px 12px", borderRadius: 6 }}
        onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#09BC8A"; e.currentTarget.style.color = "#09BC8A"; }}
        onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#333"; e.currentTarget.style.color = "#555"; }}
      >
        <Plus size={12} /> Add Member
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2 mt-2">
      <select
        value={selected}
        onChange={(e) => setSelected(e.target.value)}
        autoFocus
        className="flex-1 text-[13px] rounded outline-none"
        style={{ background: "#0d0d0d", border: "1px solid #1e1e1e", color: "#ccc", padding: "6px 10px" }}
      >
        <option value="">Select member...</option>
        {members.map((m) => (
          <option key={m.id} value={m.user_id}>{m.profiles?.full_name || "Unknown"}</option>
        ))}
      </select>
      <button
        onClick={() => { if (selected) { onAdd(selected); setSelected(""); setShow(false); } }}
        disabled={!selected}
        className="px-3 py-1.5 rounded text-[12px] font-semibold cursor-pointer"
        style={{ background: selected ? "#09BC8A" : "#1a1a1a", color: selected ? "#0a0a0a" : "#555", border: "none" }}
      >
        Add
      </button>
      <button
        onClick={() => { setShow(false); setSelected(""); }}
        className="p-1.5 rounded cursor-pointer"
        style={{ background: "transparent", border: "none", color: "#555" }}
      >
        <X size={12} />
      </button>
    </div>
  );
}
