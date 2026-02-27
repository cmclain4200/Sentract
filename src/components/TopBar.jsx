import { useState, useRef, useEffect } from "react";
import { ChevronDown, LogOut, Settings } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { useNavigate } from "react-router-dom";

export default function TopBar() {
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  async function handleSignOut() {
    await signOut();
    navigate("/login");
  }

  const displayName = profile?.full_name || user?.email || "User";

  return (
    <div
      className="h-12 flex items-center justify-between px-5 shrink-0"
      style={{ background: "#0d0d0d", borderBottom: "1px solid #1a1a1a" }}
    >
      <div className="flex items-center gap-3">
        <img
          src="/sentract-logo.png"
          alt="Sentract"
          style={{ width: 22, height: 22, filter: "invert(1)" }}
        />
        <span className="text-[16px] font-semibold text-white tracking-tight">
          Sentract
        </span>
      </div>

      <div className="flex items-center gap-6">
        {/* User dropdown */}
        <div className="relative" ref={ref}>
          <button
            onClick={() => setOpen(!open)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-md transition-all duration-200 cursor-pointer"
            style={{
              background: open ? "#1a1a1a" : "transparent",
              border: "1px solid #1e1e1e",
            }}
            onMouseEnter={(e) => {
              if (!open) e.currentTarget.style.background = "#141414";
            }}
            onMouseLeave={(e) => {
              if (!open) e.currentTarget.style.background = "transparent";
            }}
          >
            <span className="text-[13px]" style={{ color: "#ccc" }}>
              {displayName}
            </span>
            <ChevronDown
              size={13}
              color="#555"
              style={{
                transform: open ? "rotate(180deg)" : "rotate(0deg)",
                transition: "transform 0.2s ease",
              }}
            />
          </button>

          {open && (
            <div
              className="absolute right-0 top-full mt-1 w-[200px] rounded-md overflow-hidden z-50 fade-in"
              style={{
                background: "#111",
                border: "1px solid #222",
                boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
              }}
            >
              <div className="px-4 py-3" style={{ borderBottom: "1px solid #1e1e1e" }}>
                <div className="text-[12px] font-mono" style={{ color: "#999" }}>
                  {user?.email}
                </div>
                {profile?.organization && (
                  <div className="text-[11px] mt-0.5" style={{ color: "#555" }}>
                    {profile.organization}
                  </div>
                )}
              </div>
              <button
                onClick={() => { navigate("/settings"); setOpen(false); }}
                className="w-full flex items-center gap-2 px-4 py-2.5 text-left transition-all duration-150 cursor-pointer"
                style={{ background: "transparent", border: "none" }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "#1a1a1a")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                <Settings size={13} color="#888" />
                <span className="text-[13px]" style={{ color: "#888" }}>
                  Settings
                </span>
              </button>
              <button
                onClick={handleSignOut}
                className="w-full flex items-center gap-2 px-4 py-2.5 text-left transition-all duration-150 cursor-pointer"
                style={{ background: "transparent", border: "none" }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "#1a1a1a")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                <LogOut size={13} color="#888" />
                <span className="text-[13px]" style={{ color: "#888" }}>
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
              className="w-[6px] h-[6px] rounded-full"
              style={{ background: "#10b981", boxShadow: "0 0 6px rgba(16,185,129,0.4)" }}
            />
            <span className="text-[13px]" style={{ color: "#10b981" }}>Active</span>
          </span>
        </div>
      </div>
    </div>
  );
}
