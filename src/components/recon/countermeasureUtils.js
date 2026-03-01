/**
 * Extract countermeasure options from a Recon Mirror assessment.
 */
export function extractCountermeasures(assessment, sourceLinks = []) {
  const countermeasures = [];

  // Extract from assessment phases
  if (assessment?.phases) {
    assessment.phases.forEach((phase, i) => {
      const cmText = phase.countermeasure || '';
      if (cmText) {
        countermeasures.push({
          id: `cm-phase-${i}`,
          phaseIndex: i,
          label: summarizeCountermeasure(cmText),
          fullText: cmText,
          category: categorizeCountermeasure(cmText),
          enabled: false,
        });
      }
    });
  }

  // Extract from critical vulnerabilities
  if (assessment?.critical_vulnerabilities) {
    assessment.critical_vulnerabilities.forEach((vuln, i) => {
      if (vuln.countermeasure) {
        const exists = countermeasures.some(c => c.fullText === vuln.countermeasure);
        if (!exists) {
          countermeasures.push({
            id: `cm-vuln-${i}`,
            phaseIndex: null,
            label: summarizeCountermeasure(vuln.countermeasure),
            fullText: vuln.countermeasure,
            category: categorizeCountermeasure(vuln.countermeasure),
            enabled: false,
          });
        }
      }
    });
  }

  // Augment from source links data exposure
  const seenCategories = new Set(countermeasures.map(c => c.category));

  const brokerLinks = sourceLinks.filter(l => l.profileSection === 'digital' && l.profileField === 'data_broker_listings');
  if (brokerLinks.length > 0 && !seenCategories.has('data_broker_removal')) {
    countermeasures.push({
      id: 'cm-brokers',
      phaseIndex: null,
      label: 'Remove data broker listings',
      fullText: `Remove subject from ${brokerLinks.length} identified data broker platforms to eliminate commercial data access.`,
      category: 'data_broker_removal',
      enabled: false,
    });
  }

  const socialLinks = sourceLinks.filter(l => l.profileSection === 'digital' && l.profileField === 'social_accounts');
  if (socialLinks.length > 0 && !seenCategories.has('social_hardening')) {
    countermeasures.push({
      id: 'cm-social',
      phaseIndex: null,
      label: 'Harden social media privacy',
      fullText: 'Set all social media accounts to private, remove location data, and audit connected applications.',
      category: 'social_hardening',
      enabled: false,
    });
  }

  const behavioralLinks = sourceLinks.filter(l => l.profileSection === 'behavioral');
  if (behavioralLinks.length > 0 && !seenCategories.has('routine_variation')) {
    countermeasures.push({
      id: 'cm-routine',
      phaseIndex: null,
      label: 'Introduce routine variation',
      fullText: 'Vary daily schedules, commute routes, and exercise patterns to reduce predictability.',
      category: 'routine_variation',
      enabled: false,
    });
  }

  return countermeasures;
}

function summarizeCountermeasure(text) {
  const firstSentence = text.split(/[.!?]/)[0];
  return firstSentence.length > 60 ? firstSentence.slice(0, 57) + '...' : firstSentence;
}

function categorizeCountermeasure(text) {
  const lower = text.toLowerCase();
  if (lower.includes('broker') || lower.includes('data removal')) return 'data_broker_removal';
  if (lower.includes('social') || lower.includes('privacy') || lower.includes('private')) return 'social_hardening';
  if (lower.includes('routine') || lower.includes('vary') || lower.includes('schedule')) return 'routine_variation';
  if (lower.includes('surveillance') || lower.includes('counter-surveillance') || lower.includes('security system')) return 'physical_security';
  if (lower.includes('password') || lower.includes('credential') || lower.includes('2fa') || lower.includes('mfa')) return 'credential_hardening';
  return 'general';
}
