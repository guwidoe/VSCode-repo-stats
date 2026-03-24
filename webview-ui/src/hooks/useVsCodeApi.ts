/**
 * Hook for communicating with the VSCode extension.
 */

import { useCallback, useEffect } from 'react';
import { normalizeEvolutionResult } from '@shared/contracts';
import type {
  WebviewMessage,
  ExtensionMessage,
  ExtensionSettings,
  RepoScopableSettingKey,
  RepoScopableSettingValueMap,
  SettingWriteTarget,
} from '../types';
import { useStore } from '../store';
import { getOptimisticStalenessForSettingsChange } from './settingsStaleness';
import {
  applyScopedSettingUpdate,
  resetRepoScopedSettingOverride,
} from '../utils/scopedSettings';

// ============================================================================
// VSCode API Type
// ============================================================================

interface VsCodeApi {
  postMessage: (message: WebviewMessage) => void;
  getState: () => unknown;
  setState: (state: unknown) => void;
}

type VsCodeApiSource = 'vscode' | 'mock';

// ============================================================================
// Get VSCode API (singleton)
// ============================================================================

let vsCodeApi: VsCodeApi | null = null;
let vsCodeApiSource: VsCodeApiSource | null = null;

function createMockVsCodeApi(): VsCodeApi {
  return {
    postMessage: () => {},
    getState: () => ({}),
    setState: () => {},
  };
}

export function resetVsCodeApiForTests(): void {
  vsCodeApi = null;
  vsCodeApiSource = null;
}

function getOrCreateVsCodeApi(): VsCodeApi {
  const nextSource: VsCodeApiSource = typeof acquireVsCodeApi === 'function' ? 'vscode' : 'mock';
  if (nextSource === 'mock') {
    return createMockVsCodeApi();
  }

  if (vsCodeApi && vsCodeApiSource === nextSource) {
    return vsCodeApi;
  }

  vsCodeApi = acquireVsCodeApi();
  vsCodeApiSource = nextSource;

  return vsCodeApi;
}

// ============================================================================
// Hook
// ============================================================================

