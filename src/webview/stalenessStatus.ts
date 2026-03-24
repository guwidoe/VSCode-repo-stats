import type { AnalysisStateSnapshot } from './analysisStateRegistry.js';

export interface CurrentTargetStateHashes {
  coreRevisionHash: string;
  coreSettingsHash: string;
  evolutionRevisionHash: string;
  evolutionSettingsHash: string;
}

export interface ComputedStalenessStatus {
  coreStale: boolean;
  evolutionStale: boolean;
}

export function computeStalenessStatus(options: {
  current: CurrentTargetStateHashes;
  lastCoreState: AnalysisStateSnapshot | undefined;
  lastEvolutionState: AnalysisStateSnapshot | undefined;
}): ComputedStalenessStatus {
  const coreStaleByRevision =
    options.lastCoreState !== undefined && options.lastCoreState.revisionHash !== options.current.coreRevisionHash;
  const coreStaleBySettings =
    options.lastCoreState !== undefined && options.lastCoreState.settingsHash !== options.current.coreSettingsHash;

  const evolutionStaleByRevision =
    options.lastEvolutionState !== undefined
    && options.lastEvolutionState.revisionHash !== options.current.evolutionRevisionHash;
  const evolutionStaleBySettings =
    options.lastEvolutionState !== undefined
    && options.lastEvolutionState.settingsHash !== options.current.evolutionSettingsHash;

  return {
    coreStale: coreStaleByRevision || coreStaleBySettings,
    evolutionStale: evolutionStaleByRevision || evolutionStaleBySettings,
  };
}
