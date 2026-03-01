import { useState, useEffect, useMemo, useRef } from "react";
import { useOutletContext } from "react-router-dom";
import { AlertTriangle, GitMerge, User, Database, Shield, Building2, MapPin, Globe, Users, Loader, Phone, Mail } from "lucide-react";
import ModuleWrapper from "../components/ModuleWrapper";
import { calculateCompleteness } from "../lib/profileCompleteness";
import { fetchAllUserSubjects, detectOverlaps } from "../lib/crosswire";
import { useNotifications } from "../contexts/NotificationContext";

const TYPE_ICONS = {
  phone: Phone,
  email: Mail,
  organization: Building2,
  breach: AlertTriangle,
  data_broker: Database,
  associate: Users,
  direct_link: Users,
  location: MapPin,
  platform: Globe,
};

const TYPE_COLORS = {
  phone: "#ef4444",
  email: "#ef4444",
  organization: "#09BC8A",
  breach: "#ef4444",
  data_broker: "#f59e0b",
  associate: "#a855f7",
  direct_link: "#3b82f6",
  location: "#3b82f6",
  platform: "#888",
};

const TYPE_LABELS = {
  phone: "Phone",
  email: "Email",
  organization: "Organization",
  breach: "Breach",
  data_broker: "Data Broker",
  associate: "Associate",
  direct_link: "Direct Link",
  location: "Location",
  platform: "Platform",
};