export function useVsCodeApi() {
  const {
    setData,
    mergeData,
    setError,
    setLoading,
    setSettings,
    setScopedSettings,
    setRepoScopeAvailable,
    setRepositorySelection,
    resetAnalysisState,
    setEvolutionData,
    setEvolutionError,
    setEvolutionLoading,
    setEvolutionStatus,
    setStaleness,
  } = useStore();

  // Handle messages from extension
  useEffect(() => {
    const handleMessage = (event: MessageEvent<ExtensionMessage>) => {
      const message = event.data;

      switch (message.type) {
        case 'analysisStarted':
          setLoading({ isLoading: true, phase: 'Starting analysis...', progress: 0 });
          break;

        case 'analysisProgress':
          setLoading({
            isLoading: true,
            phase: message.phase,
            progress: message.progress,
          });
          break;

        case 'analysisComplete':
          setData(message.data);
          break;

        case 'analysisError':
          setError(message.error);
          break;

        case 'repositorySelectionLoaded': {
          const currentSelectedRepositoryIds = useStore.getState().selectedRepositoryIds;
          const selectionChanged = currentSelectedRepositoryIds.length !== message.selectedRepositoryIds.length
            || currentSelectedRepositoryIds.some((repositoryId, index) => repositoryId !== message.selectedRepositoryIds[index]);

          if (selectionChanged) {
            resetAnalysisState();
          }
          setRepositorySelection(message.repositories, message.selectedRepositoryIds, message.selectedTarget);
          break;
        }

        case 'evolutionStarted':
          setEvolutionLoading({
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
          setEvolutionStatus('loading');
          setEvolutionError(null);
          break;

        case 'evolutionProgress':
          setEvolutionLoading({
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
          setEvolutionStatus('loading');
          break;

        case 'evolutionComplete':
          setEvolutionData(normalizeEvolutionResult(message.data));
          break;

        case 'evolutionError':
          setEvolutionError(message.error);
          break;

        case 'evolutionStale':
          setEvolutionStatus('stale');
          break;

        case 'stalenessStatus':
          setStaleness({
            coreStale: message.coreStale,
            evolutionStale: message.evolutionStale,
          });
          break;

        case 'incrementalUpdate': {
          if (message.data) {
            mergeData(message.data);
          }
          break;
        }

        case 'settingsLoaded':
          setSettings(message.settings);
          setScopedSettings(message.scopedSettings);
          setRepoScopeAvailable(message.repoScopeAvailable);
          break;
      }
    };

    window.addEventListener('message', handleMessage);

    // Request settings on mount
    getOrCreateVsCodeApi().postMessage({ type: 'getSettings' });
    getOrCreateVsCodeApi().postMessage({ type: 'checkStaleness' });

    const stalenessTimer = window.setInterval(() => {
      getOrCreateVsCodeApi().postMessage({ type: 'checkStaleness' });
    }, 15000);

    return () => {
      window.clearInterval(stalenessTimer);
      window.removeEventListener('message', handleMessage);
    };
  }, [
    setData,
    mergeData,
    setError,
    setLoading,
    setSettings,
    setScopedSettings,
    setRepoScopeAvailable,
    setRepositorySelection,
    resetAnalysisState,
    setEvolutionData,
    setEvolutionError,
    setEvolutionLoading,
    setEvolutionStatus,
    setStaleness,
  ]);

  // Actions
  const requestAnalysis = useCallback(() => {
    getOrCreateVsCodeApi().postMessage({ type: 'requestAnalysis' });
  }, []);

  const requestRefresh = useCallback(() => {
    getOrCreateVsCodeApi().postMessage({ type: 'requestRefresh' });
  }, []);

  const requestEvolutionAnalysis = useCallback(() => {
    getOrCreateVsCodeApi().postMessage({ type: 'requestEvolutionAnalysis' });
  }, []);

  const requestEvolutionRefresh = useCallback(() => {
    getOrCreateVsCodeApi().postMessage({ type: 'requestEvolutionRefresh' });
  }, []);

  const openFile = useCallback((path: string, repositoryId?: string) => {
    getOrCreateVsCodeApi().postMessage({ type: 'openFile', path, repositoryId });
  }, []);

  const revealInExplorer = useCallback((path: string, repositoryId?: string) => {
    getOrCreateVsCodeApi().postMessage({ type: 'revealInExplorer', path, repositoryId });
  }, []);

  const copyPath = useCallback((path: string, repositoryId?: string) => {
    getOrCreateVsCodeApi().postMessage({ type: 'copyPath', path, repositoryId });
  }, []);

  const updateRepositorySelection = useCallback((repositoryIds: string[]) => {
    getOrCreateVsCodeApi().postMessage({ type: 'updateRepositorySelection', repositoryIds });
  }, []);

  const updateSettings = useCallback((settings: Partial<ExtensionSettings>) => {
    const state = useStore.getState();
    const currentSettings = state.settings;
    if (currentSettings) {
      const nextSettings = {
        ...currentSettings,
        ...settings,
      };

      state.setSettings(nextSettings);

      const optimisticStaleness = getOptimisticStalenessForSettingsChange({
        currentSettings,
        nextSettings: settings,
        hasCoreData: state.data !== null,
        hasEvolutionData: state.evolutionData !== null,
        currentStaleness: {
          coreStale: state.coreStale,
          evolutionStale: state.evolutionStale,
        },
      });
      state.setStaleness(optimisticStaleness);
    }

    getOrCreateVsCodeApi().postMessage({ type: 'updateSettings', settings });
  }, []);

  const updateScopedSetting = useCallback(
    <K extends RepoScopableSettingKey>(
      key: K,
      value: RepoScopableSettingValueMap[K],
      target: SettingWriteTarget
    ) => {
      const state = useStore.getState();
      if (state.settings && state.scopedSettings) {
        const next = applyScopedSettingUpdate(
          state.settings,
          state.scopedSettings,
          key,
          value,
          target
        );
        state.setSettings(next.settings);
        state.setScopedSettings(next.scopedSettings);
        state.setStaleness(
          getOptimisticStalenessForSettingsChange({
            currentSettings: state.settings,
            nextSettings: next.settings,
            hasCoreData: state.data !== null,
            hasEvolutionData: state.evolutionData !== null,
            currentStaleness: {
              coreStale: state.coreStale,
              evolutionStale: state.evolutionStale,
            },
          })
        );
      }

      getOrCreateVsCodeApi().postMessage({
        type: 'updateScopedSetting',
        key,
        value,
        target,
      });
    },
    []
  );

  const resetScopedSetting = useCallback((key: RepoScopableSettingKey) => {
    const state = useStore.getState();
    if (state.settings && state.scopedSettings) {
      const next = resetRepoScopedSettingOverride(state.settings, state.scopedSettings, key);
      state.setSettings(next.settings);
      state.setScopedSettings(next.scopedSettings);
      state.setStaleness(
        getOptimisticStalenessForSettingsChange({
          currentSettings: state.settings,
          nextSettings: next.settings,
          hasCoreData: state.data !== null,
          hasEvolutionData: state.evolutionData !== null,
          currentStaleness: {
            coreStale: state.coreStale,
            evolutionStale: state.evolutionStale,
          },
        })
      );
    }

    getOrCreateVsCodeApi().postMessage({ type: 'resetScopedSetting', key });
  }, []);

  return {
    requestAnalysis,
    requestRefresh,
    requestEvolutionAnalysis,
    requestEvolutionRefresh,
    openFile,
    revealInExplorer,
    copyPath,
    updateRepositorySelection,
    updateSettings,
    updateScopedSetting,
    resetScopedSetting,
  };
}

// ============================================================================
// Type Declaration for VSCode API
// ============================================================================

declare function acquireVsCodeApi(): VsCodeApi;
