import { useRef, useEffect, useState, useCallback } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { MapPin } from "lucide-react";
import { deduplicateKeyLocations } from "../lib/geocode";

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;

const MARKER_COLORS = {
  target_home: "#09BC8A",
  target_work: "#09BC8A",
  target_routine: "#09BC8A",
  surveillance_point: "#f59e0b",
  staging_area: "#ef4444",
  interception_point: "#ef4444",
  escape_route_start: "#888",
  associate_location: "#6366f1",
  public_venue: "#888",
};

const ROUTE_COLORS = {
  target_route: "#09BC8A",
  adversary_route: "#ef4444",
  surveillance_route: "#f59e0b",
  escape_route: "#666",
};

const ZONE_COLORS = {
  high_risk: "#ef4444",
  moderate_risk: "#f59e0b",
  surveillance_zone: "#6366f1",
};

const ARC_THRESHOLD = 0.8;

function getDistance(a, b) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  return Math.sqrt(dx * dx + dy * dy);
}

function createArcLine(start, end, numPoints = 50) {
  const dx = end[0] - start[0];
  const dy = end[1] - start[1];
  const midLng = (start[0] + end[0]) / 2;
  const midLat = (start[1] + end[1]) / 2;
  const controlPoint = [midLng - dy * 0.15, midLat + dx * 0.15];

  const points = [];
  for (let i = 0; i <= numPoints; i++) {
    const t = i / numPoints;
    const lng = (1 - t) * (1 - t) * start[0] + 2 * (1 - t) * t * controlPoint[0] + t * t * end[0];
    const lat = (1 - t) * (1 - t) * start[1] + 2 * (1 - t) * t * controlPoint[1] + t * t * end[1];
    points.push([lng, lat]);
  }
  return points;
}

function getRouteCoordinates(from, to) {
  return getDistance(from, to) > ARC_THRESHOLD ? createArcLine(from, to) : [from, to];
}

function createMarkerEl(location, isActive) {
  const color = MARKER_COLORS[location.type] || "#888";
  const el = document.createElement("div");
  el.style.cursor = "pointer";
  el.innerHTML = `
    <div class="vs-marker sentract-marker-entering ${isActive ? "vs-marker-active" : ""}" style="
      width: 32px; height: 32px;
      background: ${color}22; border: 2px solid ${color};
      border-radius: 50%; display: flex; align-items: center; justify-content: center;
      position: relative; transition: all 0.3s ease;
      ${isActive ? `box-shadow: 0 0 12px ${color}66;` : ""}
    ">
      <div style="width: 8px; height: 8px; background: ${color}; border-radius: 50%;"></div>
    </div>
    <div style="
      position: absolute; top: 36px; left: 50%; transform: translateX(-50%);
      white-space: nowrap; font-size: 11px; font-family: 'JetBrains Mono', monospace;
      color: ${color}; text-shadow: 0 1px 4px rgba(0,0,0,0.9);
      letter-spacing: 0.05em; ${isActive ? "" : "opacity: 0.45;"}
      transition: opacity 0.3s ease;
    ">${location.name}</div>
  `;
  return el;
}

