import { useState, useEffect, useRef } from "react";
import { useOutletContext } from "react-router-dom";
import { Network } from "lucide-react";
import SectionHeader from "../../components/common/SectionHeader";
import { fetchAllUserSubjects, detectOverlaps } from "../../lib/crosswire";
import { buildGraphData } from "./graphUtils";
import ForceGraph from "./ForceGraph";

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

  if (!subject) {
    return (
      <div className="p-8 fade-in">
        <SectionHeader label="Investigation Network" title="Link Graph" />
        <div className="surface p-6 text-center">
          <p className="text-sm" style={{ color: "#666" }}>No subject selected.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 fade-in h-full flex flex-col">
      <SectionHeader label="Investigation Network" title="Link Graph" />

      {loading ? (
        <div className="flex items-center gap-2 justify-center py-20">
          <span className="pulse-dot" /><span className="pulse-dot" /><span className="pulse-dot" />
        </div>
      ) : overlaps.length === 0 ? (
        <div className="surface p-8 text-center">
          <Network size={32} color="#333" className="mx-auto mb-3" />
          <div className="text-[15px] text-white font-semibold mb-2">No cross-case connections</div>
          <div className="text-[13px]" style={{ color: "#555" }}>
            Connections will appear when subjects share organizations, breaches, locations, or other data points.
          </div>
        </div>
      ) : (
        <div className="flex-1 flex gap-4 mt-4 min-h-0">
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
            <div className="w-[260px] shrink-0 surface p-4 overflow-y-auto fade-in" style={{ maxHeight: dims.height }}>
              <div className="text-[10px] font-mono tracking-wider mb-2" style={{ color: "#09BC8A" }}>SELECTED NODE</div>
              <div className="text-[15px] text-white font-semibold mb-1">{selectedNode.name}</div>
              <div className="text-[11px] font-mono mb-4" style={{ color: "#555" }}>
                {selectedNode.caseType}
              </div>

              <div className="text-[10px] font-mono tracking-wider mb-2" style={{ color: "#f59e0b" }}>
                {selectedOverlap.matches.length} CONNECTION{selectedOverlap.matches.length > 1 ? "S" : ""}
              </div>
              <div className="space-y-2">
                {selectedOverlap.matches.map((m, i) => (
                  <div key={i} className="p-2 rounded" style={{ background: "#0d0d0d", border: "1px solid #1a1a1a" }}>
                    <div className="text-[11px] font-mono" style={{ color: "#888" }}>{m.type}</div>
                    <div className="text-[12px] text-white">{m.label}</div>
                    {m.detail && <div className="text-[11px] mt-0.5" style={{ color: "#555" }}>{m.detail}</div>}
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
