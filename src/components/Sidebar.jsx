import { NavLink, Link } from "react-router-dom";
import { User, Radio, Shield, Activity, GitBranch, ArrowLeft } from "lucide-react";

const modules = [
  { key: "profile", label: "Profile", icon: User, path: "profile" },
  { key: "recon", label: "Recon Mirror", icon: Radio, path: "recon" },
  { key: "aegis", label: "Aegis Score", icon: Shield, path: "aegis" },
  { key: "patterns", label: "Pattern Lens", icon: Activity, path: "patterns" },
  { key: "crosswire", label: "CrossWire", icon: GitBranch, path: "crosswire" },
];

export default function Sidebar({ caseName, caseType }) {
  return (
    <div
      className="w-[220px] h-full flex flex-col shrink-0"
      style={{ background: "#0d0d0d", borderRight: "1px solid #1a1a1a" }}
    >
      {/* Nav modules */}
      <div className="flex-1 py-3 px-2 flex flex-col gap-0.5">
        <div className="px-3 py-2 mb-2">
          <span className="sub-label" style={{ color: "#444" }}>Modules</span>
        </div>
        {modules.map((mod) => (
          <NavLink
            key={mod.key}
            to={mod.path}
            className="flex items-center gap-2.5 px-3 py-2 rounded-md text-[13px] transition-all duration-150 no-underline"
            style={({ isActive }) => ({
              background: isActive ? "#1a1a1a" : "transparent",
              color: isActive ? "#fff" : "#888",
              borderLeft: isActive ? "2px solid #00d4aa" : "2px solid transparent",
            })}
          >
            <mod.icon size={14} />
            <span>{mod.label}</span>
          </NavLink>
        ))}
      </div>

      {/* Case info at bottom */}
      <div className="px-4 py-3" style={{ borderTop: "1px solid #1a1a1a" }}>
        {caseName && (
          <div className="mb-3">
            <div className="sub-label mb-1" style={{ color: "#444" }}>Case</div>
            <div className="text-[12px] text-white truncate">{caseName}</div>
            {caseType && (
              <span className="badge badge-accent mt-1" style={{ fontSize: 9 }}>
                {caseType}
              </span>
            )}
          </div>
        )}
        <Link
          to="/dashboard"
          className="flex items-center gap-1.5 text-[12px] no-underline transition-colors"
          style={{ color: "#555" }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "#00d4aa")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "#555")}
        >
          <ArrowLeft size={12} />
          All Cases
        </Link>
      </div>
    </div>
  );
}
