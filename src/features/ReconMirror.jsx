import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { useOutletContext } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import { Crosshair, Copy, RefreshCw, ChevronDown, Globe, Database, AlertTriangle, Activity, Users, FileText, Clock, Trash2, Map, Maximize2, Minimize2, Shield, ShieldCheck } from "lucide-react";
import ModuleWrapper from "../components/ModuleWrapper";
import TacticalMap from "../components/TacticalMap";
import PhaseControls from "../components/PhaseControls";
import { calculateCompleteness } from "../lib/profileCompleteness";
import { countDataPoints } from "../lib/profileToPrompt";
import { geocodeProfileLocations, formatGeocodedLocations } from "../lib/geocode";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";
import { useEngine, ADVERSARY_TYPES, OBJECTIVES, SOPHISTICATION_LEVELS } from "../engine";
import SourceLinkedNarrative from "../components/recon/SourceLinkedNarrative";
import ThreatActorCard from "../components/recon/ThreatActorCard";
import CountermeasurePanel from "../components/recon/CountermeasurePanel";
import { extractCountermeasures } from "../components/recon/countermeasureUtils";

const LOADING_MESSAGES = [
  'Analyzing subject exposure profile...',
  'Mapping known locations and transit patterns...',
  'Generating adversarial approach vectors...',
  'Computing vulnerability windows...',
  'Building tactical scenario...',
];

// Old format delimiter — kept for backward compat parsing
const DELIMITER = "---SCENARIO_JSON---";

