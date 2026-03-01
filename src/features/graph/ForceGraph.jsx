import { useRef, useEffect, useState, useCallback } from "react";

const CASE_COLORS = {
  EP: "#09BC8A",
  CT: "#f59e0b",
  CI: "#3b82f6",
};

const MATCH_COLORS = {
  organization: "#09BC8A",
  breach: "#ef4444",
  data_broker: "#f59e0b",
  associate: "#a855f7",
  direct_link: "#3b82f6",
  location: "#3b82f6",
  platform: "#888",
};

export default function ForceGraph({ nodes, links, selectedId, onSelect, width, height }) {
  const svgRef = useRef(null);
  const simRef = useRef(null);
  const [positions, setPositions] = useState([]);
  const [dragging, setDragging] = useState(null);
  const [transform, setTransform] = useState({ x: 0, y: 0, k: 1 });

  useEffect(() => {
    let d3force;
    import("d3-force").then((mod) => {
      d3force = mod;

      const simNodes = nodes.map((n, i) => ({
        ...n,
        x: width / 2 + Math.cos(i * 2.4) * 150,
        y: height / 2 + Math.sin(i * 2.4) * 150,
      }));

      const simLinks = links.map((l) => ({
        ...l,
        source: simNodes.find((n) => n.id === l.source) || l.source,
        target: simNodes.find((n) => n.id === l.target) || l.target,
      }));

      const sim = d3force.forceSimulation(simNodes)
        .force("link", d3force.forceLink(simLinks).id((d) => d.id).distance(120))
        .force("charge", d3force.forceManyBody().strength(-300))
        .force("center", d3force.forceCenter(width / 2, height / 2))
        .force("collide", d3force.forceCollide(40))
        .on("tick", () => {
          setPositions([...simNodes]);
        });

      simRef.current = { sim, nodes: simNodes, links: simLinks };
    });

    return () => {
      if (simRef.current) simRef.current.sim.stop();
    };
  }, [nodes, links, width, height]);

  const handleWheel = useCallback((e) => {
    e.preventDefault();
    const scale = e.deltaY > 0 ? 0.95 : 1.05;
    setTransform((t) => ({
      ...t,
      k: Math.max(0.3, Math.min(3, t.k * scale)),
    }));
  }, []);

  function handleMouseDown(e, nodeId) {
    e.stopPropagation();
    setDragging(nodeId);
    onSelect(nodeId);
  }

  function handleMouseMove(e) {
    if (!dragging || !simRef.current) return;
    const node = simRef.current.nodes.find((n) => n.id === dragging);
    if (node) {
      node.fx = (e.nativeEvent.offsetX - transform.x) / transform.k;
      node.fy = (e.nativeEvent.offsetY - transform.y) / transform.k;
      simRef.current.sim.alpha(0.3).restart();
    }
  }

  function handleMouseUp() {
    if (dragging && simRef.current) {
      const node = simRef.current.nodes.find((n) => n.id === dragging);
      if (node) {
        node.fx = null;
        node.fy = null;
      }
    }
    setDragging(null);
  }

  const simLinks = simRef.current?.links || [];

  return (
    <svg
      ref={svgRef}
      width={width}
      height={height}
      style={{ background: "#0a0a0a", borderRadius: 8, cursor: dragging ? "grabbing" : "default" }}
      onWheel={handleWheel}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      <g transform={`translate(${transform.x}, ${transform.y}) scale(${transform.k})`}>
        {/* Links */}
        {simLinks.map((link, i) => {
          const s = positions.find((n) => n.id === (link.source?.id || link.source));
          const t = positions.find((n) => n.id === (link.target?.id || link.target));
          if (!s || !t) return null;
          const color = MATCH_COLORS[link.types?.[0]] || "#333";
          return (
            <line
              key={i}
              x1={s.x}
              y1={s.y}
              x2={t.x}
              y2={t.y}
              stroke={color}
              strokeWidth={Math.min(link.matchCount || 1, 4)}
              strokeOpacity={0.4}
            />
          );
        })}

        {/* Nodes */}
        {positions.map((node) => {
          const radius = node.isCurrent ? 20 : 14;
          const color = CASE_COLORS[node.caseType] || "#888";
          const isSelected = selectedId === node.id;
          return (
            <g key={node.id} onMouseDown={(e) => handleMouseDown(e, node.id)} style={{ cursor: "grab" }}>
              {isSelected && (
                <circle cx={node.x} cy={node.y} r={radius + 4} fill="none" stroke={color} strokeWidth={2} strokeOpacity={0.5} />
              )}
              <circle
                cx={node.x}
                cy={node.y}
                r={radius}
                fill={`${color}30`}
                stroke={color}
                strokeWidth={node.isCurrent ? 2 : 1}
              />
              <text
                x={node.x}
                y={node.y + radius + 14}
                textAnchor="middle"
                fill="#888"
                fontSize={11}
                fontFamily="monospace"
              >
                {node.name}
              </text>
            </g>
          );
        })}
      </g>
    </svg>
  );
}
