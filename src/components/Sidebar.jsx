import { NavLink, Link } from "react-router-dom";
import { User, Radio, Shield, Activity, GitMerge, Clock, Network, ArrowLeft } from "lucide-react";

const modules = [
  { key: "profile", label: "Profile", icon: User, path: "profile" },
  { key: "recon", label: "Recon Mirror", icon: Radio, path: "recon" },
  { key: "aegis", label: "Aegis Score", icon: Shield, path: "aegis" },
  { key: "patterns", label: "Pattern Lens", icon: Activity, path: "patterns" },
  { key: "crosswire", label: "CrossWire", icon: GitMerge, path: "crosswire" },
  { key: "timeline", label: "Timeline", icon: Clock, path: "timeline" },
  { key: "graph", label: "Link Graph", icon: Network, path: "graph" },
];

export default function Sidebar({ caseName, caseType }) {
  return (
    <div
      className="w-[240px] h-full flex flex-col shrink-0"
      style={{ background: "#0d0d0d", borderRight: "1px solid #1a1a1a" }}
    >
      {/* Nav modules */}
      <div className="flex-1 py-3 px-2 flex flex-col gap-1">
        <div className="px-3 py-2 mb-2">
          <span className="sub-label" style={{ color: "#444" }}>Modules</span>
        </div>
        {modules.map((mod) => (
          <NavLink
            key={mod.key}
            to={mod.path}
            className="flex items-center gap-3 px-3 rounded-md text-[14px] transition-all duration-150 no-underline"
            style={({ isActive }) => ({
              background: isActive ? "#1a1a1a" : "transparent",
              color: isActive ? "#fff" : "#888",
              borderLeft: isActive ? "2px solid #09BC8A" : "2px solid transparent",
              minHeight: 40,
            })}
          >
            <mod.icon size={16} />
            <span>{mod.label}</span>
          </NavLink>
        ))}
      </div>

      {/* Case info at bottom */}
      <div className="px-4 py-4" style={{ borderTop: "1px solid #1a1a1a" }}>
        {caseName && (
          <div className="mb-3">
            <div className="sub-label mb-1" style={{ color: "#444" }}>Case</div>
            <div className="text-[13px] text-white truncate">{caseName}</div>
            {caseType && (
              <span className="badge badge-accent mt-1" style={{ fontSize: 11 }}>
                {caseType}
              </span>
            )}
          </div>
        )}
        <Link
          to="/dashboard"
          className="flex items-center gap-2 text-[13px] no-underline transition-colors"
          style={{ color: "#555" }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "#09BC8A")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "#555")}
        >
          <ArrowLeft size={14} />
          All Cases
        </Link>
      </div>
    </div>
  );
}
