import { normalizeEvolutionResult } from '@shared/contracts';
import type { ExtensionMessage } from '../types';
import { useStore } from '../store';

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null;
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean';
}

function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(isString);
}

function isMessageRecord(message: unknown): message is UnknownRecord & { type: string } {
  return isRecord(message) && isString(message.type);
}

export function parseExtensionMessage(message: unknown): ExtensionMessage | null {
  if (!isMessageRecord(message)) {
    return null;
  }

  switch (message.type) {
    case 'analysisStarted':
    case 'analysisCancelled':
    case 'evolutionStarted':
    case 'evolutionCancelled':
      return { type: message.type };

    case 'analysisProgress':
      if (!isString(message.phase) || !isNumber(message.progress)) {
        return null;
      }
      return { type: 'analysisProgress', phase: message.phase, progress: message.progress };

    case 'analysisComplete':
      if (!isRecord(message.data)) {
        return null;
      }
      return message as ExtensionMessage;

    case 'analysisError':
      return isString(message.error) ? { type: 'analysisError', error: message.error } : null;

    case 'repositorySelectionLoaded':
      if (!Array.isArray(message.repositories) || !isStringArray(message.selectedRepositoryIds)) {
        return null;
      }
      if (message.selectedTarget !== null && !isRecord(message.selectedTarget)) {
        return null;
      }
      return message as ExtensionMessage;

    case 'incrementalUpdate':
      return isRecord(message.data) ? (message as ExtensionMessage) : null;

    case 'evolutionProgress':
      if (!isString(message.phase) || !isNumber(message.progress) || !isString(message.stage)) {
        return null;
      }
      return message as ExtensionMessage;

    case 'evolutionComplete':
      return isRecord(message.data) ? (message as ExtensionMessage) : null;

    case 'evolutionError':
      return isString(message.error) ? { type: 'evolutionError', error: message.error } : null;

    case 'evolutionStale':
      return isString(message.reason) ? { type: 'evolutionStale', reason: message.reason } : null;

    case 'stalenessStatus':
      return isBoolean(message.coreStale) && isBoolean(message.evolutionStale)
        ? { type: 'stalenessStatus', coreStale: message.coreStale, evolutionStale: message.evolutionStale }
        : null;

    case 'settingsLoaded':
      return isRecord(message.settings) && isRecord(message.scopedSettings) && isBoolean(message.repoScopeAvailable)
        ? (message as ExtensionMessage)
        : null;

    default:
      return null;
  }
}

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
