import { useState, useEffect } from "react";
import { Bell, RefreshCw, Shield, ShieldOff } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { checkMultipleEmails, isDuplicateBreach } from "../../engine/enrichment/hibpService";

export default function MonitoringPanel({ subjectId, profile }) {
  const [config, setConfig] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [progress, setProgress] = useState(null);

  useEffect(() => {
    if (!subjectId) return;
    setLoading(true);
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
      const { data } = await supabase
        .from("monitoring_configs")
        .update({ enabled: !config.enabled })
        .eq("id", config.id)
        .select()
        .single();
      if (data) setConfig(data);
    } else {
      const { data } = await supabase
        .from("monitoring_configs")
        .insert({ subject_id: subjectId, check_type: "breach", enabled: true })
        .select()
        .single();
      if (data) setConfig(data);
    }
  }

  async function checkNow() {
    if (checking) return;

    const emails = (profile?.contact?.email_addresses || [])
      .map((e) => e.address)
      .filter(Boolean);

    if (emails.length === 0) return;

    setChecking(true);
    setProgress({ current: 0, total: emails.length, email: emails[0] });

    try {
      const results = await checkMultipleEmails(emails, (current, total, email) => {
        setProgress({ current, total, email });
      });

      const existingBreaches = profile?.breaches?.records || [];
      let newAlertCount = 0;

      for (const [email, result] of Object.entries(results)) {
        if (!result.found || result.error) continue;
        for (const breach of result.breaches) {
          if (!isDuplicateBreach(existingBreaches, breach)) {
            await supabase.from("monitoring_alerts").insert({
              subject_id: subjectId,
              alert_type: "new_breach",
              title: `New breach: ${breach.breach_name}`,
              detail: `${email} found in ${breach.breach_name}. ${breach.data_types?.join(", ") || ""}`,
              data: breach,
            });
            newAlertCount++;
          }
        }
      }

      // Update last_checked_at
      if (config) {
        const { data } = await supabase
          .from("monitoring_configs")
          .update({ last_checked_at: new Date().toISOString() })
          .eq("id", config.id)
          .select()
          .single();
        if (data) setConfig(data);
      }

      // Refresh alerts list
      const { data: freshAlerts } = await supabase
        .from("monitoring_alerts")
        .select("*")
        .eq("subject_id", subjectId)
        .order("created_at", { ascending: false })
        .limit(5);
      setAlerts(freshAlerts || []);

      setProgress(newAlertCount > 0 ? { done: true, found: newAlertCount } : { done: true, found: 0 });
      setTimeout(() => setProgress(null), 4000);
    } catch (err) {
      setProgress({ error: err.message || "Check failed" });
      setTimeout(() => setProgress(null), 4000);
    } finally {
      setChecking(false);
    }
  }

  if (loading) return null;

  return (
    <div className="surface p-4 mb-6">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Bell size={14} color="#09BC8A" />
          <span className="text-[13px] text-white font-medium">Continuous Monitoring</span>
        </div>
        <div className="flex items-center gap-2">
          {config?.enabled && (
            <button
              onClick={checkNow}
              disabled={checking}
              className="flex items-center gap-1.5 text-[11px] font-mono px-3 py-1 rounded cursor-pointer transition-all"
              style={{
                background: "transparent",
                border: "1px solid #2a2a2a",
                color: checking ? "#555" : "#09BC8A",
              }}
            >
              {checking ? (
                <><span className="generating-spinner" style={{ width: 10, height: 10, borderWidth: 1.5 }} /> Checking...</>
              ) : (
                <><RefreshCw size={10} /> Check Now</>
              )}
            </button>
          )}
          <button
            onClick={toggleMonitoring}
            className="flex items-center gap-1.5 text-[11px] font-mono px-3 py-1 rounded cursor-pointer"
            style={{
              background: config?.enabled ? "rgba(9,188,138,0.1)" : "transparent",
              border: `1px solid ${config?.enabled ? "rgba(9,188,138,0.3)" : "#2a2a2a"}`,
              color: config?.enabled ? "#09BC8A" : "#555",
            }}
          >
            {config?.enabled ? <><Shield size={10} /> Enabled</> : <><ShieldOff size={10} /> Enable</>}
          </button>
        </div>
      </div>

      {/* Progress / Result feedback */}
      {progress && (
        <div className="mb-3 px-3 py-2 rounded text-[11px] font-mono" style={{ background: "#0d0d0d", border: "1px solid #1a1a1a" }}>
          {progress.error ? (
            <span style={{ color: "#ef4444" }}>{progress.error}</span>
          ) : progress.done ? (
            <span style={{ color: progress.found > 0 ? "#f59e0b" : "#09BC8A" }}>
              {progress.found > 0 ? `${progress.found} new breach alert${progress.found > 1 ? "s" : ""} created` : "No new breaches found"}
            </span>
          ) : (
            <span style={{ color: "#888" }}>
              Checking {progress.current + 1}/{progress.total}: {progress.email}
            </span>
          )}
        </div>
      )}

      {config?.enabled && (
        <>
          {config.last_checked_at && (
            <div className="text-[10px] font-mono mb-3" style={{ color: "#444" }}>
              Last checked: {new Date(config.last_checked_at).toLocaleString()}
            </div>
          )}

          {alerts.length > 0 && (
            <div className="space-y-1.5">
              <div className="text-[10px] font-mono tracking-wider" style={{ color: "#555" }}>RECENT ALERTS</div>
              {alerts.map((a) => (
                <div key={a.id} className="flex items-start gap-2 p-2 rounded" style={{ background: "#0d0d0d", border: "1px solid #1a1a1a" }}>
                  <span className="w-1.5 h-1.5 rounded-full shrink-0 mt-1.5" style={{ background: a.read ? "#333" : "#ef4444" }} />
                  <div>
                    <div className="text-[12px]" style={{ color: a.read ? "#555" : "#ccc" }}>{a.title}</div>
                    {a.detail && <div className="text-[10px] mt-0.5" style={{ color: "#555" }}>{a.detail}</div>}
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