export default function ReconMirror() {
  const { subject, caseData } = useOutletContext();
  const { user } = useAuth();
  const engine = useEngine();
  const profileData = subject?.profile_data || {};
  const completeness = calculateCompleteness(profileData);
  const dataCounts = countDataPoints(profileData);

  const [adversaryType, setAdversaryType] = useState(ADVERSARY_TYPES[0].label);
  const [objective, setObjective] = useState(OBJECTIVES[0].label);
  const [sophistication, setSophistication] = useState("medium");
  const [rawOutput, setRawOutput] = useState("");
  const [assessment, setAssessment] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState(null);
  const [generatedAt, setGeneratedAt] = useState(null);
  const [parsedScenario, setParsedScenario] = useState(null);
  const [assessments, setAssessments] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [activePhase, setActivePhase] = useState(0);
  const [sourceLinks, setSourceLinks] = useState([]);
  const [showMap, setShowMap] = useState(true);
  const [mapExpanded, setMapExpanded] = useState(false);
  const [genMessageIdx, setGenMessageIdx] = useState(0);
  const [streamingText, setStreamingText] = useState("");
  const [revealedPhases, setRevealedPhases] = useState(-1); // -1 = all revealed, 0+ = revealing
  const [isRevealing, setIsRevealing] = useState(false);
  const [isShieldMode, setIsShieldMode] = useState(false);
  const [countermeasures, setCountermeasures] = useState([]);
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulatedResult, setSimulatedResult] = useState(null);
  const abortRef = useRef(null);
  const narrativeRef = useRef(null);
  const phaseRefs = useRef({});
  const genStartRef = useRef(null);
  const revealTimerRef = useRef(null);

  // Detect format: new format has executive_summary at top level
  const isNewFormat = !!assessment?.executive_summary;

  // Abort streaming and clear timers on unmount
  useEffect(() => {
    return () => {
      if (abortRef.current) abortRef.current.abort();
      if (revealTimerRef.current) clearInterval(revealTimerRef.current);
    };
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

  // Extract countermeasures from assessment when available
  useEffect(() => {
    if (assessment?.executive_summary) {
      const cms = extractCountermeasures(assessment, sourceLinks);
      setCountermeasures(cms);
    } else {
      setCountermeasures([]);
    }
    setIsShieldMode(false);
    setSimulatedResult(null);
  }, [assessment, sourceLinks]);

  // Derive the display assessment (original or simulated)
  const displayAssessment = simulatedResult?.assessment || assessment;
  const displaySourceLinks = simulatedResult?.sourceLinks || sourceLinks;
  const displayScenario = simulatedResult?.scenarioJson || parsedScenario;

  function handleToggleCountermeasure(id) {
    setCountermeasures(prev =>
      prev.map(cm => cm.id === id ? { ...cm, enabled: !cm.enabled } : cm)
    );
    setSimulatedResult(null);
  }

  async function handleSimulate() {
    const active = countermeasures.filter(c => c.enabled);
    if (active.length === 0) return;

    setIsSimulating(true);
    try {
      const levelLabel = SOPHISTICATION_LEVELS.find((s) => s.value === sophistication)?.label || sophistication;
      const result = await engine.reconMirror.simulate({
        originalAssessment: assessment,
        activeCountermeasures: active,
        profileData,
        params: { adversaryType, objective, sophistication: levelLabel },
      });
      setSimulatedResult(result);
    } catch (err) {
      console.error('Simulation failed:', err);
    }
    setIsSimulating(false);
  }

  // Derive narrative text for old format + copy button
  const narrative = useMemo(() => {
    // New format: build copyable text from assessment
    if (assessment?.executive_summary) {
      const parts = [];
      parts.push(assessment.title || "Adversarial Assessment");
      parts.push("");
      parts.push("EXECUTIVE SUMMARY");
      parts.push(assessment.executive_summary);
      parts.push("");
      if (assessment.probability_assessment) {
        parts.push("PROBABILITY: " + assessment.probability_assessment);
        parts.push("");
      }
      (assessment.phases || []).forEach((p, i) => {
        parts.push(`PHASE ${p.number || i + 1}: ${p.name}`);
        parts.push(p.narrative);
        if (p.countermeasure) parts.push("Countermeasure: " + p.countermeasure);
        parts.push("");
      });
      if (assessment.critical_vulnerabilities?.length) {
        parts.push("CRITICAL VULNERABILITIES");
        assessment.critical_vulnerabilities.forEach((v) => {
          parts.push(`- ${v.title} [${v.severity}]: ${v.risk_mechanism}`);
          parts.push(`  Countermeasure: ${v.countermeasure}`);
        });
        parts.push("");
      }
      if (assessment.recommended_actions) {
        parts.push("RECOMMENDED ACTIONS");
        if (assessment.recommended_actions.immediate?.length) {
          parts.push("Immediate:");
          assessment.recommended_actions.immediate.forEach((a) => parts.push(`  - ${a}`));
        }
        if (assessment.recommended_actions.short_term?.length) {
          parts.push("Short-term:");
          assessment.recommended_actions.short_term.forEach((a) => parts.push(`  - ${a}`));
        }
        if (assessment.recommended_actions.long_term?.length) {
          parts.push("Long-term:");
          assessment.recommended_actions.long_term.forEach((a) => parts.push(`  - ${a}`));
        }
      }
      return parts.join("\n");
    }
    // Old format: strip delimiter
    if (!rawOutput) return "";
    const idx = rawOutput.indexOf(DELIMITER);
    return idx === -1 ? rawOutput.trim() : rawOutput.slice(0, idx).trim();
  }, [rawOutput, assessment]);

  // Parse scenario JSON for old format when streaming completes
  useEffect(() => {
    if (isGenerating || !rawOutput || assessment) return;
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
  }, [isGenerating, rawOutput, assessment]);

  // Scroll to active phase
  useEffect(() => {
    const el = phaseRefs.current[`phase-${activePhase}`];
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [activePhase]);

  const generate = async () => {
    if (!engine.provider.hasKey) { setError("Anthropic API key not configured"); return; }

    setIsGenerating(true);
    setRawOutput("");
    setAssessment(null);
    setError(null);
    setGeneratedAt(null);
    setActivePhase(0);
    setParsedScenario(null);
    setSourceLinks([]);
    setStreamingText("");
    setRevealedPhases(-1);
    setIsRevealing(false);
    setGenMessageIdx(0);
    if (revealTimerRef.current) clearInterval(revealTimerRef.current);
    genStartRef.current = Date.now();

    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

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
      const stream = engine.reconMirror.stream({
        profileData,
        adversaryType,
        objective,
        sophisticationLabel: levelLabel,
        geoSection,
      });

      for await (const delta of stream) {
        // Update streaming text so user sees generation progress
        setStreamingText(stream.getText());
      }

      const { assessment: parsedAssessment, narrativeText, scenarioJson, sourceLinks: links } = stream.getResult();

      setGeneratedAt(new Date().toISOString());

      // Save assessment to DB
      if (subject?.id && user?.id) {
        const { data: saved } = await supabase.from("assessments").insert({
          subject_id: subject.id,
          user_id: user.id,
          type: "recon_mirror",
          module: "recon_mirror",
          parameters: { adversaryType, objective, sophistication: levelLabel, source_links: links || [] },
          narrative_output: narrativeText,
          scenario_json: scenarioJson,
          model_used: "claude-sonnet-4-20250514",
          data: {},
        }).select("id, created_at, parameters, narrative_output, scenario_json").single();

        if (saved) setAssessments((prev) => [saved, ...prev]);
      }

      // Enforce minimum animation duration (4s) before revealing results
      const elapsed = Date.now() - genStartRef.current;
      const reveal = () => {
        setStreamingText("");
        if (parsedAssessment?.executive_summary) {
          setAssessment(parsedAssessment);
          setParsedScenario(parsedAssessment);
          // Start phased reveal animation
          const phaseCount = parsedAssessment.phases?.length || 0;
          if (phaseCount > 0) {
            setRevealedPhases(0);
            setIsRevealing(true);
            setActivePhase(0);
            let current = 0;
            revealTimerRef.current = setInterval(() => {
              current++;
              if (current >= phaseCount) {
                clearInterval(revealTimerRef.current);
                revealTimerRef.current = null;
                setRevealedPhases(-1);
                setIsRevealing(false);
              } else {
                setRevealedPhases(current);
                setActivePhase(current);
              }
            }, 2500);
          }
        } else {
          setRawOutput(stream.getText());
        }
        setSourceLinks(links || []);
        setIsGenerating(false);
      };
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

  function loadAssessment(a) {
    const sj = a.scenario_json;
    if (sj?.executive_summary) {
      // New format
      setAssessment(sj);
      setParsedScenario(sj);
      setRawOutput("");
    } else {
      // Old format
      setAssessment(null);
      setRawOutput(a.narrative_output || "");
      setParsedScenario(sj || null);
    }
    // Restore source links from saved assessment (stored in parameters or in scenario_json)
    setSourceLinks(a.parameters?.source_links || sj?.source_links || []);
    setGeneratedAt(a.created_at);
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

  const hasContent = rawOutput || assessment || isGenerating || error;

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

            <div className="mb-5">
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

            <ThreatActorCard
              adversaryType={adversaryType}
              sophistication={SOPHISTICATION_LEVELS.find((s) => s.value === sophistication)?.label || sophistication}
            />

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
          {mapExpanded && displayScenario && (
            <div className="fixed inset-0 z-50 flex flex-col" style={{ background: "#0a0a0a" }}>
              <div className="relative flex-1" style={{ minHeight: 0 }}>
                <TacticalMap scenarioData={displayScenario} activePhase={activePhase} />
                <button
                  onClick={() => setMapExpanded(false)}
                  className="absolute top-3 left-3 z-10 p-2 rounded-md cursor-pointer transition-all"
                  style={{ background: "rgba(17,17,17,0.9)", border: "1px solid #333", color: "#888" }}
                >
                  <Minimize2 size={16} />
                </button>
              </div>
              <div style={{ background: "#111", borderTop: "1px solid #1e1e1e" }}>
                <PhaseControls phases={displayScenario.phases} activePhase={activePhase} onPhaseChange={setActivePhase} />
              </div>
            </div>
          )}

          {/* Map Panel (inline) */}
          {!mapExpanded && showMap && (displayScenario || isGenerating) && (
            <div className="shrink-0 flex flex-col" style={{ height: 340 }}>
              {displayScenario ? (
                <>
                  <div className="relative flex-1" style={{ minHeight: 0 }}>
                    <TacticalMap scenarioData={displayScenario} activePhase={activePhase} />
                    <button
                      onClick={() => setMapExpanded(true)}
                      className="absolute top-3 left-3 z-10 p-2 rounded-md cursor-pointer transition-all"
                      style={{ background: "rgba(17,17,17,0.9)", border: "1px solid #333", color: "#888" }}
                    >
                      <Maximize2 size={14} />
                    </button>
                  </div>
                  <PhaseControls phases={displayScenario.phases} activePhase={activePhase} onPhaseChange={setActivePhase} />
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
          <div className="flex-1 flex flex-col overflow-hidden surface" style={displayScenario && showMap ? { borderTop: "none" } : {}}>
            <div className="flex items-center justify-between px-5 py-3 shrink-0" style={{ borderBottom: "1px solid #1e1e1e" }}>
              <span className="section-label text-[10px]">Generated Assessment</span>
              <div className="flex gap-2">
                {displayScenario && (
                  <ActionBtn icon={Map} label={showMap ? "Hide Map" : "Show Map"} onClick={() => setShowMap(!showMap)} />
                )}
                {(narrative || assessment) && !isGenerating && (
                  <>
                    <button
                      className={`shield-mode-toggle ${isShieldMode ? 'active' : ''}`}
                      onClick={() => {
                        setIsShieldMode(!isShieldMode);
                        if (isShieldMode) {
                          setSimulatedResult(null);
                        }
                      }}
                    >
                      <Shield size={14} />
                      {isShieldMode ? 'Exit Shield' : 'Shield Mode'}
                    </button>
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
                {simulatedResult && (
                  <div className="simulation-active-banner">
                    <ShieldCheck size={14} />
                    <span>Showing adapted scenario with {countermeasures.filter(c => c.enabled).length} countermeasures active</span>
                    <button onClick={() => setSimulatedResult(null)}>View original</button>
                  </div>
                )}
                {isNewFormat && displayAssessment ? (
                  <>
                    <AssessmentRenderer assessment={displayAssessment} activePhase={activePhase} onPhaseClick={setActivePhase} phaseRefs={phaseRefs} sourceLinks={displaySourceLinks} revealedPhases={revealedPhases} />
                    {isShieldMode && (
                      <CountermeasurePanel
                        countermeasures={countermeasures}
                        onToggle={handleToggleCountermeasure}
                        onSimulate={handleSimulate}
                        isSimulating={isSimulating}
                      />
                    )}
                  </>
                ) : narrative ? (
                  <PhaseAwareMarkdown markdown={narrative} activePhase={activePhase} onPhaseClick={setActivePhase} phaseRefs={phaseRefs} />
                ) : isGenerating ? (
                  <div className="streaming-container">
                    {streamingText ? (
                      <div className="streaming-narrative">
                        <span className="text-[13px] font-mono" style={{ color: "#555", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                          {streamingText.slice(-400)}
                        </span>
                        <span className="streaming-cursor" />
                      </div>
                    ) : (
                      <div className="flex items-center gap-3 py-4">
                        <span className="pulse-dot" /><span className="pulse-dot" /><span className="pulse-dot" />
                        <span className="text-[14px]" style={{ color: "#888" }}>Generating adversarial assessment...</span>
                      </div>
                    )}
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

/* ── Threat level badge helper ── */
function getThreatBadgeClass(level) {
  const l = (level || "").toUpperCase();
  if (l === "CRITICAL") return "sev-exploit";
  if (l === "HIGH") return "sev-approach";
  if (l === "MODERATE") return "sev-moderate";
  if (l === "LOW") return "sev-recon";
  return "sev-recon";
}

function getVulnSeverityClass(severity) {
  const s = (severity || "").toUpperCase();
  if (s === "CRITICAL") return "sev-critical";
  if (s === "HIGH") return "sev-high";
  if (s === "MEDIUM") return "sev-medium";
  if (s === "LOW") return "sev-low";
  return "sev-low";
}

/* ── AssessmentRenderer — structured JSON rendering ── */
function AssessmentRenderer({ assessment, activePhase, onPhaseClick, phaseRefs, sourceLinks = [], revealedPhases = -1 }) {
  const allPhases = assessment.phases || [];
  // During phased reveal, only show phases up to revealedPhases; -1 means show all
  const phases = revealedPhases === -1 ? allPhases : allPhases.slice(0, revealedPhases + 1);

  return (
    <div className="markdown-content fade-in">
      {/* Title + Overall Threat Level */}
      <div className="flex items-center gap-4 mb-5">
        <h2 className="!mt-0 !mb-0 !pb-0 !border-0 flex-1">{assessment.title || "Adversarial Assessment"}</h2>
        <span className={`narrative-severity ${getThreatBadgeClass(assessment.overall_threat_level)}`}>
          {assessment.overall_threat_level}
        </span>
      </div>

      {/* Executive Summary */}
      <div className="assessment-summary">{assessment.executive_summary}</div>

      {/* Probability Assessment */}
      {assessment.probability_assessment && (
        <div className="probability-note">{assessment.probability_assessment}</div>
      )}

      {/* Phases */}
      {phases.map((phase, i) => {
        const isActive = i === activePhase;
        return (
          <div
            key={i}
            ref={(el) => { phaseRefs.current[`phase-${i}`] = el; }}
            className={`relative pl-4 py-3 my-2 rounded-r-md cursor-pointer transition-all duration-300 ${isActive ? "narrative-phase-enter" : ""}`}
            style={{ borderLeft: isActive ? "3px solid #09BC8A" : "3px solid #2a2a2a", background: isActive ? "#111" : "transparent" }}
            onClick={() => onPhaseClick(i)}
          >
            <div className="narrative-header">
              <span className="narrative-phase-label">Phase {phase.number || i + 1}</span>
              <span className="narrative-phase-name">{phase.name}</span>
              <span className={`narrative-severity ${getThreatBadgeClass(phase.threat_level)}`}>
                {phase.threat_level}
              </span>
            </div>
            {phase.key_vulnerability && (
              <div className="key-vulnerability">{phase.key_vulnerability}</div>
            )}
            <div className="narrative-body">
              {sourceLinks.length > 0 ? (
                <SourceLinkedNarrative
                  text={phase.narrative}
                  sourceLinks={sourceLinks}
                  currentPhase={i}
                />
              ) : (
                <p>{highlightEntities(phase.narrative)}</p>
              )}
            </div>
            {phase.countermeasure && (
              <div className="narrative-countermeasure">
                <div className="countermeasure-label">Countermeasure</div>
                <div className="countermeasure-text">{phase.countermeasure}</div>
              </div>
            )}
          </div>
        );
      })}

      {/* Critical Vulnerabilities */}
      {assessment.critical_vulnerabilities?.length > 0 && (
        <div className="mt-8">
          <h2>Critical Vulnerabilities</h2>
          {assessment.critical_vulnerabilities.map((vuln, i) => (
            <div key={i} className="vuln-card">
              <div className="flex items-center gap-2 mb-2">
                <span className={`vuln-severity ${getVulnSeverityClass(vuln.severity)}`}>{vuln.severity}</span>
                <span className="text-[15px] font-semibold" style={{ color: "#f0f0f0" }}>{vuln.title}</span>
              </div>
              {vuln.data_exposed && (
                <div className="text-[13px] mb-1.5" style={{ color: "#999" }}>
                  <span style={{ color: "#666" }}>Data Exposed:</span> {vuln.data_exposed}
                </div>
              )}
              <div className="text-[14px] mb-3" style={{ color: "#ccc", lineHeight: 1.6 }}>{vuln.risk_mechanism}</div>
              {vuln.countermeasure && (
                <div className="narrative-countermeasure">
                  <div className="countermeasure-label">Countermeasure</div>
                  <div className="countermeasure-text">{vuln.countermeasure}</div>
                  <div className="flex gap-4 mt-2">
                    {vuln.countermeasure_cost && (
                      <span className="text-[11px] font-mono" style={{ color: "#666" }}>
                        Cost: <span style={{ color: "#999" }}>{vuln.countermeasure_cost}</span>
                      </span>
                    )}
                    {vuln.countermeasure_timeline && (
                      <span className="text-[11px] font-mono" style={{ color: "#666" }}>
                        Timeline: <span style={{ color: "#999" }}>{vuln.countermeasure_timeline}</span>
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Recommended Actions */}
      {assessment.recommended_actions && (
        <div className="mt-8">
          <h2>Recommended Actions</h2>
          {assessment.recommended_actions.immediate?.length > 0 && (
            <div className="action-group">
              <div className="action-group-title immediate">Immediate (24-48 hours)</div>
              <ul>
                {assessment.recommended_actions.immediate.map((action, i) => (
                  <li key={i}>{action}</li>
                ))}
              </ul>
            </div>
          )}
          {assessment.recommended_actions.short_term?.length > 0 && (
            <div className="action-group">
              <div className="action-group-title short-term">Short-term (1-4 weeks)</div>
              <ul>
                {assessment.recommended_actions.short_term.map((action, i) => (
                  <li key={i}>{action}</li>
                ))}
              </ul>
            </div>
          )}
          {assessment.recommended_actions.long_term?.length > 0 && (
            <div className="action-group">
              <div className="action-group-title long-term">Long-term (strategic)</div>
              <ul>
                {assessment.recommended_actions.long_term.map((action, i) => (
                  <li key={i}>{action}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Unused data note */}
      {assessment.unused_data_note && (
        <div className="probability-note mt-6">
          <span style={{ color: "#666", fontStyle: "normal", fontWeight: 500 }}>Note:</span> {assessment.unused_data_note}
        </div>
      )}
    </div>
  );
}

/* ── Legacy helpers for old-format rendering ── */
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
                  <div className="countermeasure-label">Countermeasure</div>
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
