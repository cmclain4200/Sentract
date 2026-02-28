import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { useOutletContext } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import { Crosshair, Copy, RefreshCw, ChevronDown, Globe, Database, AlertTriangle, Activity, Users, FileText, Clock, Trash2, Map, Maximize2, Minimize2 } from "lucide-react";
import ModuleWrapper from "../components/ModuleWrapper";
import TacticalMap from "../components/TacticalMap";
import PhaseControls from "../components/PhaseControls";
import { calculateCompleteness } from "../lib/profileCompleteness";
import { profileToPromptText, countDataPoints } from "../lib/profileToPrompt";
import { geocodeProfileLocations, formatGeocodedLocations } from "../lib/geocode";
import { callAnthropic, hasAnthropicKey } from "../lib/api";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";

const ADVERSARY_TYPES = [
  { value: "corporate_espionage", label: "Corporate Espionage Actor", desc: "Competitor intelligence operative" },
  { value: "social_engineering", label: "Social Engineering Specialist", desc: "Pretexting, phishing, BEC" },
  { value: "physical_surveillance", label: "Physical Surveillance Operative", desc: "Stalking, tracking, physical access" },
  { value: "hacktivism", label: "Activist / Hacktivism Group", desc: "Public exposure, doxxing, reputational attack" },
  { value: "insider_threat", label: "Insider Threat", desc: "Disgruntled employee with partial internal access" },
  { value: "opportunistic", label: "Opportunistic Criminal", desc: "Low-effort fraud, identity theft" },
];

const OBJECTIVES = [
  { value: "financial_fraud", label: "Financial Fraud / BEC", desc: "Business email compromise, wire fraud" },
  { value: "physical_harm", label: "Physical Harm / Kidnapping", desc: "Physical security threat" },
  { value: "ip_theft", label: "Corporate Intelligence Theft", desc: "IP/strategic data exfiltration" },
  { value: "reputational", label: "Reputational Destruction", desc: "Public embarrassment, media manipulation" },
  { value: "stalking", label: "Stalking / Harassment", desc: "Persistent unwanted contact or surveillance" },
  { value: "network_penetration", label: "Network Penetration", desc: "Using exec as entry point to corporate network" },
];

const SOPHISTICATION_LEVELS = [
  { value: "low", label: "Low", desc: "Script kiddie, opportunistic" },
  { value: "medium", label: "Medium", desc: "Professional criminal, some resources" },
  { value: "high", label: "High", desc: "Organized crime, well-funded" },
  { value: "nation_state", label: "Nation-State", desc: "APT-level, unlimited resources" },
];

const SYSTEM_PROMPT = `You are an adversarial intelligence analyst conducting a red-team assessment for an executive protection engagement. Your role is to think like a threat actor and identify how a target's exposed data could be weaponized. You must be specific, tactical, and cite exactly which data points enable each attack vector. Your assessment is used by security professionals to protect the target.

IMPORTANT FRAMING RULES:
- Every vulnerability you identify MUST be paired with a specific countermeasure
- Frame findings as "this data creates exposure because..." not "an attacker should..."
- The assessment's purpose is to PROTECT the subject, not to provide an attack playbook
- Use language like "vulnerability window," "exposure point," "data leakage" — not "attack opportunity," "target," "exploit"
- End every section with actionable defensive recommendations

You must return your response in TWO parts, separated by the exact delimiter "---SCENARIO_JSON---"

PART 1: The narrative assessment in markdown format. Structure around sequential PHASES (Phase 1, Phase 2, etc.) representing chronological steps of the scenario.

## Executive Summary
2-3 sentence overview.

## Phase 1: [Phase Name]
Describe this phase. Reference specific locations, times, data points used.

## Phase 2: [Phase Name]
Next phase. Be specific about locations, movement, timing.

(Continue with 4-6 phases total)

## Critical Vulnerabilities Exploited
For each vulnerability:
- **What data is exposed**: The specific data point(s)
- **How it creates risk**: The specific exposure mechanism
- **Remediation priority**: CRITICAL / HIGH / MEDIUM / LOW
- **Recommended countermeasure**: Specific defensive action

## Recommended Countermeasures
Specific, actionable steps to neutralize each exposure vector.

PART 2: After "---SCENARIO_JSON---", provide a JSON object describing the scenario geospatially for an animated map.

The JSON schema:
{
  "scenario_title": "string",
  "map_center": [longitude, latitude],
  "map_zoom": 12,
  "key_locations": [{ "id": "loc_1", "name": "string", "type": "target_home|target_work|target_routine|surveillance_point|staging_area|interception_point|escape_route_start|associate_location|public_venue", "coordinates": [lng, lat], "description": "string", "icon": "home|building|running|eye|flag|alert-triangle|route|users|map-pin" }],
  "phases": [{ "phase_number": 1, "title": "string", "description": "string", "duration_text": "string", "map_state": { "center": [lng, lat], "zoom": 14, "pitch": 0, "bearing": 0 }, "active_locations": ["loc_1"], "routes": [{ "from": "loc_1", "to": "loc_2", "type": "target_route|adversary_route|surveillance_route", "style": "solid|dashed" }], "annotations": [{ "coordinates": [lng, lat], "text": "string", "type": "info|warning|danger|timing" }] }],
  "threat_zones": [{ "center": [lng, lat], "radius_meters": 200, "type": "high_risk|moderate_risk|surveillance_zone" }]
}

CRITICAL COORDINATE RULES:
- The user message will include a "GEOCODED COORDINATES" section with exact [longitude, latitude] pairs for each known address. You MUST use these exact coordinates in your JSON — do NOT invent or approximate coordinates.
- For map_center, use the centroid of the geocoded locations.
- For key_locations, use the geocoded coordinates for any location that matches a profile address. For additional scenario-specific locations (surveillance points, staging areas), place them geographically near the real locations using small offsets (±0.001 to ±0.005 degrees).
- Every phase's map_state.center should correspond to the area where that phase's action occurs, using the real coordinates.
- Each phase must correspond to the narrative. 4-6 phases. Valid JSON only.`;

