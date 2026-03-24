import { describe, expect, it } from 'vitest';
import { AnalysisStateRegistry } from './analysisStateRegistry.js';

describe('AnalysisStateRegistry', () => {
  it('stores core and evolution state independently per target', () => {
    const registry = new AnalysisStateRegistry();

    registry.setCoreState('target-1', { revisionHash: 'core-r1', settingsHash: 'core-s1' });
    registry.setEvolutionState('target-1', { revisionHash: 'evo-r1', settingsHash: 'evo-s1' });

    expect(registry.getCoreState('target-1')).toEqual({ revisionHash: 'core-r1', settingsHash: 'core-s1' });
    expect(registry.getEvolutionState('target-1')).toEqual({ revisionHash: 'evo-r1', settingsHash: 'evo-s1' });
  });

  it('returns undefined for unknown targets', () => {
    const registry = new AnalysisStateRegistry();
    expect(registry.getCoreState('missing')).toBeUndefined();
    expect(registry.getEvolutionState('missing')).toBeUndefined();
  });
});
