import { describe, expect, it } from 'vitest';
import { computeStalenessStatus } from './stalenessStatus.js';

describe('computeStalenessStatus', () => {
  it('reports not stale when there is no prior state', () => {
    expect(computeStalenessStatus({
      current: {
        coreRevisionHash: 'core-r1',
        coreSettingsHash: 'core-s1',
        evolutionRevisionHash: 'evo-r1',
        evolutionSettingsHash: 'evo-s1',
      },
      lastCoreState: undefined,
      lastEvolutionState: undefined,
    })).toEqual({ coreStale: false, evolutionStale: false });
  });

  it('reports stale when either revision or settings change', () => {
    expect(computeStalenessStatus({
      current: {
        coreRevisionHash: 'core-r2',
        coreSettingsHash: 'core-s1',
        evolutionRevisionHash: 'evo-r1',
        evolutionSettingsHash: 'evo-s2',
      },
      lastCoreState: { revisionHash: 'core-r1', settingsHash: 'core-s1' },
      lastEvolutionState: { revisionHash: 'evo-r1', settingsHash: 'evo-s1' },
    })).toEqual({ coreStale: true, evolutionStale: true });
  });
});
