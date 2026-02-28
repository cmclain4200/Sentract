import { useState, useEffect, useRef } from "react";
import { ChevronLeft, ChevronRight, Play, Pause, Info } from "lucide-react";

const LEGEND_ITEMS = [
  { color: "#09BC8A", shape: "dot", label: "Target Location" },
  { color: "#f59e0b", shape: "dot", label: "Surveillance Point" },
  { color: "#ef4444", shape: "dot", label: "Threat Point" },
  { color: "#6366f1", shape: "dot", label: "Associate Location" },
  { color: "#09BC8A", shape: "line", label: "Target Route" },
  { color: "#ef4444", shape: "line", label: "Adversary Route" },
  { color: "#f59e0b", shape: "dash", label: "Surveillance Route" },
  { color: "#ef4444", shape: "zone", label: "High Risk Zone" },
  { color: "#6366f1", shape: "zone", label: "Surveillance Zone" },
];

const PHASE_HOLD_MS = 7000;

function getPhaseColor(phase) {
  const name = (phase?.name || phase?.title || "").toLowerCase();
  if (name.includes("recon") || name.includes("surveillance") || name.includes("gather")) return "#09BC8A";
  if (name.includes("approach") || name.includes("position") || name.includes("access")) return "#f59e0b";
  if (name.includes("exploit") || name.includes("compromise") || name.includes("extract")) return "#ef4444";
  return "#09BC8A";
}

