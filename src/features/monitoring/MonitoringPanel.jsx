import { useState, useEffect } from "react";
import { Bell, RefreshCw } from "lucide-react";
import { supabase } from "../../lib/supabase";

export default function MonitoringPanel({ subjectId }) {
  const [config, setConfig] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!subjectId) return;
    Promise.all([
      supabase.from("monitoring_configs").select("*").eq("subject_id", subjectId).maybeSingle(),
      supabase.from("monitoring_alerts").select("*").eq("subject_id", subjectId).order("created_at", { ascending: false }).limit(5),
    ]).then(([configRes, alertsRes]) => {
      setConfig(configRes.data);
      setAlerts(alertsRes.data || []);
      setLoading(false);
    });
  }, [subjectId]);

  async function toggleMonitoring() {
    if (config) {
      await supabase.from("monitoring_configs").update({ enabled: !config.enabled }).eq("id", config.id);
      setConfig((c) => ({ ...c, enabled: !c.enabled }));
    } else {
      const { data } = await supabase.from("monitoring_configs").insert({
        subject_id: subjectId,
        check_type: "breach",
        frequency_hours: 168,
        enabled: true,
      }).select().single();
      if (data) setConfig(data);
    }
  }

  async function updateFrequency(hours) {
    if (!config) return;
    await supabase.from("monitoring_configs").update({ frequency_hours: hours }).eq("id", config.id);
    setConfig((c) => ({ ...c, frequency_hours: hours }));
  }

  if (loading) return null;

  return (
    <div className="surface p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Bell size={14} color="#09BC8A" />
          <span className="text-[13px] text-white font-medium">Continuous Monitoring</span>
        </div>
        <button
          onClick={toggleMonitoring}
          className="text-[11px] font-mono px-3 py-1 rounded cursor-pointer"
          style={{
            background: config?.enabled ? "rgba(9,188,138,0.1)" : "transparent",
            border: `1px solid ${config?.enabled ? "rgba(9,188,138,0.3)" : "#2a2a2a"}`,
            color: config?.enabled ? "#09BC8A" : "#555",
          }}
        >
          {config?.enabled ? "Enabled" : "Enable"}
        </button>
      </div>

      {config?.enabled && (
        <>
          <div className="flex items-center gap-3 mb-3">
            <span className="text-[11px]" style={{ color: "#555" }}>Frequency:</span>
            <select
              value={config.frequency_hours || 168}
              onChange={(e) => updateFrequency(parseInt(e.target.value))}
              className="text-[11px] font-mono cursor-pointer outline-none"
              style={{ background: "#111", border: "1px solid #1e1e1e", color: "#888", padding: "4px 8px", borderRadius: 4 }}
            >
              <option value={24}>Daily</option>
              <option value={168}>Weekly</option>
              <option value={720}>Monthly</option>
            </select>
            {config.last_checked_at && (
              <span className="text-[10px] font-mono" style={{ color: "#444" }}>
                Last: {new Date(config.last_checked_at).toLocaleDateString()}
              </span>
            )}
          </div>

          {alerts.length > 0 && (
            <div className="space-y-1.5">
              <div className="text-[10px] font-mono tracking-wider" style={{ color: "#555" }}>RECENT ALERTS</div>
              {alerts.map((a) => (
                <div key={a.id} className="flex items-start gap-2 p-2 rounded" style={{ background: "#0d0d0d", border: "1px solid #1a1a1a" }}>
                  <span className="w-1.5 h-1.5 rounded-full shrink-0 mt-1.5" style={{ background: a.read ? "#333" : "#ef4444" }} />
                  <div>
                    <div className="text-[12px]" style={{ color: a.read ? "#555" : "#ccc" }}>{a.title}</div>
                    <div className="text-[10px] font-mono" style={{ color: "#444" }}>
                      {new Date(a.created_at).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
