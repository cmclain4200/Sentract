import { profileToPromptText } from '../core/profileToPrompt';
import { parseReconMirrorOutput } from './reconMirror';

const SIMULATION_SYSTEM_PROMPT = `You are Sentract's adversarial threat assessment engine performing a countermeasure simulation.

You were previously given a subject profile and generated an adversarial assessment. The client has now activated protective countermeasures. Your job is to regenerate the assessment showing how the adversary would be FORCED TO ADAPT to these protections.

Rules:
- Show how each countermeasure degrades the adversary's capabilities
- The adversary doesn't give up — they find workarounds, but the workarounds are harder, slower, riskier, and more expensive
- Clearly indicate which phases become significantly harder or are blocked entirely
- Maintain the same phase structure as the original, but with adapted content
- For each phase, start the narrative with a brief "[COUNTERMEASURE IMPACT]" line showing what changed
- Keep all defensive framing rules from the original assessment
- Return the assessment as a JSON object in the same format as the original (with executive_summary, phases, critical_vulnerabilities, recommended_actions, source_links)
- The scenario JSON should reflect adapted coordinates/timelines where countermeasures force changes
- Return ONLY the JSON object. No markdown wrapping, no preamble.`;

export async function simulateCountermeasures(provider, {
  originalAssessment,
  activeCountermeasures,
  profileData,
  params,
}) {
  const profileText = profileToPromptText(profileData);

  const countermeasureList = activeCountermeasures
    .map((cm, i) => `${i + 1}. ${cm.label}: ${cm.fullText}`)
    .join('\n');

  const originalPhases = JSON.stringify(originalAssessment?.phases || [], null, 2);

  const userMessage = `ORIGINAL ASSESSMENT PARAMETERS:
Adversary Type: ${params.adversaryType}
Objective: ${params.objective}
Sophistication: ${params.sophistication}

ORIGINAL EXECUTIVE SUMMARY:
${originalAssessment?.executive_summary || ''}

ORIGINAL SCENARIO PHASES:
${originalPhases}

COUNTERMEASURES NOW ACTIVE:
${countermeasureList}

SUBJECT PROFILE (for reference):
${profileText}

Regenerate the adversarial assessment showing how the scenario adapts with these countermeasures in place. Show the adversary's forced adaptations, increased costs, and reduced effectiveness. Return ONLY a valid JSON object.`;

  const { text } = await provider.complete({
    system: SIMULATION_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userMessage }],
    maxTokens: 12000,
  });

  return parseReconMirrorOutput(text);
}