export default function PhaseControls({ phases, activePhase, onPhaseChange }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [showLegend, setShowLegend] = useState(false);
  const [progress, setProgress] = useState(0);
  const timerRef = useRef(null);
  const progressRef = useRef(null);
  const legendRef = useRef(null);
  const total = phases?.length || 0;
  const phase = phases?.[activePhase];

  useEffect(() => {
    if (!isPlaying || total === 0) return;

    setProgress(0);
    const startTime = Date.now();

    progressRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      setProgress(Math.min(elapsed / PHASE_HOLD_MS, 1));
    }, 50);

    timerRef.current = setTimeout(() => {
      if (activePhase < total - 1) {
        onPhaseChange(activePhase + 1);
      } else {
        setIsPlaying(false);
        setProgress(0);
      }
    }, PHASE_HOLD_MS);

    return () => {
      clearTimeout(timerRef.current);
      clearInterval(progressRef.current);
    };
  }, [isPlaying, activePhase, total, onPhaseChange]);

  useEffect(() => {
    if (!showLegend) return;
    const handler = (e) => {
      if (legendRef.current && !legendRef.current.contains(e.target)) setShowLegend(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showLegend]);

  if (!phases || total === 0) return null;

  return (
    <div className="shrink-0" style={{ background: "#0d0d0d" }}>
      {/* Timeline bar */}
      <div className="recon-timeline">
        {phases.map((p, i) => (
          <div
            key={i}
            className={`timeline-segment${i === activePhase ? " active" : ""}${i < activePhase ? " completed" : ""}`}
            onClick={() => { setIsPlaying(false); onPhaseChange(i); }}
            style={{ borderLeftColor: i === activePhase ? getPhaseColor(p) : undefined }}
          >
            <div className="timeline-phase-num">Phase {i + 1}</div>
            <div className="timeline-phase-name">{p.title || p.name || `Phase ${i + 1}`}</div>
          </div>
        ))}
        {isPlaying && (
          <div
            className="timeline-progress"
            style={{ width: `${((activePhase + progress) / total) * 100}%` }}
          />
        )}
      </div>

      {/* Controls row */}
      <div
        className="relative flex items-center gap-3 px-5"
        style={{ height: 48, borderTop: "1px solid #1a1a1a" }}
      >
        {/* Prev */}
        <button
          onClick={() => { setIsPlaying(false); onPhaseChange(Math.max(0, activePhase - 1)); }}
          disabled={activePhase === 0}
          className="flex items-center gap-1 text-[12px] font-medium rounded transition-colors duration-150 cursor-pointer"
          style={{ color: activePhase === 0 ? "#333" : "#888", background: "transparent", border: "none", padding: "6px 10px", minHeight: 36 }}
        >
          <ChevronLeft size={14} />PREV
        </button>

        {/* Phase dots */}
        <div className="flex items-center gap-2.5">
          {phases.map((_, i) => (
            <button
              key={i}
              onClick={() => { setIsPlaying(false); onPhaseChange(i); }}
              className="transition-all duration-200 cursor-pointer"
              style={{
                width: i === activePhase ? 12 : 10,
                height: i === activePhase ? 12 : 10,
                borderRadius: "50%",
                background: i === activePhase ? "#09BC8A" : i < activePhase ? "#09BC8A55" : "#333",
                border: i === activePhase ? "2px solid #09BC8A" : "none",
                padding: 0,
              }}
            />
          ))}
        </div>

        {/* Phase label */}
        <span className="text-[14px] text-white flex-1 ml-2">
          <span className="font-mono text-[12px]" style={{ color: "#666" }}>
            Phase {activePhase + 1} of {total}:
          </span>{" "}
          <span className="font-medium">{phase?.title}</span>
        </span>

        {/* Next */}
        <button
          onClick={() => { setIsPlaying(false); onPhaseChange(Math.min(total - 1, activePhase + 1)); }}
          disabled={activePhase === total - 1}
          className="flex items-center gap-1 text-[12px] font-medium rounded transition-colors duration-150 cursor-pointer"
          style={{ color: activePhase === total - 1 ? "#333" : "#888", background: "transparent", border: "none", padding: "6px 10px", minHeight: 36 }}
        >
          NEXT<ChevronRight size={14} />
        </button>

        {/* Auto-play */}
        <button
          onClick={() => setIsPlaying(!isPlaying)}
          className="flex items-center gap-2 text-[12px] font-medium rounded transition-all duration-150 cursor-pointer"
          style={{
            color: isPlaying ? "#000" : "#888",
            background: isPlaying ? "#09BC8A" : "transparent",
            border: isPlaying ? "1px solid #09BC8A" : "1px solid #2a2a2a",
            padding: "6px 14px",
            minHeight: 36,
          }}
        >
          {isPlaying ? <Pause size={13} /> : <Play size={13} />}
          {isPlaying ? "PAUSE" : "PLAY"}
        </button>

        {/* Legend toggle */}
        <div className="relative" ref={legendRef}>
          <button
            onClick={() => setShowLegend(!showLegend)}
            className="flex items-center gap-2 text-[12px] font-medium rounded transition-colors duration-150 cursor-pointer"
            style={{ color: showLegend ? "#09BC8A" : "#666", background: "transparent", border: "1px solid #2a2a2a", padding: "6px 14px", minHeight: 36 }}
          >
            <Info size={13} />LEGEND
          </button>

          {showLegend && (
            <div
              className="absolute bottom-full right-0 mb-2 rounded-md fade-in"
              style={{ background: "#111", border: "1px solid #2a2a2a", width: 240, zIndex: 50, padding: "16px 20px" }}
            >
              <div className="section-label text-[11px] mb-3">MAP LEGEND</div>
              <div className="space-y-2.5">
                {LEGEND_ITEMS.map((item) => (
                  <div key={item.label} className="flex items-center gap-2.5">
                    {item.shape === "dot" && <div className="w-3 h-3 rounded-full shrink-0" style={{ background: item.color }} />}
                    {item.shape === "line" && <div className="w-4 h-[2px] shrink-0 rounded-full" style={{ background: item.color }} />}
                    {item.shape === "dash" && (
                      <div className="flex gap-0.5 shrink-0">
                        <div className="w-1.5 h-[2px]" style={{ background: item.color }} />
                        <div className="w-1.5 h-[2px]" style={{ background: item.color }} />
                      </div>
                    )}
                    {item.shape === "zone" && (
                      <div className="w-3 h-3 rounded-sm shrink-0" style={{ background: `${item.color}20`, border: `1px solid ${item.color}60` }} />
                    )}
                    <span className="text-[12px]" style={{ color: "#999" }}>{item.label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
