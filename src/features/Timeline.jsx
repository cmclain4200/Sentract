import { useState, useEffect } from "react";
import { useOutletContext } from "react-router-dom";
import { Clock, FileText, Shield, Search, AlertTriangle, User, GitMerge, Upload, Bell, Eye } from "lucide-react";
import SectionHeader from "../components/common/SectionHeader";
import { fetchTimeline } from "../lib/timeline";

const EVENT_ICONS = {
  profile_updated: User,
  file_extracted: FileText,
  enrichment_run: Search,
  breach_detected: AlertTriangle,
  assessment_generated: Shield,
  observation_added: Eye,
  relationship_synced: GitMerge,
  import_completed: Upload,
  monitoring_alert: Bell,
};

const EVENT_COLORS = {
  profile_updated: "#09BC8A",
  file_extracted: "#3b82f6",
  enrichment_run: "#a855f7",
  breach_detected: "#ef4444",
  assessment_generated: "#f59e0b",
  observation_added: "#09BC8A",
  relationship_synced: "#3b82f6",
  import_completed: "#10b981",
  monitoring_alert: "#ef4444",
};

const CATEGORIES = ["All", "identity", "digital", "behavioral", "breaches", "network", "records", "enrichment"];

function groupByDate(events) {
  const groups = {};
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today - 86400000);
  const weekAgo = new Date(today - 7 * 86400000);

  for (const evt of events) {
    const d = new Date(evt.created_at);
    let label;
    if (d >= today) label = "Today";
    else if (d >= yesterday) label = "Yesterday";
    else if (d >= weekAgo) label = "This Week";
    else label = "Earlier";

    if (!groups[label]) groups[label] = [];
    groups[label].push(evt);
  }
  return groups;
}

export default function Timeline() {
  const { subject, caseData } = useOutletContext();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("All");

  useEffect(() => {
    if (!subject?.id) return;
    setLoading(true);
    fetchTimeline(subject.id, {
      limit: 100,
      category: filter === "All" ? undefined : filter,
    }).then((data) => {
      setEvents(data);
      setLoading(false);
    });
  }, [subject?.id, filter]);

  if (!subject) {
    return (
      <div className="p-8 fade-in">
        <SectionHeader label="Intelligence Timeline" title="Timeline" />
        <div className="surface p-6 text-center">
          <p className="text-sm" style={{ color: "#666" }}>No subject selected.</p>
        </div>
      </div>
    );
  }

  const grouped = groupByDate(events);

  return (
    <div className="p-8 fade-in">
      <div className="flex items-start justify-between mb-6">
        <SectionHeader label="Intelligence Timeline" title="Timeline" />
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="text-[12px] font-mono cursor-pointer outline-none"
          style={{ background: "#111", border: "1px solid #1e1e1e", color: "#888", padding: "6px 10px", borderRadius: 4 }}
        >
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>{c === "All" ? "All Categories" : c.charAt(0).toUpperCase() + c.slice(1)}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 justify-center py-20">
          <span className="pulse-dot" /><span className="pulse-dot" /><span className="pulse-dot" />
        </div>
      ) : events.length === 0 ? (
        <div className="surface p-8 text-center">
          <Clock size={32} color="#333" className="mx-auto mb-3" />
          <div className="text-[15px] text-white font-semibold mb-2">No timeline events yet</div>
          <div className="text-[13px]" style={{ color: "#555" }}>
            Events will appear here as you update the profile, run enrichments, and generate assessments.
          </div>
        </div>
      ) : (
        <div className="space-y-8">
          {Object.entries(grouped).map(([label, groupEvents]) => (
            <div key={label}>
              <div className="text-[11px] font-mono tracking-wider mb-3" style={{ color: "#555" }}>{label.toUpperCase()}</div>
              <div className="space-y-2">
                {groupEvents.map((evt) => {
                  const Icon = EVENT_ICONS[evt.event_type] || Clock;
                  const color = EVENT_COLORS[evt.event_type] || "#555";
                  return (
                    <div key={evt.id} className="flex items-start gap-3 p-3 rounded" style={{ background: "#111", border: "1px solid #1a1a1a" }}>
                      <div className="shrink-0 mt-0.5 flex items-center justify-center w-6 h-6 rounded" style={{ background: `${color}15` }}>
                        <Icon size={13} color={color} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[13px] text-white">{evt.title}</div>
                        {evt.detail && <div className="text-[12px] mt-0.5" style={{ color: "#888" }}>{evt.detail}</div>}
                        <div className="flex items-center gap-2 mt-1">
                          {evt.category && (
                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded" style={{ background: "#1a1a1a", color: "#666" }}>
                              {evt.category}
                            </span>
                          )}
                          <span className="text-[10px] font-mono" style={{ color: "#444" }}>
                            {new Date(evt.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
