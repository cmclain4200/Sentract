import { useState, useEffect } from "react";
import { Users, Briefcase, Target, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { useOrg } from "../../contexts/OrgContext";

export default function OwnerStatsPanel({ cases }) {
  const { teams } = useOrg();
  const navigate = useNavigate();
  const [subjectCount, setSubjectCount] = useState(0);

  useEffect(() => {
    supabase
      .from("subjects")
      .select("id", { count: "exact", head: true })
      .then(({ count }) => {
        if (count != null) setSubjectCount(count);
      });
  }, []);

  const activeCases = cases.filter((c) => c.status === "active").length;
  const avgRisk = cases.length > 0
    ? Math.round(cases.reduce((sum, c) => sum + (c.priority_score || 0), 0) / cases.length)
    : 0;

  return (
    <div className="mb-6">
      {/* Org-wide stats */}
      <div className="grid grid-cols-3 gap-4 mb-4">
        <div className="surface p-4">
          <div className="flex items-center gap-2 mb-2">
            <Briefcase size={14} color="#09BC8A" />
            <span className="text-[10px] font-mono tracking-wider" style={{ color: "#555" }}>TOTAL CASES</span>
          </div>
          <div className="text-[28px] font-bold text-white">{cases.length}</div>
          <div className="text-[11px]" style={{ color: "#555" }}>{activeCases} active</div>
        </div>
        <div className="surface p-4">
          <div className="flex items-center gap-2 mb-2">
            <Target size={14} color="#f59e0b" />
            <span className="text-[10px] font-mono tracking-wider" style={{ color: "#555" }}>TOTAL SUBJECTS</span>
          </div>
          <div className="text-[28px] font-bold text-white">{subjectCount}</div>
        </div>
        <div className="surface p-4">
          <div className="flex items-center gap-2 mb-2">
            <Users size={14} color="#3b82f6" />
            <span className="text-[10px] font-mono tracking-wider" style={{ color: "#555" }}>TEAMS</span>
          </div>
          <div className="text-[28px] font-bold text-white">{teams.length}</div>
        </div>
      </div>

      {/* Team breakdown */}
      {teams.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          {teams.map((team) => (
            <div key={team.id} className="surface p-4 flex items-center gap-3">
              <div className="w-8 h-8 rounded flex items-center justify-center" style={{ background: "rgba(59,130,246,0.1)" }}>
                <Users size={14} color="#3b82f6" />
              </div>
              <div className="flex-1">
                <div className="text-[13px] font-semibold text-white">{team.name}</div>
                <div className="text-[11px] font-mono" style={{ color: "#555" }}>
                  {team.team_members?.length || 0} member{(team.team_members?.length || 0) !== 1 ? "s" : ""}
                </div>
              </div>
              <button
                onClick={() => navigate("/settings/team")}
                className="p-1.5 rounded cursor-pointer"
                style={{ background: "transparent", border: "1px solid #1e1e1e", color: "#555" }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#09BC8A"; e.currentTarget.style.color = "#09BC8A"; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#1e1e1e"; e.currentTarget.style.color = "#555"; }}
              >
                <ArrowRight size={12} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