export default function TacticalMap({ scenarioData, activePhase, onLocationClick }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);
  const popupsRef = useRef([]);
  const routeIdsRef = useRef([]);
  const zoneIdsRef = useRef([]);
  const timersRef = useRef([]);
  const animFramesRef = useRef([]);
  const [mapLoaded, setMapLoaded] = useState(false);
  const scenarioRef = useRef(scenarioData);
  scenarioRef.current = scenarioData;

  const cancelPending = useCallback(() => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
    animFramesRef.current.forEach(cancelAnimationFrame);
    animFramesRef.current = [];
  }, []);

  const safeTimeout = useCallback((fn, delay) => {
    const id = setTimeout(fn, delay);
    timersRef.current.push(id);
    return id;
  }, []);

  const animateRouteDraw = useCallback((map, sourceId, coordinates, duration = 1500) => {
    const totalPoints = coordinates.length;
    let startTime;

    function step(timestamp) {
      try {
        if (!map || !map.getSource(sourceId)) return;
      } catch {
        return;
      }

      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      const pointCount = Math.floor(progress * totalPoints);

      try {
        map.getSource(sourceId).setData({
          type: "Feature",
          geometry: {
            type: "LineString",
            coordinates: coordinates.slice(0, Math.max(pointCount, 2)),
          },
        });
      } catch {
        return;
      }

      if (progress < 1) {
        const id = requestAnimationFrame(step);
        animFramesRef.current.push(id);
      }
    }

    const id = requestAnimationFrame(step);
    animFramesRef.current.push(id);
  }, []);

  // Initialize map
  useEffect(() => {
    if (!MAPBOX_TOKEN || !containerRef.current) return;

    mapboxgl.accessToken = MAPBOX_TOKEN;
    const sd = scenarioRef.current;

    const m = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/dark-v11",
      center: sd?.map_center || [-122.42, 37.795],
      zoom: sd?.map_zoom || 12,
      pitch: 0,
      bearing: 0,
      attributionControl: false,
    });

    m.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");

    m.on("load", () => {
      try { m.resize(); } catch {}
      // Dark tactical style overrides — suppress visual noise
      try {
        m.setLayoutProperty('poi-label', 'visibility', 'none');
        m.setPaintProperty('road-street', 'line-color', '#1a1a1a');
        m.setPaintProperty('road-secondary-tertiary', 'line-color', '#1a1a1a');
        m.setPaintProperty('road-primary', 'line-color', '#222222');
        m.setPaintProperty('building', 'fill-color', '#0a0a0a');
        m.setPaintProperty('building', 'fill-opacity', 0.4);
        try { m.setLayoutProperty('water-label', 'visibility', 'none'); } catch {}
      } catch {}
      setMapLoaded(true);
    });

    mapRef.current = m;

    return () => {
      cancelPending();
      markersRef.current.forEach((mk) => mk.remove());
      markersRef.current = [];
      popupsRef.current.forEach((p) => p.remove());
      popupsRef.current = [];
      m.remove();
      mapRef.current = null;
      setMapLoaded(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handle resize
  useEffect(() => {
    const m = mapRef.current;
    const container = containerRef.current;
    if (!m || !container) return;

    const handleResize = () => { try { m.resize(); } catch {} };
    window.addEventListener("resize", handleResize);

    let observer;
    if (typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver(handleResize);
      observer.observe(container);
    }

    return () => {
      window.removeEventListener("resize", handleResize);
      if (observer) observer.disconnect();
    };
  }, [mapLoaded]);

  // Clear dynamic layers
  const clearDynamic = useCallback(() => {
    const m = mapRef.current;
    if (!m) return;
    try { if (!m.isStyleLoaded()) return; } catch { return; }

    popupsRef.current.forEach((p) => { try { p.remove(); } catch {} });
    popupsRef.current = [];

    routeIdsRef.current.forEach((id) => {
      try {
        if (m.getLayer(id)) m.removeLayer(id);
        if (m.getSource(id)) m.removeSource(id);
      } catch {}
    });
    routeIdsRef.current = [];

    zoneIdsRef.current.forEach((id) => {
      try {
        if (m.getLayer(id)) m.removeLayer(id);
        if (m.getLayer(id + "-stroke")) m.removeLayer(id + "-stroke");
        if (m.getSource(id)) m.removeSource(id);
      } catch {}
    });
    zoneIdsRef.current = [];
  }, []);

  // Rebuild markers when scenarioData changes
  useEffect(() => {
    if (!mapLoaded || !mapRef.current || !scenarioData) return;
    const m = mapRef.current;

    cancelPending();
    markersRef.current.forEach((mk) => { try { mk.remove(); } catch {} });
    markersRef.current = [];
    clearDynamic();

    try {
      m.flyTo({
        center: scenarioData.map_center,
        zoom: scenarioData.map_zoom,
        duration: 1500,
        essential: true,
      });
    } catch {}

    // Draw threat zones
    (scenarioData.threat_zones || []).forEach((zone, i) => {
      const id = `zone-${i}`;
      const color = ZONE_COLORS[zone.type] || "#888";

      const steps = 64;
      const km = zone.radius_meters / 1000;
      const coords = [];
      for (let j = 0; j <= steps; j++) {
        const angle = (j / steps) * 2 * Math.PI;
        const dx = km / (111.32 * Math.cos((zone.center[1] * Math.PI) / 180));
        const dy = km / 110.574;
        coords.push([
          zone.center[0] + dx * Math.cos(angle),
          zone.center[1] + dy * Math.sin(angle),
        ]);
      }

      try {
        m.addSource(id, {
          type: "geojson",
          data: { type: "Feature", geometry: { type: "Polygon", coordinates: [coords] } },
        });
        m.addLayer({ id, type: "fill", source: id, paint: { "fill-color": color, "fill-opacity": 0.1 } });
        m.addLayer({ id: id + "-stroke", type: "line", source: id, paint: { "line-color": color, "line-width": 1.5, "line-opacity": 0.4 } });
        zoneIdsRef.current.push(id);
      } catch {}
    });

    // Create markers with staggered entrance (deduplicate nearby coords)
    const dedupedLocations = deduplicateKeyLocations(scenarioData.key_locations);
    const phase = scenarioData.phases[0];
    const activeIds = new Set(phase?.active_locations || []);

    dedupedLocations.forEach((loc, idx) => {
      const isActive = activeIds.has(loc.id);
      const el = createMarkerEl(loc, isActive);
      el.style.opacity = "0";
      safeTimeout(() => { el.style.opacity = "1"; }, idx * 100);

      try {
        const marker = new mapboxgl.Marker({ element: el, anchor: "center" })
          .setLngLat(loc.coordinates)
          .addTo(m);
        marker._locationId = loc.id;
        marker._el = el;
        el.addEventListener("click", () => onLocationClick?.(loc));
        markersRef.current.push(marker);
      } catch {}
    });

    return () => cancelPending();
  }, [scenarioData, mapLoaded, clearDynamic, onLocationClick, cancelPending, safeTimeout]);

  // Update phase
  useEffect(() => {
    const m = mapRef.current;
    const sd = scenarioRef.current;
    if (!m || !mapLoaded || !sd) return;

    const phase = sd.phases[activePhase];
    if (!phase) return;

    cancelPending();

    popupsRef.current.forEach((p) => { try { p.remove(); } catch {} });
    popupsRef.current = [];
    routeIdsRef.current.forEach((id) => {
      try {
        if (m.getLayer(id)) m.removeLayer(id);
        if (m.getSource(id)) m.removeSource(id);
      } catch {}
    });
    routeIdsRef.current = [];

    // Fly to phase camera with cinematic bearing rotation
    const bearingPattern = [0, 35, -20, 50, -35, 15];
    const autoBearing = phase.map_state.bearing || bearingPattern[activePhase % bearingPattern.length];
    try {
      m.flyTo({
        center: phase.map_state.center,
        zoom: phase.map_state.zoom,
        pitch: phase.map_state.pitch || 45,
        bearing: autoBearing,
        duration: 2500,
        essential: true,
        easing: (t) => t * (2 - t),
      });
    } catch {}

    // Update marker active states
    const activeIds = new Set(phase.active_locations || []);
    const vulnLocId = phase.vulnerability_window?.location;
    markersRef.current.forEach((marker, idx) => {
      const isActive = activeIds.has(marker._locationId);
      const isVuln = marker._locationId === vulnLocId;
      const loc = sd.key_locations.find((l) => l.id === marker._locationId);
      if (!loc) return;
      const color = MARKER_COLORS[loc.type] || "#888";

      const delay = isActive ? idx * 80 : 0;
      safeTimeout(() => {
        try {
          const inner = marker._el.querySelector(".vs-marker");
          if (inner) {
            inner.style.opacity = isActive ? "1" : "0.25";
            inner.style.boxShadow = isActive ? `0 0 12px ${color}66` : "none";
            inner.classList.toggle("vulnerability-active", isVuln);
            if (isActive) {
              inner.classList.remove("sentract-marker-entering");
              void inner.offsetWidth;
              inner.classList.add("sentract-marker-entering");
            }
          }
          const label = marker._el.querySelector("div:last-child");
          if (label) label.style.opacity = isActive ? "1" : "0.3";
        } catch {}
      }, delay);
    });

    // Threat pulse rings for active locations
    const activeLocs = sd.key_locations.filter((l) => activeIds.has(l.id));
    activeLocs.forEach((loc, i) => {
      const pulseId = `pulse-${activePhase}-${i}`;
      const color = MARKER_COLORS[loc.type] || "#09BC8A";
      try {
        m.addSource(pulseId, {
          type: "geojson",
          data: { type: "Feature", geometry: { type: "Point", coordinates: loc.coordinates } },
        });
        m.addLayer({
          id: pulseId,
          type: "circle",
          source: pulseId,
          paint: {
            "circle-radius": 6,
            "circle-color": "transparent",
            "circle-stroke-width": 1.5,
            "circle-stroke-color": color,
            "circle-stroke-opacity": 0.6,
          },
        });
        routeIdsRef.current.push(pulseId);

        let radius = 6;
        let opacity = 0.6;
        let growing = true;

        function pulse() {
          try { if (!m.getLayer(pulseId)) return; } catch { return; }
          if (growing) {
            radius += 0.3;
            opacity -= 0.012;
            if (radius >= 24) growing = false;
          } else {
            radius = 6;
            opacity = 0.6;
            growing = true;
          }
          try {
            m.setPaintProperty(pulseId, "circle-radius", radius);
            m.setPaintProperty(pulseId, "circle-stroke-opacity", Math.max(0, opacity));
          } catch { return; }
          const frameId = requestAnimationFrame(pulse);
          animFramesRef.current.push(frameId);
        }
        const frameId = requestAnimationFrame(pulse);
        animFramesRef.current.push(frameId);
      } catch {}
    });

    // Build location map for routes (using deduped coordinates)
    const dedupedLocs = deduplicateKeyLocations(sd.key_locations);
    const locMap = {};
    dedupedLocs.forEach((l) => { locMap[l.id] = l.coordinates; });

    // Draw routes
    (phase.routes || []).forEach((route, i) => {
      const fromCoords = locMap[route.from];
      const toCoords = locMap[route.to];
      if (!fromCoords || !toCoords) return;
      const id = `route-${activePhase}-${i}`;
      const coordinates = getRouteCoordinates(fromCoords, toCoords);

      try {
        m.addSource(id, {
          type: "geojson",
          data: { type: "Feature", geometry: { type: "LineString", coordinates: coordinates.slice(0, 2) } },
        });

        const paint = {
          "line-color": ROUTE_COLORS[route.type] || "#888",
          "line-width": 3,
          "line-opacity": 0.8,
        };
        if (route.style === "dashed") paint["line-dasharray"] = [2, 4];

        m.addLayer({
          id,
          type: "line",
          source: id,
          layout: { "line-join": "round", "line-cap": "round" },
          paint,
        });
        routeIdsRef.current.push(id);

        safeTimeout(() => {
          animateRouteDraw(m, id, coordinates, 1500);
        }, 500 + i * 300);
      } catch {}
    });

    // Annotations
    safeTimeout(() => {
      (phase.annotations || []).forEach((ann) => {
        try {
          const popup = new mapboxgl.Popup({
            closeButton: false,
            closeOnClick: false,
            className: `vs-popup vs-popup-${ann.type}`,
            offset: 12,
            maxWidth: "260px",
          })
            .setLngLat(ann.coordinates)
            .setHTML(`<span>${ann.text}</span>`)
            .addTo(m);
          popupsRef.current.push(popup);
        } catch {}
      });
    }, 1000);

    return () => cancelPending();
  }, [activePhase, mapLoaded, cancelPending, safeTimeout, animateRouteDraw]);

  if (!MAPBOX_TOKEN) {
    return (
      <div
        className="flex flex-col items-center justify-center gap-3"
        style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, background: "#0d0d0d", border: "1px solid #1e1e1e", borderRadius: 6 }}
      >
        <MapPin size={28} color="#333" />
        <div className="text-[14px]" style={{ color: "#555" }}>Map requires Mapbox token</div>
        <div className="text-[12px]" style={{ color: "#444" }}>
          Add <code className="text-[11px] px-1.5 py-0.5 rounded" style={{ background: "#1a1a1a", color: "#09BC8A" }}>VITE_MAPBOX_TOKEN</code> to{" "}
          <code className="text-[11px] px-1.5 py-0.5 rounded" style={{ background: "#1a1a1a", color: "#888" }}>.env</code>
        </div>
        <a href="https://mapbox.com" target="_blank" rel="noopener noreferrer" className="text-[11px] mt-1" style={{ color: "#09BC8A" }}>
          Get a free token at mapbox.com
        </a>
      </div>
    );
  }

  return (
    <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, borderRadius: 6, overflow: "hidden" }}>
      <div ref={containerRef} style={{ width: "100%", height: "100%" }} />
    </div>
  );
}
