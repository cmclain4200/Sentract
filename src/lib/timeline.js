import { supabase } from './supabase';

export async function logEvent({ subjectId, caseId, eventType, category, title, detail, metadata }) {
  // Fire-and-forget insert
  supabase
    .from('timeline_events')
    .insert({
      subject_id: subjectId,
      case_id: caseId,
      event_type: eventType,
      category: category || null,
      title,
      detail: detail || null,
      metadata: metadata || {},
    })
    .then(({ error }) => {
      if (error) console.error('Timeline log error:', error.message);
    });
}

export async function fetchTimeline(subjectId, { limit = 50, offset = 0, category } = {}) {
  let query = supabase
    .from('timeline_events')
    .select('*')
    .eq('subject_id', subjectId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (category) {
    query = query.eq('category', category);
  }

  const { data, error } = await query;
  if (error) {
    console.error('fetchTimeline error:', error.message);
    return [];
  }
  return data || [];
}

export async function fetchCaseTimeline(caseId, { limit = 100 } = {}) {
  const { data, error } = await supabase
    .from('timeline_events')
    .select('*, subjects(name)')
    .eq('case_id', caseId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('fetchCaseTimeline error:', error.message);
    return [];
  }
  return data || [];
}
