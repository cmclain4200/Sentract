import { useState, useEffect, useRef } from "react";
import { Bell, CheckCheck } from "lucide-react";
import { supabase } from "../lib/supabase";
import { useNavigate } from "react-router-dom";
import { fetchRbacNotifications, markNotificationRead, markAllNotificationsRead } from "../lib/notifications";

const NOTIF_COLORS = {
  assessment_submitted: "#f59e0b",
  assessment_approved: "#09BC8A",
  assessment_rejected: "#ef4444",
  assessment_published: "#3b82f6",
  invitation_accepted: "#09BC8A",
};

export default function AlertBell() {
  const [alerts, setAlerts] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    supabase
      .from("monitoring_alerts")
      .select("*, subjects(name, case_id)")
      .eq("read", false)
      .order("created_at", { ascending: false })
      .limit(10)
      .then(({ data }) => {
        if (data) setAlerts(data);
      });

    fetchRbacNotifications({ limit: 10 }).then(setNotifications);
  }, []);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  async function markAlertRead(id) {
    await supabase.from("monitoring_alerts").update({ read: true }).eq("id", id);
    setAlerts((prev) => prev.filter((a) => a.id !== id));
  }

  async function handleNotifClick(n) {
    await markNotificationRead(n.id);
    setNotifications((prev) => prev.filter((x) => x.id !== n.id));
    if (n.link) navigate(n.link);
    setOpen(false);
  }

  async function handleMarkAllRead() {
    await markAllNotificationsRead();
    setNotifications([]);
  }

  const unread = alerts.length + notifications.length;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="relative flex items-center justify-center rounded cursor-pointer"
        style={{ background: "transparent", border: "none", width: 36, height: 36 }}
      >
        <Bell size={16} color={unread > 0 ? "#f59e0b" : "#555"} />
        {unread > 0 && (
          <span
            className="absolute -top-0.5 -right-0.5 flex items-center justify-center text-[9px] font-bold rounded-full"
            style={{ width: 16, height: 16, background: "#ef4444", color: "#fff" }}
          >
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-1 w-[320px] rounded-md overflow-hidden z-50 fade-in"
          style={{ background: "#111", border: "1px solid #222", boxShadow: "0 8px 32px rgba(0,0,0,0.6)" }}
        >
          <div className="px-4 py-2.5 flex items-center justify-between" style={{ borderBottom: "1px solid #1e1e1e" }}>
            <span className="text-[12px] font-mono" style={{ color: "#555" }}>NOTIFICATIONS</span>
            {notifications.length > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="flex items-center gap-1 text-[10px] font-mono cursor-pointer"
                style={{ background: "transparent", border: "none", color: "#555" }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "#09BC8A")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "#555")}
              >
                <CheckCheck size={11} /> Mark all read
              </button>
            )}
          </div>

          {unread === 0 ? (
            <div className="px-4 py-6 text-center">
              <div className="text-[12px]" style={{ color: "#555" }}>No new notifications</div>
            </div>
          ) : (
            <div className="max-h-[360px] overflow-y-auto">
              {/* Workflow notifications */}
              {notifications.length > 0 && (
                <>
                  <div className="px-4 py-1.5" style={{ background: "#0d0d0d" }}>
                    <span className="text-[9px] font-mono tracking-wider" style={{ color: "#444" }}>WORKFLOW</span>
                  </div>
                  {notifications.map((n) => (
                    <button
                      key={n.id}
                      onClick={() => handleNotifClick(n)}
                      className="w-full flex items-start gap-3 px-4 py-3 text-left cursor-pointer transition-colors"
                      style={{ background: "transparent", border: "none", borderBottom: "1px solid #1a1a1a" }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "#1a1a1a")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                    >
                      <span className="w-2 h-2 rounded-full shrink-0 mt-1.5" style={{ background: NOTIF_COLORS[n.notification_type] || "#888" }} />
                      <div>
                        <div className="text-[12px] text-white">{n.title}</div>
                        {n.detail && (
                          <div className="text-[10px] font-mono" style={{ color: "#555" }}>{n.detail}</div>
                        )}
                        <div className="text-[10px] font-mono" style={{ color: "#444" }}>
                          {new Date(n.created_at).toLocaleDateString()}
                        </div>
                      </div>
                    </button>
                  ))}
                </>
              )}

              {/* Monitoring alerts */}
              {alerts.length > 0 && (
                <>
                  <div className="px-4 py-1.5" style={{ background: "#0d0d0d" }}>
                    <span className="text-[9px] font-mono tracking-wider" style={{ color: "#444" }}>MONITORING</span>
                  </div>
                  {alerts.map((a) => (
                    <button
                      key={a.id}
                      onClick={() => {
                        markAlertRead(a.id);
                        if (a.subjects?.case_id) navigate(`/case/${a.subjects.case_id}/profile`);
                        setOpen(false);
                      }}
                      className="w-full flex items-start gap-3 px-4 py-3 text-left cursor-pointer transition-colors"
                      style={{ background: "transparent", border: "none", borderBottom: "1px solid #1a1a1a" }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "#1a1a1a")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                    >
                      <span className="w-2 h-2 rounded-full shrink-0 mt-1.5" style={{ background: "#ef4444" }} />
                      <div>
                        <div className="text-[12px] text-white">{a.title}</div>
                        {a.subjects?.name && (
                          <div className="text-[10px] font-mono" style={{ color: "#555" }}>{a.subjects.name}</div>
                        )}
                        <div className="text-[10px] font-mono" style={{ color: "#444" }}>
                          {new Date(a.created_at).toLocaleDateString()}
                        </div>
                      </div>
                    </button>
                  ))}
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
