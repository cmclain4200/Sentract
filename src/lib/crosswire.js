import { supabase } from './supabase';
import { fetchAllUserSubjects as _fetchAllUserSubjects, detectOverlaps } from '../engine/core/crosswire';

export async function fetchAllUserSubjects() {
  return _fetchAllUserSubjects(supabase);
}

export { detectOverlaps };
