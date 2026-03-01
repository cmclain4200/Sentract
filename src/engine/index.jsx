import { createContext, useContext } from 'react';
import { createAnthropicProvider } from './providers/anthropic';
import { streamReconMirror, parseReconMirrorOutput } from './modules/reconMirror';
import { streamPatternLens } from './modules/patternLens';
import { runExtraction } from './modules/extraction';
import { streamChat } from './modules/chat';
import { simulateCountermeasures } from './modules/simulation';

// Re-export core functions for convenience
export { calculateAegisScore, buildScoreDrivers, buildRemediationOptions, simulateRemediation, normalizeConsistency } from './core/aegisScore';
export { fetchAllUserSubjects, detectOverlaps } from './core/crosswire';
export { profileToPromptText, countDataPoints } from './core/profileToPrompt';
export { calculateCompleteness } from './core/profileCompleteness';
export { buildHeatmapFromRoutines } from './core/patternHeatmap';
export { parseReconMirrorOutput } from './modules/reconMirror';

// Re-export prompt constants
export { ADVERSARY_TYPES, OBJECTIVES, SOPHISTICATION_LEVELS } from './prompts/reconMirror';

export function createSentractEngine(config = {}) {
  const provider = createAnthropicProvider(config);

  return {
    provider: {
      hasKey: provider.hasKey,
      complete: provider.complete,
      stream: provider.stream,
    },
    reconMirror: {
      stream: (opts) => streamReconMirror(provider, opts),
      parseOutput: parseReconMirrorOutput,
      simulate: (opts) => simulateCountermeasures(provider, opts),
    },
    patternLens: {
      stream: (opts) => streamPatternLens(provider, opts),
    },
    extraction: {
      run: (opts) => runExtraction(provider, opts),
    },
    chat: {
      stream: (opts) => streamChat(provider, opts),
    },
  };
}

const EngineContext = createContext(null);

export function EngineProvider({ value, children }) {
  return <EngineContext.Provider value={value}>{children}</EngineContext.Provider>;
}

export function useEngine() {
  const engine = useContext(EngineContext);
  if (!engine) {
    throw new Error('useEngine() must be used within an <EngineProvider>');
  }
  return engine;
}
