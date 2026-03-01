import { useState, useEffect } from "react";
import { Users, ClipboardCheck } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { useOrg } from "../../contexts/OrgContext";

export default function ManagerWorkloadPanel() {
  const { myTeams } = useOrg();
  const [memberWorkloads, setMemberWorkloads] = useState([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const managedTeams = myTeams();

  useEffect(() => {
    async function fetchWorkloads() {
      setLoading(true);

      // Get member IDs from managed teams
      const memberIds = new Set();
      managedTeams.forEach((t) =>
        t.team_members?.forEach((tm) => memberIds.add(tm.user_id))
      );

      if (memberIds.size > 0) {
        const { data: assignments } = await supabase
          .from("case_assignments")
          .select("user_id, case_id, cases(status), profiles:user_id(full_name)")
          .in("user_id", [...memberIds]);

        // Group by user
        const grouped = {};
        (assignments || []).forEach((a) => {
          if (!grouped[a.user_id]) {
            grouped[a.user_id] = {
              userId: a.user_id,
              name: a.profiles?.full_name || "Unknown",
              activeCases: 0,
            };
          }
          if (a.cases?.status === "active") grouped[a.user_id].activeCases++;
        });
        setMemberWorkloads(Object.values(grouped));
      }

      // Get pending reviews count
      const { count } = await supabase
        .from("assessments")
        .select("id", { count: "exact", head: true })
        .eq("status", "submitted");

      setPendingCount(count || 0);
      setLoading(false);
    }

    fetchWorkloads();
  }, [managedTeams.length]);

  if (loading) return null;

  return (
    <div className="mb-6">
      <div className="grid grid-cols-2 gap-4">
        {/* Workload overview */}
        <div className="surface p-4">
          <div className="flex items-center gap-2 mb-3">
            <Users size={14} color="#3b82f6" />
            <span className="text-[10px] font-mono tracking-wider" style={{ color: "#555" }}>TEAM WORKLOADS</span>
          </div>
          {memberWorkloads.length === 0 ? (
            <div className="text-[12px]" style={{ color: "#555" }}>No team assignments yet</div>
          ) : (
            <div className="space-y-2">
              {memberWorkloads.map((m) => (
                <div key={m.userId} className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-semibold" style={{ background: "#1a1a1a", color: "#888", border: "1px solid #2a2a2a" }}>
                    {(m.name || "?")[0].toUpperCase()}
                  </div>
                  <span className="text-[12px] flex-1" style={{ color: "#ccc" }}>{m.name}</span>
                  <span className="text-[11px] font-mono" style={{ color: m.activeCases > 5 ? "#ef4444" : "#09BC8A" }}>
                    {m.activeCases} case{m.activeCases !== 1 ? "s" : ""}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Pending reviews */}
        <div className="surface p-4">
          <div className="flex items-center gap-2 mb-3">
            <ClipboardCheck size={14} color="#f59e0b" />
            <span className="text-[10px] font-mono tracking-wider" style={{ color: "#555" }}>PENDING REVIEWS</span>
          </div>
          <div className="text-[28px] font-bold" style={{ color: pendingCount > 0 ? "#f59e0b" : "#555" }}>
            {pendingCount}
          </div>
          <div className="text-[11px]" style={{ color: "#555" }}>
            assessment{pendingCount !== 1 ? "s" : ""} awaiting approval
          </div>
        </div>
      </div>
    </div>
  );
}
