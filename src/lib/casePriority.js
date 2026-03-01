export const PRIORITY_COLORS = {
  critical: "#ef4444",
  high: "#f59e0b",
  routine: "#3b82f6",
  low: "#09BC8A",
};

const TYPE_WEIGHT = { EP: 15, CT: 10, CI: 5 };

export function calculateCasePriority(caseData, subjects, aegisScores) {
  let score = 0;
  const reasons = [];

  // Factor 1: Max Aegis composite across subjects (0-35 pts)
  let maxAegis = 0;
  for (const s of subjects || []) {
    const a = aegisScores?.[s.id];
    if (a != null && a > maxAegis) maxAegis = a;
  }
  if (maxAegis >= 75) { score += 35; reasons.push("Critical Aegis score"); }
  else if (maxAegis >= 55) { score += 25; reasons.push("High Aegis score"); }
  else if (maxAegis >= 35) { score += 15; reasons.push("Moderate Aegis score"); }
  else if (maxAegis > 0) { score += 5; }

  // Factor 2: Total breach count (0-20 pts)
  let totalBreaches = 0;
  for (const s of subjects || []) {
    totalBreaches += (s.profile_data?.breaches?.records || []).length;
  }
  if (totalBreaches >= 10) { score += 20; reasons.push(`${totalBreaches} breach records`); }
  else if (totalBreaches >= 5) { score += 12; reasons.push(`${totalBreaches} breach records`); }
  else if (totalBreaches > 0) { score += 5; }

  // Factor 3: Profile staleness (0-15 pts)
  let maxStaleDays = 0;
  for (const s of subjects || []) {
    if (s.updated_at) {
      const days = Math.floor((Date.now() - new Date(s.updated_at).getTime()) / (1000 * 60 * 60 * 24));
      if (days > maxStaleDays) maxStaleDays = days;
    }
  }
  if (maxStaleDays > 90) { score += 15; reasons.push("Stale profile data"); }
  else if (maxStaleDays > 30) { score += 8; }

  // Factor 4: Low completeness + high score = concerning (0-15 pts)
  for (const s of subjects || []) {
    const comp = s.data_completeness || 0;
    const aegis = aegisScores?.[s.id] || 0;
    if (comp < 40 && aegis >= 55) {
      score += 15;
      reasons.push("High risk with incomplete profile");
      break;
    }
  }

  // Factor 5: Case type weight (0-15 pts)
  const typeWeight = TYPE_WEIGHT[caseData?.type] || 5;
  score += typeWeight;
  if (typeWeight >= 15) reasons.push("EP case type");

  // Clamp to 100
  score = Math.min(score, 100);

  let priority;
  if (score >= 75) priority = "critical";
  else if (score >= 55) priority = "high";
  else if (score >= 30) priority = "routine";
  else priority = "low";

  return { priority, score, reasons };
}