export default function CrossWire() {
  const { subject, caseData } = useOutletContext();
  const { notify } = useNotifications();
  const notifiedRef = useRef(false);
  const profileData = subject?.profile_data || {};
  const completeness = calculateCompleteness(profileData);

  const [allSubjects, setAllSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Reset notification flag when subject changes
  useEffect(() => { notifiedRef.current = false; }, [subject?.id]);

  useEffect(() => {
    if (!subject?.id) return;
    setLoading(true);
    fetchAllUserSubjects()
      .then((data) => {
        setAllSubjects(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [subject?.id]);

  const overlaps = useMemo(() => {
    if (!subject || allSubjects.length === 0) return [];
    return detectOverlaps(subject, allSubjects);
  }, [subject, allSubjects]);

  // Fire notification for high-priority overlaps
  useEffect(() => {
    if (notifiedRef.current || overlaps.length === 0) return;
    const HIGH_SIGNAL_TYPES = new Set(["phone", "email", "direct_link"]);
    const highPriority = overlaps.filter(
      (o) => o.matchCount >= 3 || o.matches.some((m) => HIGH_SIGNAL_TYPES.has(m.type))
    );
    if (highPriority.length > 0) {
      notifiedRef.current = true;
      notify({
        type: "crosswire",
        title: "CrossWire Alert",
        message: `${highPriority.length} high-priority overlap${highPriority.length !== 1 ? "s" : ""} detected`,
        link: `/case/${caseData?.id}/crosswire`,
      });
    }
  }, [overlaps, caseData?.id, notify]);

  const totalMatches = overlaps.reduce((sum, o) => sum + o.matchCount, 0);

  return (
    <ModuleWrapper label="Cross-Case Intelligence" title="CrossWire" profileData={profileData} minCompleteness={10} completeness={completeness.score}>
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="surface p-8 text-center">
            <Loader size={24} className="mx-auto mb-3 animate-spin" style={{ color: "#555" }} />
            <p className="text-[14px]" style={{ color: "#888" }}>Scanning subjects across all cases...</p>
          </div>
        ) : error ? (
          <div className="surface p-5" style={{ borderLeft: "3px solid #ef4444" }}>
            <div className="text-[14px] font-semibold mb-1" style={{ color: "#ef4444" }}>Scan Failed</div>
            <div className="text-[13px]" style={{ color: "#999" }}>{error}</div>
          </div>
        ) : overlaps.length === 0 ? (
          <div className="surface p-8 text-center">
            <Shield size={32} className="mx-auto mb-3" style={{ color: "#333" }} />
            <p className="text-[14px] mb-2" style={{ color: "#888" }}>No cross-case overlaps detected</p>
            <p className="text-[12px]" style={{ color: "#555" }}>
              {allSubjects.length <= 1
                ? "CrossWire requires at least 2 subjects across your cases to detect overlaps. Create more cases and subjects to unlock this analysis."
                : `Scanned ${allSubjects.length} subjects across your cases. No shared entities, breaches, brokers, locations, or associates found.`}
            </p>
          </div>
        ) : (
          <>
            {/* Alert Banner */}
            <div className="surface flex items-center gap-3 p-4 mb-6" style={{ borderLeft: "3px solid #f59e0b" }}>
              <AlertTriangle size={18} color="#f59e0b" />
              <span className="text-[15px] text-white">
                <span className="font-semibold" style={{ color: "#f59e0b" }}>
                  {totalMatches} entity overlap{totalMatches !== 1 ? "s" : ""} detected
                </span>{" "}
                across {overlaps.length} subject{overlaps.length !== 1 ? "s" : ""}
              </span>
            </div>

            {/* Overlap Cards */}
            <div className="space-y-6">
              {overlaps.map((overlap) => (
                <OverlapCard key={overlap.subject.id} overlap={overlap} currentSubject={subject} caseData={caseData} />
              ))}
            </div>

            {/* Summary */}
            <div className="surface p-6 mt-6" style={{ borderTop: "2px solid #09BC8A" }}>
              <div className="section-label text-[10px] mb-3">Overlap Summary</div>
              <div className="flex flex-wrap gap-3">
                {Object.entries(
                  overlaps
                    .flatMap((o) => o.matches)
                    .reduce((acc, m) => {
                      acc[m.type] = (acc[m.type] || 0) + 1;
                      return acc;
                    }, {})
                ).map(([type, count]) => {
                  const Icon = TYPE_ICONS[type] || Shield;
                  const color = TYPE_COLORS[type] || "#888";
                  return (
                    <div key={type} className="flex items-center gap-2 px-3 py-2 rounded" style={{ background: "#0d0d0d", border: "1px solid #1a1a1a" }}>
                      <Icon size={13} color={color} />
                      <span className="text-[12px]" style={{ color }}>{TYPE_LABELS[type] || type}</span>
                      <span className="text-[12px] font-semibold" style={{ color: "#e0e0e0" }}>{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>
    </ModuleWrapper>
  );
}

function OverlapCard({ overlap, currentSubject, caseData }) {
  const [expanded, setExpanded] = useState(true);
  const currentScore = currentSubject?.profile_data ? Math.round(calculateCompleteness(currentSubject.profile_data).score) : 0;
  const otherScore = overlap.subject?.profile_data ? Math.round(calculateCompleteness(overlap.subject.profile_data).score) : 0;

  return (
    <div className="surface p-0 overflow-hidden">
      {/* Header: Subject Cards */}
      <div className="flex items-center gap-5 p-5" style={{ borderBottom: "1px solid #1a1a1a" }}>
        <SubjectCard
          name={currentSubject?.name || "Current Subject"}
          caseName={caseData?.name || "Current Case"}
          caseType={caseData?.type || ""}
          completeness={currentScore}
          current
        />
        <div className="flex items-center justify-center w-10 h-10 shrink-0 rounded-full" style={{ background: "#111", border: "1px solid #1e1e1e" }}>
          <GitMerge size={18} color="#09BC8A" />
        </div>
        <SubjectCard
          name={overlap.subject.name || "Unknown"}
          caseName={overlap.caseName}
          caseType={overlap.caseType}
          completeness={otherScore}
        />
      </div>

      {/* Match Count */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-5 py-3 cursor-pointer"
        style={{ background: "#0d0d0d", border: "none", borderBottom: expanded ? "1px solid #1a1a1a" : "none" }}
      >
        <span className="text-[13px] font-semibold" style={{ color: "#f59e0b" }}>
          {overlap.matchCount} shared entit{overlap.matchCount !== 1 ? "ies" : "y"}
        </span>
        <div className="flex-1" />
        <span className="text-[11px]" style={{ color: "#555" }}>{expanded ? "Collapse" : "Expand"}</span>
      </button>

      {/* Matches */}
      {expanded && (
        <div className="p-5 space-y-3 fade-in">
          {overlap.matches.map((match, i) => {
            const Icon = TYPE_ICONS[match.type] || Shield;
            const color = TYPE_COLORS[match.type] || "#888";
            return (
              <div key={i} className="flex items-start gap-3 p-4 rounded" style={{ background: "#0d0d0d", border: "1px solid #1a1a1a", borderLeft: `3px solid ${color}` }}>
                <Icon size={14} color={color} className="mt-0.5 shrink-0" />
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[14px] font-semibold text-white">{match.label}</span>
                    <span className="badge" style={{ color, background: `${color}12`, border: `1px solid ${color}25`, fontSize: 9 }}>
                      {(TYPE_LABELS[match.type] || match.type).toUpperCase()}
                    </span>
                  </div>
                  <div className="text-[13px]" style={{ color: "#888" }}>{match.detail}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SubjectCard({ name, caseName, caseType, completeness, current }) {
  const scoreColor = completeness >= 60 ? "#09BC8A" : completeness >= 30 ? "#f59e0b" : "#555";
  return (
    <div className="flex-1 p-4 rounded" style={{ background: "#0d0d0d", border: current ? "1px solid rgba(9, 188, 138,0.2)" : "1px solid #1a1a1a" }}>
      <div className="flex items-center gap-2 mb-2">
        <span className="section-label text-[9px]">{caseName}</span>
        {caseType && (
          <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-sm tracking-wider"
            style={{ color: "#3b82f6", background: "rgba(59,130,246,0.08)", border: "1px solid rgba(59,130,246,0.2)" }}>
            {caseType}
          </span>
        )}
        {current && <span className="badge badge-accent" style={{ fontSize: 8, padding: "1px 5px" }}>CURRENT</span>}
      </div>
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ background: "#1a1a1a", border: "1px solid #2a2a2a" }}>
          <User size={14} color="#555" />
        </div>
        <div>
          <div className="text-[15px] font-semibold text-white">{name}</div>
          <div className="text-[12px]" style={{ color: scoreColor }}>
            {completeness}% complete
          </div>
        </div>
      </div>
    </div>
  );
}
