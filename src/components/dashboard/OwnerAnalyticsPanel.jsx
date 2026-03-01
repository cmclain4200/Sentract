import { useState, useEffect, useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { Activity, Clock, XCircle, Send } from "lucide-react";
import { supabase } from "../../lib/supabase";

const STATUS_COLORS = {
  draft: "#555",
  submitted: "#f59e0b",
  approved: "#09BC8A",
  rejected: "#ef4444",
  published: "#3b82f6",
};

export default function OwnerAnalyticsPanel() {
  const [assessments, setAssessments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("assessments")
      .select("id, status, created_at, submitted_at, reviewed_at, module, user_id")
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        setAssessments(data || []);
        setLoading(false);
      });
  }, []);

  const metrics = useMemo(() => {
    const total = assessments.length;

    // Average review turnaround (submitted_at → reviewed_at)
    const reviewed = assessments.filter((a) => a.submitted_at && a.reviewed_at);
    const avgTurnaroundHrs = reviewed.length > 0
      ? Math.round(
          reviewed.reduce((sum, a) => {
            const diff = new Date(a.reviewed_at) - new Date(a.submitted_at);
            return sum + diff / (1000 * 60 * 60);
          }, 0) / reviewed.length
        )
      : null;

    // Rejection rate
    const approved = assessments.filter((a) => a.status === "approved" || a.status === "published").length;
    const rejected = assessments.filter((a) => a.status === "rejected").length;
    const rejectionRate = approved + rejected > 0 ? Math.round((rejected / (approved + rejected)) * 100) : 0;

    // Pending review count
    const pendingReview = assessments.filter((a) => a.status === "submitted").length;

    return { total, avgTurnaroundHrs, rejectionRate, pendingReview };
  }, [assessments]);

  const pipelineData = useMemo(() => {
    const counts = {};
    assessments.forEach((a) => {
      counts[a.status] = (counts[a.status] || 0) + 1;
    });
    return ["draft", "submitted", "approved", "rejected", "published"]
      .filter((s) => counts[s])
      .map((s) => ({ status: s.charAt(0).toUpperCase() + s.slice(1), count: counts[s] || 0, fill: STATUS_COLORS[s] }));
  }, [assessments]);

  const weeklyData = useMemo(() => {
    const now = new Date();
    const thirtyDaysAgo = new Date(now - 30 * 86400000);
    const weeks = {};

    assessments.forEach((a) => {
      const d = new Date(a.created_at);
      if (d < thirtyDaysAgo) return;
      // Group by ISO week start (Monday)
      const dayOfWeek = d.getDay();
      const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      const monday = new Date(d);
      monday.setDate(d.getDate() + mondayOffset);
      const key = monday.toISOString().slice(0, 10);
      weeks[key] = (weeks[key] || 0) + 1;
    });

    return Object.entries(weeks)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([week, count]) => ({
        week: new Date(week).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
        count,
      }));
  }, [assessments]);

  if (loading) return null;
  if (assessments.length === 0) return null;

  return (
    <div className="mb-6">
      {/* Summary Metrics */}
      <div className="grid grid-cols-4 gap-4 mb-4">
        <div className="surface p-4">
          <div className="flex items-center gap-2 mb-2">
            <Activity size={14} color="#09BC8A" />
            <span className="text-[10px] font-mono tracking-wider" style={{ color: "#555" }}>TOTAL ASSESSMENTS</span>
          </div>
          <div className="text-[28px] font-bold text-white">{metrics.total}</div>
        </div>
        <div className="surface p-4">
          <div className="flex items-center gap-2 mb-2">
            <Clock size={14} color="#3b82f6" />
            <span className="text-[10px] font-mono tracking-wider" style={{ color: "#555" }}>AVG REVIEW TIME</span>
          </div>
          <div className="text-[28px] font-bold text-white">
            {metrics.avgTurnaroundHrs != null ? `${metrics.avgTurnaroundHrs}h` : "—"}
          </div>
        </div>
        <div className="surface p-4">
          <div className="flex items-center gap-2 mb-2">
            <XCircle size={14} color="#ef4444" />
            <span className="text-[10px] font-mono tracking-wider" style={{ color: "#555" }}>REJECTION RATE</span>
          </div>
          <div className="text-[28px] font-bold text-white">{metrics.rejectionRate}%</div>
        </div>
        <div className="surface p-4">
          <div className="flex items-center gap-2 mb-2">
            <Send size={14} color="#f59e0b" />
            <span className="text-[10px] font-mono tracking-wider" style={{ color: "#555" }}>PENDING REVIEW</span>
          </div>
          <div className="text-[28px] font-bold text-white">{metrics.pendingReview}</div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-2 gap-4">
        {/* Pipeline Status */}
        {pipelineData.length > 0 && (
          <div className="surface p-5">
            <div className="text-[10px] font-mono tracking-wider mb-4" style={{ color: "#555" }}>PIPELINE STATUS</div>
            <div style={{ width: "100%", height: 200 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={pipelineData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e1e1e" />
                  <XAxis dataKey="status" tick={{ fill: "#555", fontSize: 11 }} stroke="#1e1e1e" />
                  <YAxis tick={{ fill: "#555", fontSize: 11 }} stroke="#1e1e1e" allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "#0a0a0a", border: "1px solid #1e1e1e", borderRadius: "6px", fontSize: "12px", color: "#fff", padding: "8px 12px" }}
                    formatter={(value) => [value, "Count"]}
                    cursor={{ fill: "rgba(255,255,255,0.03)" }}
                  />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]} activeBar={{ stroke: "#333", strokeWidth: 1 }}>
                    {pipelineData.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Weekly Volume */}
        {weeklyData.length > 0 && (
          <div className="surface p-5">
            <div className="text-[10px] font-mono tracking-wider mb-4" style={{ color: "#555" }}>WEEKLY VOLUME (30 DAYS)</div>
            <div style={{ width: "100%", height: 200 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weeklyData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e1e1e" />
                  <XAxis dataKey="week" tick={{ fill: "#555", fontSize: 11 }} stroke="#1e1e1e" />
                  <YAxis tick={{ fill: "#555", fontSize: 11 }} stroke="#1e1e1e" allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "#0a0a0a", border: "1px solid #1e1e1e", borderRadius: "6px", fontSize: "12px", color: "#fff", padding: "8px 12px" }}
                    formatter={(value) => [value, "Assessments"]}
                    cursor={{ fill: "rgba(255,255,255,0.03)" }}
                  />
                  <Bar dataKey="count" fill="#09BC8A" radius={[4, 4, 0, 0]} activeBar={{ stroke: "#333", strokeWidth: 1 }} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
