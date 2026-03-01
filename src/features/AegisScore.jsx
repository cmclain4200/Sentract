import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useOutletContext } from "react-router-dom";
import { ChevronRight, ChevronDown, TrendingDown, TrendingUp, Save, Clock, Trash2, Minus, BarChart3 } from "lucide-react";
import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Tooltip, ResponsiveContainer, Legend, AreaChart, Area, XAxis, YAxis, CartesianGrid, ReferenceLine } from "recharts";
import ModuleWrapper from "../components/ModuleWrapper";
import { calculateCompleteness } from "../lib/profileCompleteness";
import { calculateAegisScore, buildRemediationOptions, simulateRemediation } from "../lib/aegisScore";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";
import { getBenchmarkData } from "../lib/enrichment/benchmarking";

export default function AegisScore() {
  const { subject, caseData } = useOutletContext();
  const { user } = useAuth();
  const profileData = subject?.profile_data || {};
  const completeness = calculateCompleteness(profileData);

  const baseScore = useMemo(() => calculateAegisScore(profileData), [profileData]);
  const remediationOptions = useMemo(() => buildRemediationOptions(profileData), [profileData]);

  const [activeRemediations, setActiveRemediations] = useState(() => remediationOptions.map((o) => ({ ...o })));
  const [showRemediation, setShowRemediation] = useState(false);
  const [expandedDriver, setExpandedDriver] = useState(null);
  const [savedScores, setSavedScores] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [saving, setSaving] = useState(false);
  const [benchmark, setBenchmark] = useState(null);
  const [showBenchmark, setShowBenchmark] = useState(false);
  const [showTrend, setShowTrend] = useState(false);

  // Fetch benchmark data
  useEffect(() => {
    if (!user?.id || baseScore.composite == null) return;
    getBenchmarkData(user.id, baseScore.composite).then(setBenchmark);
  }, [user?.id, baseScore.composite]);

  // Sync remediation options when profile changes
  useEffect(() => {
    setActiveRemediations(remediationOptions.map((o) => ({ ...o })));
  }, [remediationOptions]);

  // Fetch saved score history
  useEffect(() => {
    if (!subject?.id) return;
    supabase
      .from("assessments")
      .select("id, created_at, score_data")
      .eq("subject_id", subject.id)
      .eq("module", "aegis_score")
      .order("created_at", { ascending: false })
      .then(({ data }) => setSavedScores(data || []));
  }, [subject?.id]);

  // Trend delta from previous saved score
  const previousScore = savedScores.length > 0 ? savedScores[0]?.score_data?.composite : null;
  const trendDelta = previousScore != null ? baseScore.composite - previousScore : null;

  // Auto-save when score changes (debounced 3s)
  const autoSaveTimer = useRef(null);
  const autoSaveScore = useCallback(async () => {
    if (!subject?.id || !user?.id) return;
    const { data: saved } = await supabase
      .from("assessments")
      .insert({
        subject_id: subject.id,
        user_id: user.id,
        type: "aegis_score",
        module: "aegis_score",
        score_data: baseScore,
        data: {},
      })
      .select("id, created_at, score_data")
      .single();
    if (saved) setSavedScores((prev) => [saved, ...prev]);
  }, [subject?.id, user?.id, baseScore]);

  useEffect(() => {
    if (!subject?.id || !user?.id) return;
    // Only auto-save if there's history and current differs
    if (savedScores.length === 0) return;
    const lastComposite = savedScores[0]?.score_data?.composite;
    if (lastComposite === baseScore.composite) return;

    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => {
      autoSaveScore();
    }, 3000);

    return () => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    };
  }, [baseScore.composite, savedScores, subject?.id, user?.id, autoSaveScore]);

  const simulatedScore = useMemo(() => {
    const anyEnabled = activeRemediations.some((o) => o.enabled);
    if (!anyEnabled) return null;
    return simulateRemediation(baseScore, activeRemediations);
  }, [baseScore, activeRemediations]);

  const displayScore = simulatedScore || baseScore;
  const tier = getTier(displayScore.composite);
  const baseTier = getTier(baseScore.composite);
  const delta = simulatedScore ? baseScore.composite - simulatedScore.composite : 0;

  const circumference = 2 * Math.PI * 45;
  const progress = (displayScore.composite / 100) * circumference;

  function toggleRemediation(id) {
    setActiveRemediations((prev) =>
      prev.map((o) => (o.id === id ? { ...o, enabled: !o.enabled } : o))
    );
  }

  async function saveScore() {
    if (!subject?.id || !user?.id) return;
    setSaving(true);
    const { data: saved } = await supabase
      .from("assessments")
      .insert({
        subject_id: subject.id,
        user_id: user.id,
        type: "aegis_score",
        module: "aegis_score",
        score_data: baseScore,
        data: {},
      })
      .select("id, created_at, score_data")
      .single();

    if (saved) setSavedScores((prev) => [saved, ...prev]);
    setSaving(false);
  }

  async function deleteScore(id) {
    await supabase.from("assessments").delete().eq("id", id);
    setSavedScores((prev) => prev.filter((s) => s.id !== id));
  }

  return (
    <ModuleWrapper label="Risk Quantification" title="Aegis Score" profileData={profileData} minCompleteness={15} completeness={completeness.score}>
      <div className="flex-1 overflow-y-auto">
        <div className="flex gap-5 mb-6">
          {/* Left: Score + Radar Chart */}
          <div className="surface p-6 flex flex-col items-center" style={{ minWidth: 360 }}>
            {/* Compact score display */}
            <div className="flex items-center gap-4 mb-2 w-full">
              <div className="relative w-20 h-20 shrink-0">
                <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                  <circle cx="50" cy="50" r="45" fill="none" stroke="#1a1a1a" strokeWidth="6" />
                  <circle cx="50" cy="50" r="45" fill="none" stroke={tier.color} strokeWidth="6"
                    strokeDasharray={circumference} strokeDashoffset={circumference - progress}
                    strokeLinecap="round" style={{ transition: "stroke-dashoffset 0.6s ease, stroke 0.3s ease" }} />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-[24px] font-bold" style={{ color: tier.color, lineHeight: 1, transition: "color 0.3s ease" }}>
                    {displayScore.composite}
                  </span>
                </div>
              </div>
              <div className="flex flex-col">
                <span className="text-[13px] font-semibold tracking-wide" style={{ color: tier.color, transition: "color 0.3s ease" }}>
                  {displayScore.riskLevel}
                </span>
                {trendDelta != null && trendDelta !== 0 && (
                  <div className="flex items-center gap-1.5 mt-1">
                    {trendDelta > 0 ? (
                      <><TrendingUp size={11} color="#ef4444" /><span className="text-[11px] font-mono" style={{ color: "#ef4444" }}>+{trendDelta} from last</span></>
                    ) : (
                      <><TrendingDown size={11} color="#09BC8A" /><span className="text-[11px] font-mono" style={{ color: "#09BC8A" }}>{trendDelta} from last</span></>
                    )}
                  </div>
                )}
                {trendDelta != null && trendDelta === 0 && (
                  <div className="flex items-center gap-1.5 mt-1">
                    <Minus size={11} color="#555" />
                    <span className="text-[11px] font-mono" style={{ color: "#555" }}>No change</span>
                  </div>
                )}
                {delta > 0 && (
                  <div className="flex items-center gap-1.5 mt-1">
                    <TrendingDown size={11} color="#09BC8A" />
                    <span className="text-[11px]" style={{ color: "#09BC8A" }}>{delta} pts reduced</span>
                  </div>
                )}
              </div>
            </div>

            {/* Radar Chart */}
            <AegisRadarChart displayScore={displayScore} previousScore={savedScores[0]?.score_data || null} />

            <button
              onClick={saveScore}
              disabled={saving}
              className="mt-3 flex items-center gap-2 text-[11px] px-3 py-1.5 rounded cursor-pointer transition-all"
              style={{ background: "transparent", border: "1px solid #2a2a2a", color: "#888" }}
            >
              <Save size={11} />{saving ? "Saving..." : "Save Snapshot"}
            </button>
          </div>

          {/* Right: Factor Bars */}
          <div className="flex-1 surface p-6">
            <div className="section-label text-[10px] mb-5">Factor Scores</div>
            <div className="space-y-5">
              {Object.entries(displayScore.factors).map(([key, factor]) => {
                const fTier = getTier(factor.score);
                return (
                  <div key={key}>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-[13px]" style={{ color: "#999" }}>{factor.label}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px]" style={{ color: "#444" }}>{factor.weight}%</span>
                        <span className="text-[14px] font-semibold" style={{ color: fTier.color, transition: "color 0.3s ease" }}>
                          {factor.score}
                        </span>
                      </div>
                    </div>
                    <div className="h-2 rounded-full" style={{ background: "#1a1a1a" }}>
                      <div className="h-full rounded-full" style={{
                        width: `${factor.score}%`,
                        background: fTier.color,
                        transition: "width 0.6s ease, background 0.3s ease",
                      }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Score Drivers */}
        {baseScore.drivers.length > 0 && (
          <div className="surface p-6 mb-6">
            <div className="section-label text-[10px] mb-5">Score Drivers</div>
            <div className="space-y-2">
              {baseScore.drivers.map((d, i) => (
                <div key={i} className="rounded-md overflow-hidden" style={{ background: "#0d0d0d", border: "1px solid #1a1a1a" }}>
                  <button
                    className="w-full flex items-center gap-3 px-4 py-3.5 text-left transition-all duration-200 cursor-pointer"
                    style={{ background: expandedDriver === i ? "#151515" : "transparent", border: "none" }}
                    onClick={() => setExpandedDriver(expandedDriver === i ? null : i)}
                  >
                    {expandedDriver === i ? <ChevronDown size={13} color="#888" /> : <ChevronRight size={13} color="#555" />}
                    <span className="text-[14px] flex-1" style={{ color: "#e0e0e0" }}>{d.text}</span>
                    <span className="badge badge-warning" style={{ fontSize: 10 }}>impact: +{d.impact}</span>
                  </button>
                  {expandedDriver === i && (
                    <div className="px-4 pb-3.5 text-[13px] fade-in" style={{ color: "#777", borderTop: "1px solid #1a1a1a" }}>
                      <div className="pt-3">
                        Category: <span className="capitalize">{d.category}</span> · This data point contributes +{d.impact} points to the composite score.
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Simulate Remediation */}
        {activeRemediations.length > 0 && (
          <div className="surface p-6 mb-6" style={{ borderTop: "1px dashed #2a2a2a" }}>
            <button
              onClick={() => setShowRemediation(!showRemediation)}
              className="flex items-center gap-2 mb-1 cursor-pointer"
              style={{ background: "transparent", border: "none" }}
            >
              {showRemediation ? <ChevronDown size={13} color="#09BC8A" /> : <ChevronRight size={13} color="#09BC8A" />}
              <span className="section-label text-[10px]">Simulate Remediation</span>
            </button>

            {showRemediation && (
              <div className="mt-4 fade-in">
                <RemediationGroups
                  remediations={activeRemediations}
                  onToggle={toggleRemediation}
                />
                {delta > 0 && (
                  <div className="mt-4 pt-4 flex items-center gap-4" style={{ borderTop: "1px solid #1e1e1e" }}>
                    <span className="text-[14px]" style={{ color: "#888" }}>Projected score:</span>
                    <span className="text-[28px] font-bold" style={{ color: getTier(simulatedScore.composite).color }}>
                      {simulatedScore.composite}
                    </span>
                    <span className="text-[13px]" style={{ color: "#555" }}>(from {baseScore.composite})</span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Benchmark */}
        {benchmark && (
          <div className="surface p-6 mb-6">
            <button
              onClick={() => setShowBenchmark(!showBenchmark)}
              className="w-full flex items-center justify-between cursor-pointer"
              style={{ background: "transparent", border: "none" }}
            >
              <div className="flex items-center gap-2">
                <BarChart3 size={13} color="#09BC8A" />
                <span className="section-label text-[10px]">Benchmark</span>
              </div>
              <ChevronDown size={12} color="#555" style={{ transform: showBenchmark ? "rotate(180deg)" : "none", transition: "0.2s" }} />
            </button>
            {showBenchmark && (
              <div className="mt-4 fade-in">
                {benchmark.insufficient ? (
                  <div>
                    <div className="text-[13px]" style={{ color: "#888" }}>Assess 2+ subjects to see how this score compares.</div>
                    <div className="text-[11px] mt-1" style={{ color: "#555" }}>Currently: {benchmark.totalAssessments} assessment{benchmark.totalAssessments !== 1 ? "s" : ""} on file.</div>
                  </div>
                ) : (
                  <>
                    <div className="text-[16px] font-semibold text-white mb-4">
                      Higher exposure than {benchmark.percentile}% of assessed subjects
                    </div>
                    <div className="flex gap-1 mb-4" style={{ height: 48 }}>
                      {benchmark.buckets.map((bucket, i) => {
                        const maxCount = Math.max(...benchmark.buckets.map((b) => b.count), 1);
                        const height = (bucket.count / maxCount) * 100;
                        const isCurrent = i === benchmark.currentBucket;
                        return (
                          <div key={i} className="flex-1 flex flex-col items-center justify-end gap-1">
                            <div
                              className="w-full rounded-sm"
                              style={{
                                height: `${Math.max(height, 8)}%`,
                                background: isCurrent ? "#09BC8A" : "#1a1a1a",
                                transition: "height 0.3s ease",
                              }}
                            />
                            <span className="text-[9px] font-mono" style={{ color: isCurrent ? "#09BC8A" : "#555" }}>
                              {bucket.label}
                            </span>
                            <span className="text-[9px] font-mono" style={{ color: isCurrent ? "#09BC8A" : "#444" }}>
                              {isCurrent ? `[${bucket.count}]` : bucket.count}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                    <div className="text-[12px] font-mono" style={{ color: "#555" }}>
                      Avg: {benchmark.average} · Median: {benchmark.median} · Range: {benchmark.min}–{benchmark.max}
                    </div>
                    <div className="text-[11px] mt-1" style={{ color: "#444" }}>
                      Based on {benchmark.totalAssessments} assessments
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {/* Score Trend */}
        {savedScores.length >= 2 && (
          <div className="surface p-6 mb-6">
            <button
              onClick={() => setShowTrend(!showTrend)}
              className="w-full flex items-center justify-between cursor-pointer"
              style={{ background: "transparent", border: "none" }}
            >
              <div className="flex items-center gap-2">
                <TrendingUp size={13} color="#09BC8A" />
                <span className="section-label text-[10px]">Score Trend</span>
              </div>
              <ChevronDown size={12} color="#555" style={{ transform: showTrend ? "rotate(180deg)" : "none", transition: "0.2s" }} />
            </button>
            {showTrend && (
              <div className="mt-4 fade-in">
                <RiskTrendChart savedScores={savedScores} />
              </div>
            )}
          </div>
        )}

        {/* Score History */}
        {savedScores.length > 0 && (
          <div className="surface p-6">
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="w-full flex items-center justify-between cursor-pointer"
              style={{ background: "transparent", border: "none" }}
            >
              <span className="section-label text-[10px]">Score History ({savedScores.length})</span>
              <ChevronDown size={12} color="#555" style={{ transform: showHistory ? "rotate(180deg)" : "none", transition: "0.2s" }} />
            </button>
            {showHistory && (
              <div className="mt-4 space-y-2 fade-in">
                {savedScores.map((s) => {
                  const score = s.score_data?.composite ?? "—";
                  const level = s.score_data?.riskLevel ?? "";
                  const sTier = getTier(score);
                  return (
                    <div key={s.id} className="flex items-center gap-4 px-4 py-3 rounded" style={{ background: "#0d0d0d", border: "1px solid #1a1a1a" }}>
                      <Clock size={12} color="#555" />
                      <span className="text-[12px] font-mono" style={{ color: "#888" }}>
                        {new Date(s.created_at).toLocaleDateString()}
                      </span>
                      <span className="text-[16px] font-bold" style={{ color: sTier.color }}>{score}</span>
                      <span className="text-[11px]" style={{ color: sTier.color }}>{level}</span>
                      <div className="flex-1" />
                      <button
                        onClick={() => deleteScore(s.id)}
                        className="text-[10px] px-2 py-1 rounded cursor-pointer"
                        style={{ background: "transparent", border: "1px solid #333", color: "#555" }}
                      >
                        <Trash2 size={9} className="inline" style={{ verticalAlign: "-1px" }} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </ModuleWrapper>
  );
}

const RADAR_SHORT_LABELS = {
  digital_footprint: "Digital",
  breach_exposure: "Breach",
  behavioral_predictability: "Behavioral",
  physical_opsec: "Physical",
  network_exposure: "Network",
};

function AegisRadarChart({ displayScore, previousScore }) {
  const radarData = Object.entries(displayScore.factors).map(([key, factor]) => {
    const entry = {
      factor: RADAR_SHORT_LABELS[key] || factor.label,
      value: factor.score,
      fullMark: 100,
    };
    // Overlay previous score if available and different
    if (previousScore?.factors?.[key] != null) {
      const prevVal = previousScore.factors[key].score;
      if (prevVal !== factor.score) {
        entry.previous = prevVal;
      }
    }
    return entry;
  });

  const hasPrevious = radarData.some((d) => d.previous != null);

  return (
    <div style={{ width: 330, height: 280 }}>
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={radarData} outerRadius="75%">
          <PolarGrid stroke="rgba(255,255,255,0.06)" />
          <PolarAngleAxis
            dataKey="factor"
            tick={{ fill: "#888", fontSize: 11, fontFamily: "'JetBrains Mono', monospace" }}
          />
          <PolarRadiusAxis
            angle={90}
            domain={[0, 100]}
            tick={false}
            axisLine={false}
          />
          {hasPrevious && (
            <Radar
              name="Previous"
              dataKey="previous"
              stroke="rgba(255,255,255,0.2)"
              fill="rgba(255,255,255,0.05)"
              fillOpacity={1}
              strokeWidth={1}
              strokeDasharray="4 3"
              dot={false}
            />
          )}
          <Radar
            name="Current"
            dataKey="value"
            stroke="#00d4aa"
            fill="#00d4aa"
            fillOpacity={0.2}
            strokeWidth={2}
            dot={{
              r: 5,
              fill: "#00d4aa",
              stroke: "#0a0a0a",
              strokeWidth: 2,
            }}
            activeDot={{
              r: 7,
              fill: "#00d4aa",
              stroke: "#fff",
              strokeWidth: 2,
            }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "#0a0a0a",
              border: "1px solid #1e1e1e",
              borderRadius: "6px",
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: "12px",
              color: "#fff",
              padding: "8px 12px",
            }}
            formatter={(value, name) => [`${value} / 100`, name]}
          />
          {hasPrevious && (
            <Legend
              verticalAlign="bottom"
              iconType="line"
              wrapperStyle={{ fontSize: 11, fontFamily: "'JetBrains Mono', monospace", color: "#666", paddingTop: 4 }}
            />
          )}
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}

function RiskTrendChart({ savedScores }) {
  const data = [...savedScores].reverse().map((s) => ({
    date: new Date(s.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
    score: s.score_data?.composite ?? 0,
  }));

  return (
    <div style={{ width: "100%", height: 200 }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
          <defs>
            <linearGradient id="tealGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#09BC8A" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#09BC8A" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e1e1e" />
          <XAxis dataKey="date" tick={{ fill: "#555", fontSize: 11 }} stroke="#1e1e1e" />
          <YAxis domain={[0, 100]} tick={{ fill: "#555", fontSize: 11 }} stroke="#1e1e1e" />
          <Tooltip
            contentStyle={{
              backgroundColor: "#0a0a0a",
              border: "1px solid #1e1e1e",
              borderRadius: "6px",
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: "12px",
              color: "#fff",
              padding: "8px 12px",
            }}
            formatter={(value) => [`${value}`, "Score"]}
          />
          <ReferenceLine y={75} stroke="#ef4444" strokeDasharray="4 3" strokeOpacity={0.4} />
          <ReferenceLine y={55} stroke="#f59e0b" strokeDasharray="4 3" strokeOpacity={0.4} />
          <ReferenceLine y={35} stroke="#3b82f6" strokeDasharray="4 3" strokeOpacity={0.4} />
          <Area type="monotone" dataKey="score" stroke="#09BC8A" strokeWidth={2} fill="url(#tealGradient)" dot={{ r: 3, fill: "#09BC8A", stroke: "#0a0a0a", strokeWidth: 2 }} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

const CATEGORY_LABELS = {
  digital: 'Digital & Data Cleanup',
  behavioral: 'Behavioral Changes',
  physical: 'Physical Security',
  network: 'Network & Family',
};

const CATEGORY_ORDER = ['digital', 'behavioral', 'physical', 'network'];

function RemediationGroups({ remediations, onToggle }) {
  const grouped = {};
  remediations.forEach((r) => {
    const cat = r.category || 'digital';
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(r);
  });

  // Sort within each group by scoreReduction descending
  Object.values(grouped).forEach((arr) => arr.sort((a, b) => b.scoreReduction - a.scoreReduction));

  return (
    <div className="space-y-5">
      {CATEGORY_ORDER.filter((cat) => grouped[cat]?.length > 0).map((cat) => (
        <div key={cat}>
          <div
            className="text-[10px] font-semibold tracking-widest uppercase mb-2"
            style={{ color: "#555", letterSpacing: "0.08em" }}
          >
            {CATEGORY_LABELS[cat]}
          </div>
          <div className="space-y-1">
            {grouped[cat].map((r) => (
              <label
                key={r.id}
                className="flex items-start gap-4 px-4 py-3 rounded-md cursor-pointer transition-all duration-200"
                style={{ background: r.enabled ? "#1a1a1a" : "transparent" }}
              >
                <input
                  type="checkbox"
                  checked={r.enabled}
                  onChange={() => onToggle(r.id)}
                  className="accent-[#09BC8A] w-4 h-4 mt-0.5 shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <span className="text-[14px] block" style={{ color: "#e0e0e0" }}>{r.label}</span>
                  {r.description && (
                    <span className="text-[12px] block mt-0.5" style={{ color: "#555" }}>{r.description}</span>
                  )}
                </div>
                <span className="text-[13px] font-mono shrink-0" style={{ color: "#09BC8A" }}>
                  -{r.scoreReduction} pts
                </span>
              </label>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function getTier(score) {
  if (score >= 75) return { color: "#ef4444", label: "CRITICAL" };
  if (score >= 55) return { color: "#f59e0b", label: "HIGH" };
  if (score >= 35) return { color: "#3b82f6", label: "MODERATE" };
  return { color: "#09BC8A", label: "LOW" };
}
