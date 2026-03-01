import { useState, useEffect, useMemo, useRef } from "react";
import { useOutletContext } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import { Activity, Clock, MapPin, CreditCard, MessageSquare, Zap, RefreshCw, Copy, Trash2, ChevronDown } from "lucide-react";
import ModuleWrapper from "../components/ModuleWrapper";
import { calculateCompleteness } from "../lib/profileCompleteness";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";
import { useOrg } from "../contexts/OrgContext";
import { useNotifications } from "../contexts/NotificationContext";
import AssessmentStatusBadge from "../components/AssessmentStatusBadge";
import AssessmentActions from "../components/AssessmentActions";
import AssessmentComments from "../components/AssessmentComments";
import { useEngine, buildHeatmapFromRoutines } from "../engine";

const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const hours = Array.from({ length: 24 }, (_, i) => i);

function getIntensityColor(intensity) {
  if (intensity === 0) return "#0d0d0d";
  if (intensity < 0.2) return "#0a1f1a";
  if (intensity < 0.4) return "#0d3329";
  if (intensity < 0.6) return "#0f4a39";
  if (intensity < 0.8) return "#00875e";
  return "#09BC8A";
}

function pickIcon(routine) {
  const name = (routine.name || "").toLowerCase();
  if (name.includes("run") || name.includes("gym") || name.includes("cycl") || name.includes("exercise") || name.includes("strava")) return Activity;
  if (name.includes("commute") || name.includes("drive") || name.includes("transit")) return MapPin;
  if (name.includes("pay") || name.includes("venmo") || name.includes("financial") || name.includes("transaction")) return CreditCard;
  if (name.includes("social") || name.includes("post") || name.includes("tweet") || name.includes("linkedin")) return MessageSquare;
  if (name.includes("travel") || name.includes("trip") || name.includes("flight")) return MapPin;
  return Clock;
}

function threatLevel(consistency) {
  if (consistency >= 0.8) return { label: "HIGH", color: "#ef4444" };
  if (consistency >= 0.6) return { label: "MEDIUM", color: "#f59e0b" };
  return { label: "LOW", color: "#09BC8A" };
}


