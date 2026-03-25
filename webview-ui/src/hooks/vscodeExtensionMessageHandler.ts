import { normalizeEvolutionResult } from '@shared/contracts';
import type { ExtensionMessage } from '../types';
import { useStore } from '../store';

function repositorySelectionChanged(message: Extract<ExtensionMessage, { type: 'repositorySelectionLoaded' }>): boolean {
  const currentSelectedRepositoryIds = useStore.getState().selectedRepositoryIds;
  return currentSelectedRepositoryIds.length !== message.selectedRepositoryIds.length
    || currentSelectedRepositoryIds.some(
      (repositoryId, index) => repositoryId !== message.selectedRepositoryIds[index]
    );
}

export function applyExtensionMessage(message: ExtensionMessage): void {
  const state = useStore.getState();

  switch (message.type) {
    case 'analysisStarted':
      state.setLoading({ isLoading: true, phase: 'Starting analysis...', progress: 0 });
      state.setAnalysisPresentation({ activeRunState: 'running' });
      return;

    case 'analysisCancelled':
      state.setLoading({ isLoading: false, phase: '', progress: 0 });
      state.setError(null);
      state.setAnalysisPresentation({ activeRunState: 'cancelled' });
      return;

    case 'analysisProgress':
      state.setLoading({
        isLoading: true,
        phase: message.phase,
        progress: message.progress,
      });
      state.setAnalysisPresentation({ activeRunState: 'running' });
      return;

    case 'analysisComplete':
      state.setData(message.data, {
        completeness: message.resultState?.completeness ?? 'final',
      });
      return;

    case 'analysisError':
      state.setError(message.error);
      return;

    case 'repositorySelectionLoaded':
      if (repositorySelectionChanged(message)) {
        state.resetAnalysisState();
      }
      state.setRepositorySelection(
        message.repositories,
        message.selectedRepositoryIds,
        message.selectedTarget
      );
      return;

    case 'evolutionStarted':
      state.setEvolutionLoading({
        isLoading: true,
        phase: 'Starting evolution analysis...',
        progress: 0,
        stage: 'preparing',
        currentRepositoryLabel: undefined,
        currentRepositoryIndex: undefined,
        totalRepositories: undefined,
        currentSnapshotIndex: undefined,
        totalSnapshots: undefined,
        etaSeconds: undefined,
      });
      state.setEvolutionStatus('loading');
      state.setEvolutionError(null);
      state.setEvolutionPresentation({ activeRunState: 'running' });
      return;

    case 'evolutionCancelled':
      state.setEvolutionLoading({
        isLoading: false,
        phase: '',
        progress: 0,
        stage: undefined,
        currentRepositoryLabel: undefined,
        currentRepositoryIndex: undefined,
        totalRepositories: undefined,
        currentSnapshotIndex: undefined,
        totalSnapshots: undefined,
        etaSeconds: undefined,
      });
      state.setEvolutionError(null);
      state.setEvolutionStatus(state.evolutionStale ? 'stale' : state.evolutionData ? 'ready' : 'idle');
      state.setEvolutionPresentation({ activeRunState: 'cancelled' });
      return;

    case 'evolutionProgress':
      state.setEvolutionLoading({
        isLoading: true,
        phase: message.phase,
        progress: message.progress,
        stage: message.stage,
        currentRepositoryLabel: message.currentRepositoryLabel,
        currentRepositoryIndex: message.currentRepositoryIndex,
        totalRepositories: message.totalRepositories,
        currentSnapshotIndex: message.currentSnapshotIndex,
        totalSnapshots: message.totalSnapshots,
        etaSeconds: message.etaSeconds,
      });
      state.setEvolutionStatus('loading');
      state.setEvolutionPresentation({ activeRunState: 'running' });
      return;

    case 'evolutionComplete':
      state.setEvolutionData(normalizeEvolutionResult(message.data), {
        completeness: message.resultState?.completeness ?? 'final',
      });
      return;

    case 'evolutionError':
      state.setEvolutionError(message.error);
      return;

    case 'evolutionStale':
      state.setEvolutionStatus('stale');
      return;

    case 'stalenessStatus':
      state.setStaleness({
        coreStale: message.coreStale,
        evolutionStale: message.evolutionStale,
      });
      return;

    case 'incrementalUpdate':
      if (message.data) {
        state.mergeData(message.data, {
          completeness: message.resultState?.completeness ?? 'preliminary',
        });
      }
      return;

    case 'settingsLoaded':
      state.setSettings(message.settings);
      state.setScopedSettings(message.scopedSettings);
      state.setRepoScopeAvailable(message.repoScopeAvailable);
      return;
  }
}
