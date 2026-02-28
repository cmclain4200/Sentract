import { supabase } from './supabase';

/**
 * Fuzzy name matching for associate/subject linking.
 * Returns true if names likely refer to the same person.
 */
export function nameMatch(name1, name2) {
  if (!name1 || !name2) return false;

  const a = name1.trim().toLowerCase();
  const b = name2.trim().toLowerCase();

  // Exact match
  if (a === b) return true;

  // Contains match (min 4 chars to avoid false positives like "Al" matching "Alice")
  if (a.length >= 4 && b.includes(a)) return true;
  if (b.length >= 4 && a.includes(b)) return true;

  // Last name + first 3 chars of first name (handles Chris/Christopher, Nick/Nicholas)
  const partsA = a.split(/\s+/);
  const partsB = b.split(/\s+/);
  if (partsA.length >= 2 && partsB.length >= 2) {
    const lastA = partsA[partsA.length - 1];
    const lastB = partsB[partsB.length - 1];
    const firstA = partsA[0].slice(0, 3);
    const firstB = partsB[0].slice(0, 3);
    if (lastA === lastB && firstA.length >= 3 && firstB.length >= 3 && firstA === firstB) {
      return true;
    }
  }

  return false;
}

/**
 * Maps a relationship to its reverse.
 */
export function reverseRelationship(rel) {
  if (!rel) return 'associate';
  const lower = rel.toLowerCase();
  if (lower === 'boss' || lower === 'manager' || lower === 'supervisor') return 'direct report';
  if (lower === 'direct report' || lower === 'report' || lower === 'subordinate') return 'manager';
  if (lower === 'spouse' || lower === 'partner') return rel;
  if (lower === 'mentor') return 'mentee';
  if (lower === 'mentee') return 'mentee';
  if (lower === 'client') return 'service provider';
  if (lower === 'service provider') return 'client';
  return 'associate';
}

/**
 * Syncs bidirectional relationships between the current subject and all other subjects.
 *
 * Checks:
 * 1. Is current subject listed as associate on other? → Push current's professional info into that entry
 * 2. Is other subject listed as associate on current? → Push other's professional info into that entry
 * 3. Match in other but not current → Auto-add reverse association to current
 * 4. Match in current but not other → Auto-add reverse association to other
 * Bonus: Populate empty professional fields on current from matching associate entries
 *
 * @param {Object} currentSubject - The subject that was just saved (with profile_data)
 * @param {string} userId - The current user's ID (for RLS scoping)
 * @returns {{ updated: boolean, details: string }}
 */
