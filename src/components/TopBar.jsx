import { useState, useRef, useEffect } from "react";
import { ChevronDown, LogOut, Settings, ArrowLeft, Users } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { useOrg } from "../contexts/OrgContext";
import { useNavigate, useMatch } from "react-router-dom";
import { supabase } from "../lib/supabase";
import AlertBell from "./AlertBell";
import ApprovalBadge from "./ApprovalBadge";
import RoleBadge from "./RoleBadge";

const CASE_TYPES = [
  { value: "EP", label: "Executive Protection", color: "#09BC8A" },
  { value: "CT", label: "Counter-Threat", color: "#f59e0b" },
  { value: "CI", label: "Corporate Intel", color: "#3b82f6" },
];

function typeColor(type) {
  return CASE_TYPES.find((t) => t.value === type)?.color || "#888";
}

export default function TopBar() {
  const { user, profile, signOut } = useAuth();
  const { org, role, isRole } = useOrg();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  // Case dropdown state
  const caseMatch = useMatch("/case/:caseId/*");
  const caseId = caseMatch?.params?.caseId;
  const [cases, setCases] = useState([]);
  const [caseOpen, setCaseOpen] = useState(false);
  const caseRef = useRef(null);

  // Fetch all cases when inside a case route
  useEffect(() => {
    if (!caseId || !user) return;
    supabase
      .from("cases")
      .select("id, name, type, status")
      .order("updated_at", { ascending: false })
      .then(({ data }) => {
        if (data) setCases(data);
      });
  }, [caseId, user?.id]);

  // Close user dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Close case dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (caseRef.current && !caseRef.current.contains(e.target)) setCaseOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  async function handleSignOut() {
    await signOut();
    navigate("/login");
  }

  const displayName = profile?.full_name || user?.email || "User";
  const currentCase = cases.find((c) => c.id === caseId);

  return (
    <div
      className="flex items-center justify-between px-6 shrink-0"
      style={{ background: "#0d0d0d", borderBottom: "1px solid #1a1a1a", height: 56 }}
    >
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate("/")}
          className="flex items-center gap-3 cursor-pointer"
          style={{ background: "transparent", border: "none", padding: 0 }}
        >
          <img
            src="/sentract-logo-dark.png"
            alt="Sentract"
            style={{ height: 24 }}
          />
        </button>

        {/* Case dropdown (hidden for clients) */}
        {currentCase && !isRole("client") && (
          <div className="relative" ref={caseRef}>
            <button
              onClick={() => setCaseOpen(!caseOpen)}
              className="flex items-center gap-2 rounded-md transition-all duration-200 cursor-pointer"
              style={{
                background: caseOpen ? "#1a1a1a" : "transparent",
                border: "1px solid #1e1e1e",
                padding: "6px 12px",
                minHeight: 36,
              }}
              onMouseEnter={(e) => {
                if (!caseOpen) e.currentTarget.style.background = "#141414";
              }}
              onMouseLeave={(e) => {
                if (!caseOpen) e.currentTarget.style.background = "transparent";
              }}
            >
              <span
                className="text-[11px] font-mono font-semibold px-1.5 py-0.5 rounded"
                style={{
                  color: typeColor(currentCase.type),
                  background: `${typeColor(currentCase.type)}18`,
                  border: `1px solid ${typeColor(currentCase.type)}35`,
                }}
              >
                {currentCase.type}
              </span>
              <span className="text-[13px] truncate" style={{ color: "#ccc", maxWidth: 240 }}>
                {currentCase.name}
              </span>
              <ChevronDown
                size={13}
                color="#555"
                style={{
                  transform: caseOpen ? "rotate(180deg)" : "rotate(0deg)",
                  transition: "transform 0.2s ease",
                }}
              />
            </button>

            {caseOpen && (
              <div
                className="absolute left-0 top-full mt-1 w-[320px] rounded-md overflow-hidden z-50 fade-in"
                style={{
                  background: "#111",
                  border: "1px solid #222",
                  boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
                }}
              >
                <div className="py-1" style={{ maxHeight: 300, overflowY: "auto" }}>
                  {cases
                    .filter((c) => c.status !== "archived")
                    .map((c) => (
                    <button
                      key={c.id}
                      onClick={() => {
                        navigate(`/case/${c.id}/profile`);
                        setCaseOpen(false);
                      }}
                      className="w-full flex items-center gap-2.5 px-4 text-left transition-all duration-150 cursor-pointer"
                      style={{
                        background: c.id === caseId ? "#1a1a1a" : "transparent",
                        border: "none",
                        minHeight: 40,
                        padding: "0 16px",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "#1a1a1a")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = c.id === caseId ? "#1a1a1a" : "transparent")}
                    >
                      <span
                        className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded shrink-0"
                        style={{
                          color: typeColor(c.type),
                          background: `${typeColor(c.type)}18`,
                          border: `1px solid ${typeColor(c.type)}35`,
                        }}
                      >
                        {c.type}
                      </span>
                      <span
                        className="text-[13px] truncate"
                        style={{ color: c.id === caseId ? "#fff" : "#999" }}
                      >
                        {c.name}
                      </span>
                    </button>
                  ))}
                </div>
                <div style={{ borderTop: "1px solid #1e1e1e" }}>
                  <button
                    onClick={() => {
                      navigate("/dashboard");
                      setCaseOpen(false);
                    }}
                    className="w-full flex items-center gap-2 px-4 text-left transition-all duration-150 cursor-pointer"
                    style={{ background: "transparent", border: "none", minHeight: 40, padding: "0 16px" }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "#1a1a1a")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    <ArrowLeft size={13} color="#555" />
                    <span className="text-[13px]" style={{ color: "#555" }}>
                      All Cases
                    </span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center gap-6">
        {/* Approval Badge for managers/reviewers */}
        <ApprovalBadge onClick={() => navigate("/dashboard")} />
        {/* Alert Bell */}
        <AlertBell />
        {/* User dropdown */}
        <div className="relative" ref={ref}>
          <button
            onClick={() => setOpen(!open)}
            className="flex items-center gap-2 rounded-md transition-all duration-200 cursor-pointer"
            style={{
              background: open ? "#1a1a1a" : "transparent",
              border: "1px solid #1e1e1e",
              padding: "8px 14px",
              minHeight: 40,
            }}
            onMouseEnter={(e) => {
              if (!open) e.currentTarget.style.background = "#141414";
            }}
            onMouseLeave={(e) => {
              if (!open) e.currentTarget.style.background = "transparent";
            }}
          >
            <span className="text-[14px]" style={{ color: "#ccc" }}>
              {displayName}
            </span>
            {role?.name && <RoleBadge roleName={role.name} size="sm" />}
            <ChevronDown
              size={14}
              color="#555"
              style={{
                transform: open ? "rotate(180deg)" : "rotate(0deg)",
                transition: "transform 0.2s ease",
              }}
            />
          </button>

          {open && (
            <div
              className="absolute right-0 top-full mt-1 w-[220px] rounded-md overflow-hidden z-50 fade-in"
              style={{
                background: "#111",
                border: "1px solid #222",
                boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
              }}
            >
              <div className="px-4 py-3" style={{ borderBottom: "1px solid #1e1e1e" }}>
                <div className="text-[13px] font-mono" style={{ color: "#999" }}>
                  {user?.email}
                </div>
                {org?.name && (
                  <div className="text-[12px] mt-0.5" style={{ color: "#555" }}>
                    {org.name}
                  </div>
                )}
              </div>
              <button
                onClick={() => { navigate("/settings"); setOpen(false); }}
                className="w-full flex items-center gap-2.5 px-4 text-left transition-all duration-150 cursor-pointer"
                style={{ background: "transparent", border: "none", minHeight: 42, padding: "0 16px" }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "#1a1a1a")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                <Settings size={15} color="#888" />
                <span className="text-[14px]" style={{ color: "#888" }}>
                  Settings
                </span>
              </button>
              <button
                onClick={() => { navigate("/settings/team"); setOpen(false); }}
                className="w-full flex items-center gap-2.5 px-4 text-left transition-all duration-150 cursor-pointer"
                style={{ background: "transparent", border: "none", minHeight: 42, padding: "0 16px" }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "#1a1a1a")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                <Users size={15} color="#888" />
                <span className="text-[14px]" style={{ color: "#888" }}>
                  Team
                </span>
              </button>
              <button
                onClick={handleSignOut}
                className="w-full flex items-center gap-2.5 px-4 text-left transition-all duration-150 cursor-pointer"
                style={{ background: "transparent", border: "none", minHeight: 42, padding: "0 16px" }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "#1a1a1a")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                <LogOut size={15} color="#888" />
                <span className="text-[14px]" style={{ color: "#888" }}>
                  Sign out
                </span>
              </button>
            </div>
          )}
        </div>

        {/* Status */}
        <div className="flex items-center gap-2">
          <span className="sub-label" style={{ color: "#555" }}>Status</span>
          <span className="flex items-center gap-1.5">
            <span
              className="w-[7px] h-[7px] rounded-full"
              style={{ background: "#10b981", boxShadow: "0 0 6px rgba(16,185,129,0.4)" }}
            />
            <span className="text-[14px]" style={{ color: "#10b981" }}>Active</span>
          </span>
        </div>
      </div>
    </div>
  );
}
