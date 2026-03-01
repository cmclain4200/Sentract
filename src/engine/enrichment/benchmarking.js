import { supabase } from '../../lib/supabase';

export async function getBenchmarkData(userId, currentScore) {
  const { data: assessments, error } = await supabase
    .from('assessments')
    .select('score_data')
    .eq('user_id', userId)
    .eq('module', 'aegis_score')
    .order('created_at', { ascending: false });

  if (error || !assessments || assessments.length === 0) {
    return null;
  }

  const uniqueScores = [];
  assessments.forEach((a) => {
    const score = a.score_data?.composite;
    if (score !== undefined && score !== null) {
      uniqueScores.push(score);
    }
  });

  if (uniqueScores.length < 2) {
    return { insufficient: true, totalAssessments: uniqueScores.length };
  }

  // Percentile rank
  const belowCount = uniqueScores.filter((s) => s < currentScore).length;
  const percentile = Math.round((belowCount / uniqueScores.length) * 100);

  // Distribution stats
  const sorted = [...uniqueScores].sort((a, b) => a - b);
  const average = Math.round(uniqueScores.reduce((a, b) => a + b, 0) / uniqueScores.length);
  const median = sorted[Math.floor(sorted.length / 2)];
  const min = sorted[0];
  const max = sorted[sorted.length - 1];

  // Histogram buckets
  const buckets = [
    { label: '0-25', range: [0, 25], count: 0 },
    { label: '26-50', range: [26, 50], count: 0 },
    { label: '51-75', range: [51, 75], count: 0 },
    { label: '76-100', range: [76, 100], count: 0 },
  ];
  uniqueScores.forEach((s) => {
    const bucket = buckets.find((b) => s >= b.range[0] && s <= b.range[1]);
    if (bucket) bucket.count++;
  });

  const currentBucket = buckets.findIndex(
    (b) => currentScore >= b.range[0] && currentScore <= b.range[1]
  );

  return {
    percentile,
    totalAssessments: uniqueScores.length,
    average,
    median,
    min,
    max,
    buckets,
    currentBucket,
    insufficient: false,
  };
}
