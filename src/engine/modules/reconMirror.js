import { buildReconMirrorPrompt } from '../prompts/reconMirror';
import { profileToPromptText } from '../core/profileToPrompt';

// Old format delimiter — kept for backward compat parsing
const DELIMITER = "---SCENARIO_JSON---";

export function streamReconMirror(provider, { profileData, adversaryType, objective, sophisticationLabel, geoSection }) {
  const profileText = profileToPromptText(profileData);
  const { system, messages, maxTokens } = buildReconMirrorPrompt({
    profileText,
    adversaryType,
    objective,
    sophisticationLabel,
    geoSection,
  });

  const stream = provider.stream({ system, messages, maxTokens });

  return {
    [Symbol.asyncIterator]: () => stream[Symbol.asyncIterator](),
    getText: () => stream.getText(),
    getResult: () => parseReconMirrorOutput(stream.getText()),
  };
}

export function parseReconMirrorOutput(text) {
  const accumulated = text;

  // Try new format: entire response is JSON
  const cleaned = accumulated.trim().replace(/^```json\n?/g, "").replace(/```\n?$/g, "").trim();
  try {
    const parsed = JSON.parse(cleaned);
    if (parsed?.executive_summary) {
      return {
        assessment: parsed,
        narrativeText: parsed.executive_summary,
        scenarioJson: parsed,
        sourceLinks: parsed.source_links || [],
        format: 'new',
      };
    }
  } catch {
    // Not valid JSON, try old format
  }

  // Fallback: old delimiter format
  const SOURCE_DELIMITER = "---SOURCE_LINKS---";
  let sourceLinks = [];

  // Check for source links delimiter first
  let workingText = accumulated;
  const srcIdx = workingText.indexOf(SOURCE_DELIMITER);
  if (srcIdx !== -1) {
    const srcRaw = workingText.slice(srcIdx + SOURCE_DELIMITER.length).trim().replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    try {
      sourceLinks = JSON.parse(srcRaw);
    } catch {
      // source links parse failed
    }
    workingText = workingText.slice(0, srcIdx);
  }

  const delimIdx = workingText.indexOf(DELIMITER);
  const narrativeText = delimIdx === -1 ? workingText.trim() : workingText.slice(0, delimIdx).trim();
  let scenarioJson = null;

  if (delimIdx !== -1) {
    try {
      const raw = workingText.slice(delimIdx + DELIMITER.length).trim().replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      scenarioJson = JSON.parse(raw);
    } catch {
      // JSON parse failed
    }
  }

  return {
    assessment: null,
    narrativeText,
    scenarioJson,
    sourceLinks,
    format: 'old',
  };
}