export async function syncRelationships(currentSubject, userId) {
  try {
    const { data: allOthers, error } = await supabase
      .from('subjects')
      .select('id, case_id, name, profile_data')
      .neq('id', currentSubject.id);

    if (error || !allOthers) {
      return { updated: false, details: '' };
    }

    const currentData = currentSubject.profile_data || {};
    const currentAssociates = currentData.network?.associates || [];
    const currentName = currentData.identity?.full_name || currentSubject.name || '';
    const currentProfessional = currentData.professional || {};

    const updates = []; // { subjectId, newProfileData }
    let currentModified = false;
    let currentProfileData = JSON.parse(JSON.stringify(currentData));
    let syncedCount = 0;

    for (const other of allOthers) {
      const otherData = other.profile_data || {};
      const otherAssociates = otherData.network?.associates || [];
      const otherName = otherData.identity?.full_name || other.name || '';
      const otherProfessional = otherData.professional || {};

      let otherModified = false;
      let otherProfileData = JSON.parse(JSON.stringify(otherData));

      // Check 1: Is current subject listed as associate on other?
      const currentInOtherIdx = otherAssociates.findIndex(a => nameMatch(a.name, currentName));
      if (currentInOtherIdx >= 0) {
        const entry = otherProfileData.network.associates[currentInOtherIdx];
        let entryChanged = false;

        // Push current's professional info into that entry
        if (currentProfessional.title && !entry.title) {
          entry.title = currentProfessional.title;
          entryChanged = true;
        }
        if (currentProfessional.organization && !entry.organization) {
          entry.organization = currentProfessional.organization;
          entryChanged = true;
        }

        if (entryChanged) {
          entry.source = entry.source || 'auto-synced from linked subject';
          entry.synced_from_subject_id = currentSubject.id;
          otherModified = true;
        }
      }

      // Check 2: Is other subject listed as associate on current?
      const currentAssocs = currentProfileData.network?.associates || [];
      const otherInCurrentIdx = currentAssocs.findIndex(a => nameMatch(a.name, otherName));
      if (otherInCurrentIdx >= 0) {
        const entry = currentAssocs[otherInCurrentIdx];
        let entryChanged = false;

        // Push other's professional info into that entry
        if (otherProfessional.title && !entry.title) {
          entry.title = otherProfessional.title;
          entryChanged = true;
        }
        if (otherProfessional.organization && !entry.organization) {
          entry.organization = otherProfessional.organization;
          entryChanged = true;
        }

        if (entryChanged) {
          entry.source = entry.source || 'auto-synced from linked subject';
          entry.synced_from_subject_id = other.id;
          currentModified = true;
        }
      }

      // Check 3: Match in other (current is listed as associate on other) but not in current
      // → Auto-add reverse association to current
      if (currentInOtherIdx >= 0 && otherInCurrentIdx < 0) {
        const otherEntry = otherAssociates[currentInOtherIdx];
        if (!currentProfileData.network) currentProfileData.network = {};
        if (!currentProfileData.network.associates) currentProfileData.network.associates = [];
        currentProfileData.network.associates.push({
          name: otherName,
          relationship: reverseRelationship(otherEntry.relationship),
          shared_data_points: [],
          notes: '',
          source: 'auto-synced from linked subject',
          synced_from_subject_id: other.id,
          ...(otherProfessional.title ? { title: otherProfessional.title } : {}),
          ...(otherProfessional.organization ? { organization: otherProfessional.organization } : {}),
        });
        currentModified = true;
        syncedCount++;
      }

      // Check 4: Match in current (other is listed as associate on current) but not in other
      // → Auto-add reverse association to other
      if (otherInCurrentIdx >= 0 && currentInOtherIdx < 0) {
        const currentEntry = currentAssocs[otherInCurrentIdx];
        if (!otherProfileData.network) otherProfileData.network = {};
        if (!otherProfileData.network.associates) otherProfileData.network.associates = [];
        otherProfileData.network.associates.push({
          name: currentName,
          relationship: reverseRelationship(currentEntry.relationship),
          shared_data_points: [],
          notes: '',
          source: 'auto-synced from linked subject',
          synced_from_subject_id: currentSubject.id,
          ...(currentProfessional.title ? { title: currentProfessional.title } : {}),
          ...(currentProfessional.organization ? { organization: currentProfessional.organization } : {}),
        });
        otherModified = true;
        syncedCount++;
      }

      // Bonus: Populate empty professional fields on current from matching associate entries on other
      if (currentInOtherIdx >= 0) {
        const entry = otherAssociates[currentInOtherIdx];
        if (entry.title && !currentProfileData.professional?.title) {
          if (!currentProfileData.professional) currentProfileData.professional = {};
          currentProfileData.professional.title = entry.title;
          currentModified = true;
        }
        if (entry.organization && !currentProfileData.professional?.organization) {
          if (!currentProfileData.professional) currentProfileData.professional = {};
          currentProfileData.professional.organization = entry.organization;
          currentModified = true;
        }
      }

      if (otherModified) {
        updates.push({
          subjectId: other.id,
          newProfileData: otherProfileData,
        });
      }
    }

    // Batch all updates
    const promises = updates.map(({ subjectId, newProfileData }) =>
      supabase
        .from('subjects')
        .update({ profile_data: newProfileData })
        .eq('id', subjectId)
    );

    if (currentModified) {
      promises.push(
        supabase
          .from('subjects')
          .update({ profile_data: currentProfileData })
          .eq('id', currentSubject.id)
      );
    }

    if (promises.length > 0) {
      await Promise.all(promises);
    }

    const totalUpdated = updates.length + (currentModified ? 1 : 0);
    if (totalUpdated === 0) {
      return { updated: false, details: '' };
    }

    const parts = [];
    if (syncedCount > 0) parts.push(`${syncedCount} relationship${syncedCount > 1 ? 's' : ''} linked`);
    if (updates.length > 0) parts.push(`${updates.length} subject${updates.length > 1 ? 's' : ''} updated`);
    return {
      updated: true,
      details: parts.join(', ') || 'Relationships synced',
    };
  } catch (err) {
    console.error('Relationship sync error:', err);
    return { updated: false, details: '' };
  }
}