export default function PatternLens() {
  const { subject, caseData } = useOutletContext();
  const { user } = useAuth();
  const { can, isRole } = useOrg();
  const { notify } = useNotifications();
  const engine = useEngine();
  const profileData = subject?.profile_data || {};
  const completeness = calculateCompleteness(profileData);
  const routines = profileData.behavioral?.routines || [];
  const travelPatterns = profileData.behavioral?.travel_patterns || [];
  const hasStructuredData = routines.length > 0;

  const [mode, setMode] = useState(hasStructuredData ? "structured" : "ai");
  const [hoveredCell, setHoveredCell] = useState(null);
  const [aiOutput, setAiOutput] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState(null);
  const [savedAnalyses, setSavedAnalyses] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const abortRef = useRef(null);

  // Abort streaming on unmount
  useEffect(() => {
    return () => { if (abortRef.current) abortRef.current.abort(); };
  }, []);

  const heatmapData = useMemo(() => buildHeatmapFromRoutines(routines), [routines]);

  // Fetch saved analyses
  useEffect(() => {
    if (!subject?.id) return;
    supabase
      .from("assessments")
      .select("id, created_at, narrative_output, status, reviewer_notes")
      .eq("subject_id", subject.id)
      .eq("module", "pattern_lens")
      .order("created_at", { ascending: false })
      .then(({ data }) => setSavedAnalyses(data || []));
  }, [subject?.id]);

  // Update mode when data changes
  useEffect(() => {
    setMode(routines.length > 0 ? "structured" : "ai");
  }, [routines.length]);

  async function generateAiAnalysis() {
    if (!engine.provider.hasKey) { setError("Anthropic API key not configured"); return; }

    setIsGenerating(true);
    setAiOutput("");
    setError(null);

    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const stream = engine.patternLens.stream({ profileData });

      for await (const delta of stream) {
        setAiOutput(stream.getText());
      }

      const accumulated = stream.getText();

      // Save analysis
      if (subject?.id && user?.id) {
        const { data: saved } = await supabase
          .from("assessments")
          .insert({
            subject_id: subject.id,
            user_id: user.id,
            type: "pattern_analysis",
            module: "pattern_lens",
            narrative_output: accumulated,
            model_used: "claude-sonnet-4-20250514",
            data: {},
            status: isRole("analyst") ? "draft" : "published",
          })
          .select("id, created_at, narrative_output, status, reviewer_notes")
          .single();

        if (saved) setSavedAnalyses((prev) => [saved, ...prev]);
      }

      notify({
        type: "pattern_lens",
        title: "Pattern Lens complete",
        message: "Behavioral analysis ready",
        link: caseData?.id ? `/case/${caseData.id}/patterns` : undefined,
      });
    } catch (err) {
      if (err.name === "AbortError") return;
      setError(err.message);
    } finally {
      setIsGenerating(false);
    }
  }

  function loadAnalysis(analysis) {
    setAiOutput(analysis.narrative_output || "");
    setMode("ai");
    setShowHistory(false);
  }

  async function deleteAnalysis(id) {
    await supabase.from("assessments").delete().eq("id", id);
    setSavedAnalyses((prev) => prev.filter((a) => a.id !== id));
  }

  return (
    <ModuleWrapper label="Temporal Analysis" title="Pattern Lens" profileData={profileData} minCompleteness={25} completeness={completeness.score}>
      <div className="flex-1 overflow-y-auto">
        {/* Mode Toggle */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => setMode("structured")}
            className="text-[12px] px-4 py-2 rounded cursor-pointer transition-all"
            style={{
              background: mode === "structured" ? "#1a1a1a" : "transparent",
              border: `1px solid ${mode === "structured" ? "#333" : "#1e1e1e"}`,
              color: mode === "structured" ? "#09BC8A" : "#666",
            }}
          >
            Structured View {routines.length > 0 && `(${routines.length})`}
          </button>
          <button
            onClick={() => setMode("ai")}
            className="text-[12px] px-4 py-2 rounded cursor-pointer transition-all"
            style={{
              background: mode === "ai" ? "#1a1a1a" : "transparent",
              border: `1px solid ${mode === "ai" ? "#333" : "#1e1e1e"}`,
              color: mode === "ai" ? "#09BC8A" : "#666",
            }}
          >
            AI Analysis
          </button>
        </div>

        {mode === "structured" ? (
          <>
            {/* Heatmap */}
            {routines.length > 0 && (
              <div className="surface p-6 mb-6">
                <div className="section-label text-[10px] mb-5">Weekly Activity Heatmap</div>
                <div className="flex gap-1">
                  <div className="flex flex-col gap-[2px] pt-6">
                    {hours.map((h) => (
                      <div key={h} className="h-[16px] flex items-center justify-end pr-2.5">
                        <span className="text-[9px] font-mono" style={{ color: "#444" }}>{h.toString().padStart(2, "0")}</span>
                      </div>
                    ))}
                  </div>
                  {days.map((day) => (
                    <div key={day} className="flex-1 flex flex-col gap-[2px]">
                      <div className="text-center text-[10px] font-medium mb-1.5" style={{ color: "#666" }}>{day}</div>
                      {hours.map((h) => {
                        const cell = heatmapData[day]?.[h] || { intensity: 0, activities: [] };
                        const isHovered = hoveredCell?.day === day && hoveredCell?.hour === h;
                        return (
                          <div key={h} className="heatmap-cell relative" style={{ height: 16, background: getIntensityColor(cell.intensity), borderRadius: 2 }}
                            onMouseEnter={() => setHoveredCell({ day, hour: h, ...cell })} onMouseLeave={() => setHoveredCell(null)}>
                            {isHovered && cell.intensity > 0 && (
                              <div className="absolute z-20 left-1/2 -translate-x-1/2 bottom-full mb-2 px-3 py-2 rounded-md whitespace-nowrap"
                                style={{ background: "#1a1a1a", border: "1px solid #333", fontSize: 12, color: "#e0e0e0" }}>
                                <span style={{ color: "#09BC8A" }}>{day} {h}:00</span> — {cell.activities.join(", ")}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-2 mt-4 justify-end">
                  <span className="text-[9px]" style={{ color: "#555" }}>Low</span>
                  {[0.1, 0.3, 0.5, 0.7, 0.9].map((v) => <div key={v} className="w-4 h-3 rounded-sm" style={{ background: getIntensityColor(v) }} />)}
                  <span className="text-[9px]" style={{ color: "#555" }}>High</span>
                </div>
              </div>
            )}

            {/* Routine Cards */}
            {routines.length > 0 ? (
              <>
                <div className="section-label text-[10px] mb-5">Extracted Routines ({routines.length})</div>
                <div className="space-y-4 mb-6">
                  {routines.map((r, i) => {
                    const Icon = pickIcon(r);
                    const threat = threatLevel(r.consistency || 0);
                    return (
                      <div key={i} className="surface p-5" style={{ borderLeft: `3px solid ${threat.color}` }}>
                        <div className="flex items-center gap-3 mb-3">
                          <Icon size={16} color={threat.color} />
                          <span className="text-[16px] font-semibold text-white flex-1">{r.name || "Unnamed Routine"}</span>
                          <span className="badge" style={{ color: threat.color, background: `${threat.color}15`, border: `1px solid ${threat.color}30` }}>
                            PREDICTABILITY: {threat.label}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-[13px] mb-3">
                          {r.schedule && (
                            <div><span style={{ color: "#555" }}>Schedule: </span><span style={{ color: "#e0e0e0" }}>{r.schedule}</span></div>
                          )}
                          {r.description && (
                            <div><span style={{ color: "#555" }}>Details: </span><span style={{ color: "#e0e0e0" }}>{r.description}</span></div>
                          )}
                          {r.data_source && (
                            <div><span style={{ color: "#555" }}>Data Source: </span><span style={{ color: "#e0e0e0" }}>{r.data_source}</span></div>
                          )}
                          {r.consistency != null && (
                            <div className="flex items-center gap-3">
                              <span style={{ color: "#555" }}>Consistency: </span>
                              <span className="text-[13px] font-semibold" style={{ color: "#e0e0e0" }}>{Math.round(r.consistency * 100)}%</span>
                              <div className="flex-1 h-1.5 rounded-full max-w-[140px]" style={{ background: "#1a1a1a" }}>
                                <div className="h-full rounded-full" style={{ width: `${r.consistency * 100}%`, background: threat.color, transition: "width 0.3s" }} />
                              </div>
                            </div>
                          )}
                        </div>
                        {r.notes && (
                          <div className="text-[12px] flex items-start gap-1.5 pt-2" style={{ borderTop: "1px solid #1a1a1a" }}>
                            <span className="font-semibold" style={{ color: "#f59e0b" }}>NOTE:</span>
                            <span style={{ color: "#888" }}>{r.notes}</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <div className="surface p-8 text-center">
                <Activity size={32} className="mx-auto mb-3" style={{ color: "#333" }} />
                <p className="text-[14px] mb-2" style={{ color: "#888" }}>No structured behavioral routines entered yet.</p>
                <p className="text-[12px]" style={{ color: "#555" }}>Add routines in the Profile Builder under the Behavioral tab, or use AI Analysis mode.</p>
              </div>
            )}

            {/* Travel Patterns */}
            {travelPatterns.length > 0 && (
              <>
                <div className="section-label text-[10px] mb-5 mt-6">Travel Patterns</div>
                <div className="space-y-3 mb-6">
                  {travelPatterns.map((tp, i) => (
                    <div key={i} className="surface p-4 flex items-start gap-3" style={{ borderLeft: "3px solid #3b82f6" }}>
                      <MapPin size={14} color="#3b82f6" className="mt-0.5 shrink-0" />
                      <div>
                        <span className="text-[14px] text-white">{tp.pattern}</span>
                        {tp.frequency && <span className="text-[12px] ml-3" style={{ color: "#666" }}>Frequency: {tp.frequency}</span>}
                        {tp.data_source && (
                          <div className="text-[11px] mt-1" style={{ color: "#555" }}>Source: {tp.data_source}</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        ) : (
          /* AI Analysis Mode */
          <div className="flex flex-col gap-5">
            <div className="flex items-center gap-3">
              {can("run_assessment") && (
                <button
                  onClick={generateAiAnalysis}
                  disabled={isGenerating}
                  className="px-5 py-2.5 text-[13px] font-semibold tracking-wide rounded-md flex items-center gap-2.5 transition-all duration-200 cursor-pointer"
                  style={{
                    background: isGenerating ? "#0d0d0d" : "#09BC8A",
                    color: isGenerating ? "#09BC8A" : "#000",
                    border: isGenerating ? "1px solid rgba(9, 188, 138,0.2)" : "1px solid #09BC8A",
                  }}
                >
                  {isGenerating ? (
                  <><span className="pulse-dot" /><span className="pulse-dot" /><span className="pulse-dot" /><span className="ml-1">Analyzing...</span></>
                ) : (
                    <><Zap size={14} />Generate AI Pattern Analysis</>
                  )}
                </button>
              )}
              {aiOutput && !isGenerating && (
                <button
                  onClick={() => navigator.clipboard.writeText(aiOutput)}
                  className="text-[11px] px-2.5 py-1.5 rounded-md flex items-center gap-1.5 cursor-pointer"
                  style={{ color: "#888", background: "transparent", border: "1px solid #2a2a2a" }}
                >
                  <Copy size={11} />Copy
                </button>
              )}
            </div>

            {error && (
              <div className="surface p-5" style={{ borderLeft: "3px solid #ef4444" }}>
                <div className="text-[14px] font-semibold mb-1" style={{ color: "#ef4444" }}>Generation Failed</div>
                <div className="text-[13px]" style={{ color: "#999" }}>{error}</div>
              </div>
            )}

            {aiOutput ? (
              <div className={`surface p-6 ${isGenerating ? "border-pulse" : ""}`}>
                <div className="markdown-content fade-in">
                  <ReactMarkdown>{aiOutput}</ReactMarkdown>
                </div>
              </div>
            ) : !isGenerating && (
              <div className="surface p-8 text-center">
                <Zap size={32} className="mx-auto mb-3" style={{ color: "#333" }} />
                <p className="text-[14px] mb-2" style={{ color: "#888" }}>
                  AI will analyze all available profile data to identify behavioral patterns
                </p>
                <p className="text-[12px]" style={{ color: "#555" }}>
                  Works even without structured routine data — analyzes social media schedules, breach timing, transaction patterns, and more
                </p>
              </div>
            )}
          </div>
        )}

        {/* Analysis History */}
        {savedAnalyses.length > 0 && (
          <div className="surface p-5 mt-6">
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="w-full flex items-center justify-between cursor-pointer"
              style={{ background: "transparent", border: "none" }}
            >
              <span className="sub-label">Previous Analyses ({savedAnalyses.length})</span>
              <ChevronDown size={12} color="#555" style={{ transform: showHistory ? "rotate(180deg)" : "none", transition: "0.2s" }} />
            </button>
            {showHistory && (
              <div className="mt-3 space-y-2 fade-in">
                {savedAnalyses.map((a) => (
                  <div key={a.id} className="p-3 rounded" style={{ background: "#0d0d0d", border: "1px solid #1a1a1a" }}>
                    <div className="flex items-center gap-2 mb-1">
                      <Clock size={10} color="#555" />
                      <span className="text-[11px] font-mono" style={{ color: "#888" }}>
                        {new Date(a.created_at).toLocaleDateString()}
                      </span>
                      <AssessmentStatusBadge status={a.status} />
                    </div>
                    <div className="text-[11px]" style={{ color: "#666" }}>
                      {(a.narrative_output || "").slice(0, 80)}...
                    </div>
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <button onClick={() => loadAnalysis(a)} className="text-[10px] px-2 py-1 rounded cursor-pointer"
                        style={{ background: "transparent", border: "1px solid #333", color: "#09BC8A" }}>View</button>
                      <AssessmentActions
                        assessment={a}
                        onUpdate={(updated) => setSavedAnalyses((prev) => prev.map((x) => x.id === updated.id ? { ...x, ...updated } : x))}
                        onDelete={(id) => setSavedAnalyses((prev) => prev.filter((x) => x.id !== id))}
                      />
                    </div>
                    <AssessmentComments assessmentId={a.id} />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </ModuleWrapper>
  );
}