const DELIMITER = "---SCENARIO_JSON---";

const LOADING_MESSAGES = [
  'Analyzing subject exposure profile...',
  'Mapping known locations and transit patterns...',
  'Generating adversarial approach vectors...',
  'Computing vulnerability windows...',
  'Building tactical scenario...',
];

export default function ReconMirror() {
  const { subject, caseData } = useOutletContext();
  const { user } = useAuth();
  const profileData = subject?.profile_data || {};
  const completeness = calculateCompleteness(profileData);
  const dataCounts = countDataPoints(profileData);

  const [adversaryType, setAdversaryType] = useState(ADVERSARY_TYPES[0].label);
  const [objective, setObjective] = useState(OBJECTIVES[0].label);
  const [sophistication, setSophistication] = useState("medium");
  const [rawOutput, setRawOutput] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState(null);
  const [generatedAt, setGeneratedAt] = useState(null);
  const [parsedScenario, setParsedScenario] = useState(null);
  const [assessments, setAssessments] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [activePhase, setActivePhase] = useState(0);
  const [showMap, setShowMap] = useState(true);
  const [mapExpanded, setMapExpanded] = useState(false);
  const [genMessageIdx, setGenMessageIdx] = useState(0);
  const abortRef = useRef(null);
  const narrativeRef = useRef(null);
  const phaseRefs = useRef({});
  const genStartRef = useRef(null);

  // Abort streaming on unmount
  useEffect(() => {
    return () => { if (abortRef.current) abortRef.current.abort(); };
  }, []);

  // Cycle loading messages during generation
  useEffect(() => {
    if (!isGenerating) return;
    const timer = setInterval(() => {
      setGenMessageIdx((prev) => (prev + 1) % LOADING_MESSAGES.length);
    }, 2000);
    return () => clearInterval(timer);
  }, [isGenerating]);

  // Fetch assessment history
  useEffect(() => {
    if (!subject?.id) return;
    supabase
      .from("assessments")
      .select("id, created_at, parameters, narrative_output, scenario_json")
      .eq("subject_id", subject.id)
      .eq("type", "recon_mirror")
      .order("created_at", { ascending: false })
      .then(({ data }) => setAssessments(data || []));
  }, [subject?.id]);

  const narrative = useMemo(() => {
    if (!rawOutput) return "";
    const idx = rawOutput.indexOf(DELIMITER);
    return idx === -1 ? rawOutput.trim() : rawOutput.slice(0, idx).trim();
  }, [rawOutput]);

  // Parse scenario JSON when streaming completes
  useEffect(() => {
    if (isGenerating || !rawOutput) return;
    const idx = rawOutput.indexOf(DELIMITER);
    if (idx === -1) {
      console.warn("[ReconMirror] No DELIMITER found in output (" + rawOutput.length + " chars)");
      return;
    }
    const jsonRaw = rawOutput.slice(idx + DELIMITER.length).trim();
    try {
      const cleaned = jsonRaw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      setParsedScenario(JSON.parse(cleaned));
    } catch (e) {
      console.warn("[ReconMirror] JSON parse failed:", e.message, "\nRaw (first 200):", jsonRaw.slice(0, 200));
      setParsedScenario(null);
    }
  }, [isGenerating, rawOutput]);

  // Scroll to active phase
  useEffect(() => {
    const el = phaseRefs.current[`phase-${activePhase}`];
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [activePhase]);

  const generate = async () => {
    if (!hasAnthropicKey()) { setError("Anthropic API key not configured"); return; }

    setIsGenerating(true);
    setRawOutput("");
    setError(null);
    setGeneratedAt(null);
    setActivePhase(0);
    setParsedScenario(null);
    setGenMessageIdx(0);
    genStartRef.current = Date.now();

    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const promptText = profileToPromptText(profileData);
    const levelLabel = SOPHISTICATION_LEVELS.find((s) => s.value === sophistication)?.label || sophistication;

    // Geocode all profile addresses before calling Claude
    let geoSection = '';
    try {
      const geocoded = await geocodeProfileLocations(profileData);
      if (geocoded.length > 0) {
        geoSection = '\n\n' + formatGeocodedLocations(geocoded);
      }
    } catch {}

    try {
      const response = await callAnthropic({
        model: "claude-sonnet-4-20250514",
        max_tokens: 12000,
        stream: true,
        system: SYSTEM_PROMPT,
        messages: [{
          role: "user",
          content: `Generate an adversarial assessment for the following subject:\n\nAdversary Type: ${adversaryType}\nObjective: ${objective}\nSophistication: ${levelLabel}\n\nSUBJECT INTELLIGENCE PROFILE:\n${promptText}${geoSection}`,
        }],
        signal: controller.signal,
      });

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";
      let lineBuf = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        lineBuf += decoder.decode(value, { stream: true });
        const lines = lineBuf.split("\n");
        lineBuf = lines.pop(); // keep incomplete trailing line in buffer
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6).trim();
            if (data === "[DONE]") continue;
            try {
              const parsed = JSON.parse(data);
              if (parsed.type === "content_block_delta" && parsed.delta?.text) {
                accumulated += parsed.delta.text;
              }
            } catch {}
          }
        }
      }

      setGeneratedAt(new Date().toISOString());

      // Save assessment (immediately, regardless of reveal delay)
      if (subject?.id && user?.id) {
        const delimIdx = accumulated.indexOf(DELIMITER);
        const narrativeText = delimIdx === -1 ? accumulated.trim() : accumulated.slice(0, delimIdx).trim();
        let scenarioJson = null;
        if (delimIdx !== -1) {
          try {
            const raw = accumulated.slice(delimIdx + DELIMITER.length).trim().replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
            scenarioJson = JSON.parse(raw);
          } catch {}
        }

        const { data: saved } = await supabase.from("assessments").insert({
          subject_id: subject.id,
          user_id: user.id,
          type: "recon_mirror",
          module: "recon_mirror",
          parameters: { adversaryType, objective, sophistication: levelLabel },
          narrative_output: narrativeText,
          scenario_json: scenarioJson,
          model_used: "claude-sonnet-4-20250514",
          data: {},
        }).select("id, created_at, parameters, narrative_output, scenario_json").single();

        if (saved) setAssessments((prev) => [saved, ...prev]);
      }

      // Enforce minimum animation duration (4s) before revealing results
      const elapsed = Date.now() - genStartRef.current;
      const reveal = () => { setRawOutput(accumulated); setIsGenerating(false); };
      if (elapsed < 4000) {
        setTimeout(reveal, 4000 - elapsed);
      } else {
        reveal();
      }
    } catch (err) {
      if (err.name === "AbortError") return;
      setError(err.message);
      setIsGenerating(false);
    }
  };

  function loadAssessment(assessment) {
    setRawOutput(assessment.narrative_output || "");
    setParsedScenario(assessment.scenario_json || null);
    setGeneratedAt(assessment.created_at);
    setActivePhase(0);
    setShowHistory(false);
  }

  async function deleteAssessment(id) {
    await supabase.from("assessments").delete().eq("id", id);
    setAssessments((prev) => prev.filter((a) => a.id !== id));
  }

  const dataPoints = [
    { icon: Globe, label: `${dataCounts.social} social account${dataCounts.social !== 1 ? "s" : ""}`, show: dataCounts.social > 0 },
    { icon: Database, label: `${dataCounts.brokers} data broker listing${dataCounts.brokers !== 1 ? "s" : ""}`, color: "#f59e0b", show: dataCounts.brokers > 0 },
    { icon: AlertTriangle, label: `${dataCounts.breaches} breach record${dataCounts.breaches !== 1 ? "s" : ""}`, color: "#ef4444", show: dataCounts.breaches > 0 },
    { icon: Activity, label: `${dataCounts.behavioral} behavioral pattern${dataCounts.behavioral !== 1 ? "s" : ""}`, show: dataCounts.behavioral > 0 },
    { icon: Users, label: `${dataCounts.associates} associate${dataCounts.associates !== 1 ? "s" : ""}`, show: dataCounts.associates > 0 },
    { icon: FileText, label: `${dataCounts.records} public record${dataCounts.records !== 1 ? "s" : ""}`, show: dataCounts.records > 0 },
  ].filter((d) => d.show);

  const hasContent = rawOutput || isGenerating || error;

  return (
    <ModuleWrapper label="Adversarial Assessment" title="Recon Mirror" profileData={profileData} minCompleteness={20} completeness={completeness.score}>
      <div className="flex gap-5 flex-1 min-h-0">
        {/* Left: Config */}
        <div className="w-[280px] min-w-[280px] flex flex-col gap-5 overflow-y-auto">
          <div className="surface p-6 flex-none">
            <div className="section-label text-[10px] mb-5">Threat Profile Configuration</div>

            <div className="mb-5">
              <label className="sub-label block mb-2">Adversary Type</label>
              <ConfigSelect items={ADVERSARY_TYPES} value={adversaryType} onChange={setAdversaryType} />
            </div>

            <div className="mb-5">
              <label className="sub-label block mb-2">Objective</label>
              <ConfigSelect items={OBJECTIVES} value={objective} onChange={setObjective} />
            </div>

            <div className="mb-6">
              <label className="sub-label block mb-2">Sophistication Level</label>
              <div className="flex rounded-md overflow-hidden" style={{ border: "1px solid #1e1e1e" }}>
                {SOPHISTICATION_LEVELS.map((s, i) => (
                  <button
                    key={s.value}
                    onClick={() => setSophistication(s.value)}
                    className="flex-1 text-[11px] py-2.5 transition-all duration-200 font-medium cursor-pointer"
                    style={{
                      background: sophistication === s.value ? "#09BC8A" : "#0d0d0d",
                      color: sophistication === s.value ? "#000" : "#666",
                      borderLeft: i > 0 ? "1px solid #1e1e1e" : "none",
                      border: "none",
                    }}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
              <div className="text-[11px] mt-1.5" style={{ color: "#555" }}>
                {SOPHISTICATION_LEVELS.find((s) => s.value === sophistication)?.desc}
              </div>
            </div>

            <button
              onClick={generate}
              disabled={isGenerating}
              className="w-full py-3 text-[13px] font-semibold tracking-wide rounded-md flex items-center justify-center gap-2.5 transition-all duration-200 cursor-pointer"
              style={{
                background: isGenerating ? "#0d0d0d" : "#09BC8A",
                color: isGenerating ? "#09BC8A" : "#000",
                border: isGenerating ? "1px solid rgba(9, 188, 138,0.2)" : "1px solid #09BC8A",
              }}
            >
              {isGenerating ? (
                <><span className="pulse-dot" /><span className="pulse-dot" /><span className="pulse-dot" /><span className="ml-1">Generating...</span></>
              ) : (
                <><Crosshair size={15} />Generate Assessment</>
              )}
            </button>
          </div>

          {/* Data Points */}
          {dataPoints.length > 0 && (
            <div className="surface p-5 flex-none">
              <div className="sub-label mb-3">Data Points Feeding This Assessment</div>
              <div className="space-y-2">
                {dataPoints.map((d) => {
                  const Icon = d.icon;
                  return (
                    <div key={d.label} className="flex items-center gap-2.5">
                      <span className="text-[11px] font-mono select-none" style={{ color: "#333" }}>├──</span>
                      <Icon size={12} color={d.color || "#09BC8A"} />
                      <span className="text-[12px]" style={{ color: "#888" }}>{d.label}</span>
                    </div>
                  );
                })}
              </div>
              <div className="mt-3 pt-3" style={{ borderTop: "1px solid #1a1a1a" }}>
                <span className="text-[11px] font-mono" style={{ color: "#444" }}>Total: {dataCounts.total} data points</span>
              </div>
            </div>
          )}

          {/* Assessment History */}
          {assessments.length > 0 && (
            <div className="surface p-5 flex-none">
              <button
                onClick={() => setShowHistory(!showHistory)}
                className="w-full flex items-center justify-between cursor-pointer"
                style={{ background: "transparent", border: "none" }}
              >
                <span className="sub-label">Previous Assessments ({assessments.length})</span>
                <ChevronDown size={12} color="#555" style={{ transform: showHistory ? "rotate(180deg)" : "none", transition: "0.2s" }} />
              </button>
              {showHistory && (
                <div className="mt-3 space-y-2">
                  {assessments.map((a) => (
                    <div key={a.id} className="p-3 rounded" style={{ background: "#0d0d0d", border: "1px solid #1a1a1a" }}>
                      <div className="flex items-center gap-2 mb-1">
                        <Clock size={10} color="#555" />
                        <span className="text-[11px] font-mono" style={{ color: "#888" }}>
                          {new Date(a.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      <div className="text-[11px]" style={{ color: "#666" }}>
                        {a.parameters?.adversaryType} · {a.parameters?.objective}
                      </div>
                      <div className="flex gap-2 mt-2">
                        <button
                          onClick={() => loadAssessment(a)}
                          className="text-[10px] px-2 py-1 rounded cursor-pointer"
                          style={{ background: "transparent", border: "1px solid #333", color: "#09BC8A" }}
                        >
                          View
                        </button>
                        <button
                          onClick={() => deleteAssessment(a.id)}
                          className="text-[10px] px-2 py-1 rounded cursor-pointer"
                          style={{ background: "transparent", border: "1px solid #333", color: "#555" }}
                        >
                          <Trash2 size={9} className="inline" style={{ verticalAlign: "-1px" }} /> Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right: Map + Narrative */}
        <div className={`flex-1 flex flex-col overflow-hidden ${isGenerating ? "border-pulse" : ""}`}>
          {/* Expanded Map Overlay */}
          {mapExpanded && parsedScenario && (
            <div className="fixed inset-0 z-50 flex flex-col" style={{ background: "#0a0a0a" }}>
              <div className="relative flex-1" style={{ minHeight: 0 }}>
                <TacticalMap scenarioData={parsedScenario} activePhase={activePhase} />
                <button
                  onClick={() => setMapExpanded(false)}
                  className="absolute top-3 right-3 z-10 p-2 rounded-md cursor-pointer transition-all"
                  style={{ background: "rgba(17,17,17,0.9)", border: "1px solid #333", color: "#888" }}
                >
                  <Minimize2 size={16} />
                </button>
              </div>
              <div style={{ background: "#111", borderTop: "1px solid #1e1e1e" }}>
                <PhaseControls phases={parsedScenario.phases} activePhase={activePhase} onPhaseChange={setActivePhase} />
              </div>
            </div>
          )}

          {/* Map Panel (inline) */}
          {!mapExpanded && showMap && (parsedScenario || isGenerating) && (
            <div className="shrink-0 flex flex-col" style={{ height: 340 }}>
              {parsedScenario ? (
                <>
                  <div className="relative flex-1" style={{ minHeight: 0 }}>
                    <TacticalMap scenarioData={parsedScenario} activePhase={activePhase} />
                    <button
                      onClick={() => setMapExpanded(true)}
                      className="absolute top-3 left-3 z-10 p-2 rounded-md cursor-pointer transition-all"
                      style={{ background: "rgba(17,17,17,0.9)", border: "1px solid #333", color: "#888" }}
                    >
                      <Maximize2 size={14} />
                    </button>
                  </div>
                  <PhaseControls phases={parsedScenario.phases} activePhase={activePhase} onPhaseChange={setActivePhase} />
                </>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center relative" style={{ background: "#0d0d0d", border: "1px solid #1e1e1e", borderRadius: 6, overflow: "hidden" }}>
                  <div className="recon-generating-overlay">
                    <div className="scan-line" />
                    <div className="generating-status">
                      <div className="generating-spinner" />
                      <span>{LOADING_MESSAGES[genMessageIdx]}</span>
                    </div>
                  </div>
                  <Map size={28} color="#333" className="mb-3" style={{ opacity: 0.3 }} />
                  <div className="text-[11px] mt-2" style={{ color: "#333" }}>Building tactical scenario...</div>
                </div>
              )}
            </div>
          )}

          {/* Narrative */}
          <div className="flex-1 flex flex-col overflow-hidden surface" style={parsedScenario && showMap ? { borderTop: "none" } : {}}>
            <div className="flex items-center justify-between px-5 py-3 shrink-0" style={{ borderBottom: "1px solid #1e1e1e" }}>
              <span className="section-label text-[10px]">Generated Assessment</span>
              <div className="flex gap-2">
                {parsedScenario && (
                  <ActionBtn icon={Map} label={showMap ? "Hide Map" : "Show Map"} onClick={() => setShowMap(!showMap)} />
                )}
                {narrative && (
                  <>
                    <ActionBtn icon={Copy} label="Copy" onClick={() => navigator.clipboard.writeText(narrative)} />
                    <ActionBtn icon={RefreshCw} label="Regenerate" onClick={generate} />
                  </>
                )}
              </div>
            </div>

            {hasContent ? (
              <div ref={narrativeRef} className="flex-1 overflow-y-auto px-6 py-5 min-h-0">
                {error && (
                  <div className="surface-inner p-5 mb-4" style={{ borderLeft: "3px solid #ef4444" }}>
                    <div className="text-[14px] font-semibold mb-1" style={{ color: "#ef4444" }}>Generation Failed</div>
                    <div className="text-[13px]" style={{ color: "#999" }}>{error}</div>
                  </div>
                )}
                {narrative ? (
                  <PhaseAwareMarkdown markdown={narrative} activePhase={activePhase} onPhaseClick={setActivePhase} phaseRefs={phaseRefs} />
                ) : isGenerating && !rawOutput ? (
                  <div className="flex items-center gap-3 py-4">
                    <span className="pulse-dot" /><span className="pulse-dot" /><span className="pulse-dot" />
                    <span className="text-[14px]" style={{ color: "#888" }}>Generating adversarial assessment...</span>
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center">
                <Crosshair size={36} color="#1e1e1e" />
                <p className="text-[15px] mt-5" style={{ color: "#444" }}>
                  Configure threat parameters and generate an adversarial assessment
                </p>
                <p className="text-[12px] mt-2" style={{ color: "#333" }}>Powered by Claude AI</p>
              </div>
            )}

            {generatedAt && (
              <div className="px-5 py-2 text-center shrink-0" style={{ borderTop: "1px solid #1e1e1e" }}>
                <span className="text-[10px] font-mono" style={{ color: "#444" }}>
                  Generated by Sentract RECON MIRROR · claude-sonnet-4 · {new Date(generatedAt).toLocaleString()}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </ModuleWrapper>
  );
}

function getSeverityClass(title) {
  const t = (title || "").toLowerCase();
  if (t.includes("recon") || t.includes("surveillance") || t.includes("gather") || t.includes("intel")) return "sev-recon";
  if (t.includes("approach") || t.includes("position") || t.includes("access") || t.includes("setup")) return "sev-approach";
  if (t.includes("exploit") || t.includes("compromise") || t.includes("extract") || t.includes("attack")) return "sev-exploit";
  return "sev-recon";
}

function getSeverityLabel(title) {
  const cls = getSeverityClass(title);
  if (cls === "sev-exploit") return "High Risk";
  if (cls === "sev-approach") return "Elevated";
  return "Recon";
}

function highlightEntities(text) {
  if (!text) return text;
  let result = text
    .replace(/\b(\d{4}\s?hrs?)\b/gi, '<span class="entity-time">$1</span>')
    .replace(/\b(\d{1,2}:\d{2}\s?[APap][Mm])\b/g, '<span class="entity-time">$1</span>')
    .replace(/\b(\d+\s?(?:meters?|m|feet|ft|miles?|km|yards?|blocks?))\b/gi, '<span class="entity-distance">$1</span>');
  return <span dangerouslySetInnerHTML={{ __html: result }} />;
}

function PhaseAwareMarkdown({ markdown, activePhase, onPhaseClick, phaseRefs }) {
  const sections = [];
  const lines = markdown.split("\n");
  let currentSection = { type: "pre", lines: [], phaseIdx: -1 };
  let phaseCounter = 0;

  for (const line of lines) {
    const phaseMatch = line.match(/^## Phase (\d+):\s*(.+)$/);
    if (phaseMatch) {
      if (currentSection.lines.length > 0) sections.push(currentSection);
      currentSection = { type: "phase", lines: [line], phaseIdx: phaseCounter, title: phaseMatch[2].trim() };
      phaseCounter++;
    } else if (line.match(/^## /) && currentSection.type === "phase") {
      if (currentSection.lines.length > 0) sections.push(currentSection);
      currentSection = { type: "post", lines: [line], phaseIdx: -1 };
    } else {
      currentSection.lines.push(line);
    }
  }
  if (currentSection.lines.length > 0) sections.push(currentSection);

  return (
    <div className="markdown-content fade-in">
      {sections.map((section, i) => {
        if (section.type === "phase") {
          const isActive = section.phaseIdx === activePhase;
          const phaseBody = section.lines.slice(1).join("\n").trim();
          const hasCountermeasure = /countermeasure|mitigation|remediation/i.test(phaseBody);
          const bodyParts = hasCountermeasure
            ? phaseBody.split(/(?=\*\*(?:Countermeasure|Recommended countermeasure|Mitigation|Remediation)[:\s*]*\*\*)/i)
            : [phaseBody];

          return (
            <div
              key={i}
              ref={(el) => { phaseRefs.current[`phase-${section.phaseIdx}`] = el; }}
              className={`relative pl-4 py-3 my-2 rounded-r-md cursor-pointer transition-all duration-300 ${isActive ? "narrative-phase-enter" : ""}`}
              style={{ borderLeft: isActive ? "3px solid #09BC8A" : "3px solid #2a2a2a", background: isActive ? "#111" : "transparent" }}
              onClick={() => onPhaseClick(section.phaseIdx)}
            >
              <div className="narrative-header">
                <span className="narrative-phase-label">Phase {section.phaseIdx + 1}</span>
                <span className="narrative-phase-name">{section.title}</span>
                <span className={`narrative-severity ${getSeverityClass(section.title)}`}>
                  {getSeverityLabel(section.title)}
                </span>
              </div>
              <div className="narrative-body">
                <ReactMarkdown components={{
                  p: ({ children }) => <p>{typeof children === "string" ? highlightEntities(children) : children}</p>,
                }}>{bodyParts[0]}</ReactMarkdown>
              </div>
              {bodyParts.length > 1 && (
                <div className="narrative-countermeasure">
                  <div className="countermeasure-label">⛨ Countermeasure</div>
                  <div className="countermeasure-text">
                    <ReactMarkdown>{bodyParts.slice(1).join("\n").replace(/^\*\*(?:Countermeasure|Recommended countermeasure|Mitigation|Remediation)[:\s*]*\*\*\s*/i, "")}</ReactMarkdown>
                  </div>
                </div>
              )}
            </div>
          );
        }
        return <div key={i}><ReactMarkdown>{section.lines.join("\n")}</ReactMarkdown></div>;
      })}
    </div>
  );
}

function ConfigSelect({ items, value, onChange }) {
  const selected = items.find((i) => i.label === value);
  return (
    <>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="form-select text-[13px] p-3"
          style={{ background: "#0d0d0d" }}
        >
          {items.map((t) => <option key={t.value} value={t.label}>{t.label}</option>)}
        </select>
      </div>
      {selected && <div className="text-[11px] mt-1.5" style={{ color: "#555" }}>{selected.desc}</div>}
    </>
  );
}

function ActionBtn({ icon: Icon, label, onClick }) {
  return (
    <button
      onClick={onClick}
      className="text-[11px] px-2.5 py-1.5 rounded-md flex items-center gap-1.5 transition-all duration-200 cursor-pointer"
      style={{ color: "#888", background: "transparent", border: "1px solid #2a2a2a" }}
    >
      <Icon size={11} />{label}
    </button>
  );
}
