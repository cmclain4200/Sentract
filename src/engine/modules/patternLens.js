import { buildPatternLensPrompt } from '../prompts/patternLens';
import { profileToPromptText } from '../core/profileToPrompt';

export function streamPatternLens(provider, { profileData }) {
  const profileText = profileToPromptText(profileData);
  const { system, messages, maxTokens } = buildPatternLensPrompt({ profileText });

  const stream = provider.stream({ system, messages, maxTokens });

  return {
    [Symbol.asyncIterator]: () => stream[Symbol.asyncIterator](),
    getText: () => stream.getText(),
    getResult: () => ({ narrative: stream.getText() }),
  };
}
