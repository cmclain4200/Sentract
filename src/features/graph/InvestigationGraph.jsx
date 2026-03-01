import { useState, useEffect, useRef } from "react";
import { useOutletContext } from "react-router-dom";
import { Network } from "lucide-react";
import { fetchAllUserSubjects, detectOverlaps } from "../../lib/crosswire";
import { buildGraphData } from "./graphUtils";
import ForceGraph from "./ForceGraph";

const TYPE_LABELS = {
  phone: "Phone",
  email: "Email",
  direct_link: "Direct Link",
  organization: "Organization",
  breach: "Breach Exposure",
  data_broker: "Data Broker",
  associate: "Network Associate",
  location: "Location",
  platform: "Platform",
};

const TYPE_ORDER = [
  "phone",
  "email",
  "direct_link",
  "organization",
  "breach",
  "data_broker",
  "associate",
  "location",
  "platform",
];

const TYPE_COLORS = {
  phone: "#09BC8A",
  email: "#09BC8A",
  direct_link: "#5b7b9b",
  organization: "#6b8f7b",
  breach: "#9b5555",
  data_broker: "#8a7a5a",
  associate: "#7b6b9b",
  location: "#5b7b8b",
  platform: "#666",
};

export default function InvestigationGraph() {
  const { subject, caseData } = useOutletContext();
  const [allSubjects, setAllSubjects] = useState([]);
  const [overlaps, setOverlaps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(null);
  const containerRef = useRef(null);
  const [dims, setDims] = useState({ width: 800, height: 500 });

  useEffect(() => {
    if (!subject?.id) return;
    setLoading(true);
    fetchAllUserSubjects().then((subs) => {
      setAllSubjects(subs);
      const ov = detectOverlaps(subject, subs);
      setOverlaps(ov);
      setLoading(false);
    });
  }, [subject?.id]);

  useEffect(() => {
    if (!containerRef.current) return;
    const obs = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setDims({ width: Math.max(width, 400), height: Math.max(height, 300) });
    });
    obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);

  const { nodes, links } = buildGraphData(subject, allSubjects, overlaps);
  const selectedNode = nodes.find((n) => n.id === selectedId);
  const selectedOverlap = overlaps.find((o) => o.subject.id === selectedId);

  // Group matches by type for the detail panel
  const groupedMatches = {};
  if (selectedOverlap) {
    selectedOverlap.matches.forEach((m) => {
      if (!groupedMatches[m.type]) groupedMatches[m.type] = [];
      groupedMatches[m.type].push(m);
    });
  }
  const sortedTypes = TYPE_ORDER.filter((t) => groupedMatches[t]);

  if (!subject) {
    return (
      <div className="p-8 fade-in">
        <h1 className="page-title">Link Graph</h1>
        <div className="surface p-6 text-center">
          <p className="text-sm" style={{ color: "#666" }}>
            No subject selected.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 fade-in h-full flex flex-col">
      <h1 className="page-title mb-6">Link Graph</h1>

      {loading ? (
        <div className="flex items-center gap-2 justify-center py-20">
          <span className="pulse-dot" />
          <span className="pulse-dot" />
          <span className="pulse-dot" />
        </div>
      ) : overlaps.length === 0 ? (
        <div className="surface p-8 text-center">
          <Network size={32} color="#333" className="mx-auto mb-3" />
          <div className="text-[15px] text-white font-semibold mb-2">No cross-case connections</div>
          <div className="text-[13px]" style={{ color: "#555" }}>
            Connections will appear when subjects share organizations, breaches, locations, or other
            data points.
          </div>
        </div>
      ) : (
        <div className="flex-1 flex gap-4 min-h-0">
          <div ref={containerRef} className="flex-1 surface overflow-hidden" style={{ minHeight: 400 }}>
            <ForceGraph
              nodes={nodes}
              links={links}
              selectedId={selectedId}
              onSelect={setSelectedId}
              width={dims.width}
              height={dims.height}
            />
          </div>

          {selectedNode && selectedOverlap && (
            <div
              className="w-[280px] shrink-0 surface overflow-y-auto fade-in"
              style={{ maxHeight: dims.height }}
            >
              {/* Node header */}
              <div className="p-4 pb-3" style={{ borderBottom: "1px solid #141414" }}>
                <div
                  className="text-[10px] font-mono tracking-wider mb-1.5"
                  style={{ color: "#555" }}
                >
                  SELECTED NODE
                </div>
                <div className="text-[15px] text-white font-semibold">{selectedNode.name}</div>
                <div className="text-[11px] font-mono mt-0.5" style={{ color: "#444" }}>
                  {selectedNode.caseType}
                </div>
              </div>

              {/* Connection summary */}
              <div className="px-4 py-3" style={{ borderBottom: "1px solid #141414" }}>
                <div className="flex items-baseline gap-2">
                  <span className="text-[20px] font-semibold" style={{ color: "#09BC8A" }}>
                    {selectedOverlap.matches.length}
                  </span>
                  <span className="text-[11px] font-mono tracking-wider" style={{ color: "#555" }}>
                    CONNECTION{selectedOverlap.matches.length !== 1 ? "S" : ""}
                  </span>
                </div>
                {/* Type breakdown chips */}
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {sortedTypes.map((type) => (
                    <span
                      key={type}
                      className="text-[10px] font-mono px-1.5 py-0.5 rounded"
                      style={{
                        color: TYPE_COLORS[type] || "#666",
                        background: `${TYPE_COLORS[type] || "#666"}12`,
                        border: `1px solid ${TYPE_COLORS[type] || "#666"}20`,
                      }}
                    >
                      {groupedMatches[type].length} {TYPE_LABELS[type] || type}
                    </span>
                  ))}
                </div>
              </div>

              {/* Grouped connections */}
              <div className="p-4 space-y-4">
                {sortedTypes.map((type) => (
                  <div key={type}>
                    <div
                      className="text-[10px] font-mono tracking-wider mb-1.5 flex items-center gap-2"
                      style={{ color: TYPE_COLORS[type] || "#666" }}
                    >
                      <span
                        className="inline-block w-1.5 h-1.5 rounded-full"
                        style={{ background: TYPE_COLORS[type] || "#666" }}
                      />
                      {(TYPE_LABELS[type] || type).toUpperCase()}
                    </div>
                    <div className="space-y-1">
                      {groupedMatches[type].map((m, i) => (
                        <div
                          key={i}
                          className="py-1.5 px-2 rounded"
                          style={{ background: "#0d0d0d" }}
                        >
                          <div className="text-[12px] text-white">{m.label}</div>
                          {m.detail && (
                            <div className="text-[10px] mt-0.5" style={{ color: "#444" }}>
                              {m.detail}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
