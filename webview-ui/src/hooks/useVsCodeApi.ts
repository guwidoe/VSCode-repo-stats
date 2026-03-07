/**
 * Hook for communicating with the VSCode extension.
 */

import { useCallback, useEffect } from 'react';
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

// ============================================================================
// Get VSCode API (singleton)
// ============================================================================

let vsCodeApi: VsCodeApi | null = null;

function getVsCodeApi(): VsCodeApi {
  if (vsCodeApi) {return vsCodeApi;}

  // In VSCode webview, acquireVsCodeApi is available globally
  if (typeof acquireVsCodeApi === 'function') {
    vsCodeApi = acquireVsCodeApi();
  } else {
    // Mock for development/testing
    vsCodeApi = {
      postMessage: (message) => console.log('postMessage:', message),
      getState: () => ({}),
      setState: () => {},
    };
  }

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
      console.log('[RepoStats Webview] Received message:', message.type, message);

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

        case 'evolutionStarted':
          setEvolutionLoading({ isLoading: true, phase: 'Starting evolution analysis...', progress: 0 });
          setEvolutionStatus('loading');
          setEvolutionError(null);
          break;

        case 'evolutionProgress':
          setEvolutionLoading({
            isLoading: true,
            phase: message.phase,
            progress: message.progress,
          });
          setEvolutionStatus('loading');
          break;

        case 'evolutionComplete':
          setEvolutionData(message.data);
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
          break;
      }
    };

    window.addEventListener('message', handleMessage);

    // Request settings on mount
    console.log('[RepoStats Webview] Requesting settings...');
    getVsCodeApi().postMessage({ type: 'getSettings' });
    getVsCodeApi().postMessage({ type: 'checkStaleness' });

    const stalenessTimer = window.setInterval(() => {
      getVsCodeApi().postMessage({ type: 'checkStaleness' });
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
    setEvolutionData,
    setEvolutionError,
    setEvolutionLoading,
    setEvolutionStatus,
    setStaleness,
  ]);

  // Actions
  const requestAnalysis = useCallback(() => {
    getVsCodeApi().postMessage({ type: 'requestAnalysis' });
  }, []);

  const requestRefresh = useCallback(() => {
    getVsCodeApi().postMessage({ type: 'requestRefresh' });
  }, []);

  const requestEvolutionAnalysis = useCallback(() => {
    getVsCodeApi().postMessage({ type: 'requestEvolutionAnalysis' });
  }, []);

  const requestEvolutionRefresh = useCallback(() => {
    getVsCodeApi().postMessage({ type: 'requestEvolutionRefresh' });
  }, []);

  const openFile = useCallback((path: string) => {
    getVsCodeApi().postMessage({ type: 'openFile', path });
  }, []);

  const revealInExplorer = useCallback((path: string) => {
    getVsCodeApi().postMessage({ type: 'revealInExplorer', path });
  }, []);

  const copyPath = useCallback((path: string) => {
    getVsCodeApi().postMessage({ type: 'copyPath', path });
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

    getVsCodeApi().postMessage({ type: 'updateSettings', settings });
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

      getVsCodeApi().postMessage({
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

    getVsCodeApi().postMessage({ type: 'resetScopedSetting', key });
  }, []);

  return {
    requestAnalysis,
    requestRefresh,
    requestEvolutionAnalysis,
    requestEvolutionRefresh,
    openFile,
    revealInExplorer,
    copyPath,
    updateSettings,
    updateScopedSetting,
    resetScopedSetting,
  };
}

// ============================================================================
// Type Declaration for VSCode API
// ============================================================================

declare function acquireVsCodeApi(): VsCodeApi;
