import { useRef, useEffect, useState, useCallback } from "react";

const ACCENT = "#09BC8A";

// Muted palette for edge highlighting by match type
const MATCH_ACCENT = {
  phone: ACCENT,
  email: ACCENT,
  organization: "#6b8f7b",
  breach: "#9b5555",
  data_broker: "#8a7a5a",
  associate: "#7b6b9b",
  direct_link: "#5b7b9b",
  location: "#5b7b8b",
  platform: "#666",
};

export default function ForceGraph({ nodes, links, selectedId, onSelect, width, height }) {
  const svgRef = useRef(null);
  const posRef = useRef([]);
  const linkRef = useRef([]);
  const [, forceRender] = useState(0);
  const [hoveredId, setHoveredId] = useState(null);
  const [dragging, setDragging] = useState(null);
  const [panning, setPanning] = useState(false);
  const panOrigin = useRef({ x: 0, y: 0, tx: 0, ty: 0 });
  const [transform, setTransform] = useState({ x: 0, y: 0, k: 1 });
  const [ready, setReady] = useState(false);

  // Pre-compute layout off-screen — no animation, no jello
  useEffect(() => {
    setReady(false);
    let cancelled = false;

    import("d3-force").then((d3) => {
      if (cancelled) return;

      const simNodes = nodes.map((n, i) => ({
        ...n,
        x: width / 2 + Math.cos(i * 2.399) * 180,
        y: height / 2 + Math.sin(i * 2.399) * 180,
      }));

      const simLinks = links.map((l) => ({ ...l }));

      const sim = d3.forceSimulation(simNodes)
        .force("link", d3.forceLink(simLinks).id((d) => d.id).distance(150).strength(0.7))
        .force("charge", d3.forceManyBody().strength(-500).distanceMax(500))
        .force("center", d3.forceCenter(width / 2, height / 2).strength(0.5))
        .force("collide", d3.forceCollide().radius((d) => (d.isCurrent ? 50 : 32)))
        .stop();

      // Run 300 ticks to full convergence — never renders intermediate states
      for (let i = 0; i < 300; i++) sim.tick();

      posRef.current = simNodes.map((n) => ({
        id: n.id,
        name: n.name,
        caseType: n.caseType,
        isCurrent: n.isCurrent,
        x: n.x,
        y: n.y,
      }));

      linkRef.current = simLinks.map((l) => ({
        sourceId: l.source.id ?? l.source,
        targetId: l.target.id ?? l.target,
        matchCount: l.matchCount,
        types: l.types,
        sx: l.source.x ?? 0,
        sy: l.source.y ?? 0,
        tx: l.target.x ?? 0,
        ty: l.target.y ?? 0,
      }));

      setReady(true);
      forceRender((n) => n + 1);
    });

    return () => {
      cancelled = true;
    };
  }, [nodes, links, width, height]);

  // Zoom toward cursor
  const handleWheel = useCallback((e) => {
    e.preventDefault();
    const rect = svgRef.current.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const factor = e.deltaY > 0 ? 0.92 : 1.08;
    setTransform((t) => {
      const newK = Math.max(0.2, Math.min(4, t.k * factor));
      return {
        x: mx - (mx - t.x) * (newK / t.k),
        y: my - (my - t.y) * (newK / t.k),
        k: newK,
      };
    });
  }, []);

  function handleBgMouseDown(e) {
    if (e.target === svgRef.current || e.target.tagName === "rect") {
      setPanning(true);
      panOrigin.current = { x: e.clientX, y: e.clientY, tx: transform.x, ty: transform.y };
      onSelect(null);
    }
  }

  function handleNodeMouseDown(e, nodeId) {
    e.stopPropagation();
    setDragging(nodeId);
    onSelect(nodeId);
  }

  function handleMouseMove(e) {
    if (panning) {
      const dx = e.clientX - panOrigin.current.x;
      const dy = e.clientY - panOrigin.current.y;
      setTransform((t) => ({ ...t, x: panOrigin.current.tx + dx, y: panOrigin.current.ty + dy }));
      return;
    }
    if (!dragging) return;
    const rect = svgRef.current.getBoundingClientRect();
    const newX = (e.clientX - rect.left - transform.x) / transform.k;
    const newY = (e.clientY - rect.top - transform.y) / transform.k;
    const node = posRef.current.find((n) => n.id === dragging);
    if (node) {
      node.x = newX;
      node.y = newY;
      linkRef.current.forEach((l) => {
        if (l.sourceId === dragging) { l.sx = newX; l.sy = newY; }
        if (l.targetId === dragging) { l.tx = newX; l.ty = newY; }
      });
      forceRender((n) => n + 1);
    }
  }

  function handleMouseUp() {
    setDragging(null);
    setPanning(false);
  }

  if (!ready) {
    return <svg width={width} height={height} style={{ background: "#0a0a0a", borderRadius: 8 }} />;
  }

  // Determine which nodes are connected to the active (selected or hovered) node
  const activeId = selectedId || hoveredId;
  const connectedToActive = new Set();
  if (activeId) {
    linkRef.current.forEach((l) => {
      if (l.sourceId === activeId) connectedToActive.add(l.targetId);
      if (l.targetId === activeId) connectedToActive.add(l.sourceId);
    });
  }

  return (
    <svg
      ref={svgRef}
      width={width}
      height={height}
      style={{
        background: "#0a0a0a",
        borderRadius: 8,
        cursor: panning || dragging ? "grabbing" : "default",
      }}
      onWheel={handleWheel}
      onMouseDown={handleBgMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      <defs>
        <filter id="node-glow">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Hit area for background pan */}
      <rect width={width} height={height} fill="transparent" />

      <g transform={`translate(${transform.x},${transform.y}) scale(${transform.k})`}>
        {/* Edges — muted by default, highlight on selection */}
        {linkRef.current.map((link, i) => {
          const isActive = activeId && (link.sourceId === activeId || link.targetId === activeId);
          const hasThreat = link.types?.some((t) => t === "breach" || t === "direct_link");

          let stroke = "#1e1e1e";
          let strokeWidth = 0.75;
          let opacity = 0.35;

          if (isActive) {
            const primaryType = link.types?.[0] || "organization";
            stroke = MATCH_ACCENT[primaryType] || "#555";
            strokeWidth = Math.min(1.2 + (link.matchCount || 1) * 0.3, 2.5);
            opacity = 0.6;
          } else if (hasThreat && !activeId) {
            stroke = "#3d2222";
            opacity = 0.45;
          }

          // Subtle curvature to break up the starburst
          const dx = link.tx - link.sx;
          const dy = link.ty - link.sy;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const curveDir = i % 2 === 0 ? 1 : -1;
          const curveAmount = Math.min(dist * 0.06, 15);
          const mx = (link.sx + link.tx) / 2 + (-dy / dist) * curveAmount * curveDir;
          const my = (link.sy + link.ty) / 2 + (dx / dist) * curveAmount * curveDir;

          return (
            <path
              key={i}
              d={`M${link.sx},${link.sy} Q${mx},${my} ${link.tx},${link.ty}`}
              fill="none"
              stroke={stroke}
              strokeWidth={strokeWidth}
              opacity={opacity}
            />
          );
        })}

        {/* Nodes */}
        {posRef.current.map((node) => {
          const isCurrent = node.isCurrent;
          const isSelected = selectedId === node.id;
          const isHovered = hoveredId === node.id;
          const isConnected = connectedToActive.has(node.id);
          const isActive = isSelected || node.id === activeId;

          const r = isCurrent ? 22 : 13;

          // Default: recede into background
          let strokeColor = "#2a2a2a";
          let fillColor = "#ffffff04";
          let strokeW = 0.75;
          let showLabel = isCurrent;
          let labelColor = "#555";

          if (isCurrent) {
            strokeColor = ACCENT;
            fillColor = `${ACCENT}0a`;
            strokeW = 1.5;
            labelColor = "#888";
          }

          if (isConnected && !isActive) {
            strokeColor = "#4a4a4a";
            fillColor = "#ffffff08";
            showLabel = true;
            labelColor = "#666";
          }

          if (isHovered && !isActive) {
            strokeColor = "#666";
            showLabel = true;
            labelColor = "#999";
          }

          if (isActive) {
            strokeColor = ACCENT;
            fillColor = `${ACCENT}12`;
            strokeW = 1.5;
            showLabel = true;
            labelColor = "#ccc";
          }

          return (
            <g
              key={node.id}
              onMouseDown={(e) => handleNodeMouseDown(e, node.id)}
              onMouseEnter={() => setHoveredId(node.id)}
              onMouseLeave={() => setHoveredId(null)}
              style={{ cursor: "pointer" }}
            >
              {/* Outer ring — investigation subject gets a distinctive double ring */}
              {isCurrent && (
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={r + 6}
                  fill="none"
                  stroke={ACCENT}
                  strokeWidth={0.5}
                  opacity={isActive ? 0.5 : 0.25}
                />
              )}

              {/* Selection ring for non-current nodes */}
              {isSelected && !isCurrent && (
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={r + 5}
                  fill="none"
                  stroke={ACCENT}
                  strokeWidth={0.5}
                  opacity={0.4}
                />
              )}

              {/* Main node circle */}
              <circle
                cx={node.x}
                cy={node.y}
                r={r}
                fill={fillColor}
                stroke={strokeColor}
                strokeWidth={strokeW}
              />

              {/* Center dot for investigation subject */}
              {isCurrent && (
                <circle cx={node.x} cy={node.y} r={4} fill={ACCENT} opacity={0.5} />
              )}

              {/* Case type indicator — small inner mark for non-current nodes */}
              {!isCurrent && (
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={2.5}
                  fill={strokeColor}
                  opacity={0.4}
                />
              )}

              {/* Label — only shown contextually */}
              {showLabel && (
                <text
                  x={node.x}
                  y={node.y + r + 14}
                  textAnchor="middle"
                  fill={labelColor}
                  fontSize={isCurrent ? 11 : 10}
                  fontFamily="'Inter', system-ui, sans-serif"
                  fontWeight={isActive || isCurrent ? 500 : 400}
                  style={{ pointerEvents: "none" }}
                >
                  {node.name}
                </text>
              )}
            </g>
          );
        })}
      </g>
    </svg>
  );
}
