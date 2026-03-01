import { buildExtractionPrompt } from '../prompts/extraction';

export async function runExtraction(provider, { text }) {
  const { system, messages, maxTokens } = buildExtractionPrompt({ text });
  const { text: responseText } = await provider.complete({ system, messages, maxTokens });

  const cleaned = responseText
    .replace(/```json\n?/g, '')
    .replace(/```\n?/g, '')
    .trim();

  return JSON.parse(cleaned);
}

// Re-export helpers from profileExtractor
export { buildExtractionSummary, mergeExtractedIntoProfile } from '../../lib/profileExtractor';
