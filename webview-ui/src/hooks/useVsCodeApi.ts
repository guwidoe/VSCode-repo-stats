import { useCallback, useEffect } from 'react';
import type {
  ExtensionSettings,
  ExtensionMessage,
  RepoScopableSettingKey,
  RepoScopableSettingValueMap,
  SettingWriteTarget,
} from '../types';
import { applyExtensionMessage } from './vscodeExtensionMessageHandler';
import {
  postVsCodeMessage,
  resetVsCodeApiForTests,
} from './vscodeApiBridge';
import {
  applyOptimisticScopedSettingReset,
  applyOptimisticScopedSettingUpdate,
  applyOptimisticSettingsUpdate,
} from './vscodeOptimisticSettings';

export { resetVsCodeApiForTests };

export function useVsCodeApi() {
  useEffect(() => {
    const handleMessage = (event: MessageEvent<ExtensionMessage>) => {
      applyExtensionMessage(event.data);
    };

    window.addEventListener('message', handleMessage);
    postVsCodeMessage({ type: 'getSettings' });
    postVsCodeMessage({ type: 'checkStaleness' });

    const stalenessTimer = window.setInterval(() => {
      postVsCodeMessage({ type: 'checkStaleness' });
    }, 15000);

    return () => {
      window.clearInterval(stalenessTimer);
      window.removeEventListener('message', handleMessage);
    };
  }, []);

  const requestAnalysis = useCallback(() => {
    postVsCodeMessage({ type: 'requestAnalysis' });
  }, []);

  const requestRefresh = useCallback(() => {
    postVsCodeMessage({ type: 'requestRefresh' });
  }, []);

  const cancelAnalysis = useCallback(() => {
    postVsCodeMessage({ type: 'cancelAnalysis' });
  }, []);

  const requestEvolutionAnalysis = useCallback(() => {
    postVsCodeMessage({ type: 'requestEvolutionAnalysis' });
  }, []);

  const requestEvolutionRefresh = useCallback(() => {
    postVsCodeMessage({ type: 'requestEvolutionRefresh' });
  }, []);

  const cancelEvolutionAnalysis = useCallback(() => {
    postVsCodeMessage({ type: 'cancelEvolutionAnalysis' });
  }, []);

  const openFile = useCallback((path: string, repositoryId?: string) => {
    postVsCodeMessage({ type: 'openFile', path, repositoryId });
  }, []);

  const revealInExplorer = useCallback((path: string, repositoryId?: string) => {
    postVsCodeMessage({ type: 'revealInExplorer', path, repositoryId });
  }, []);

  const copyPath = useCallback((path: string, repositoryId?: string) => {
    postVsCodeMessage({ type: 'copyPath', path, repositoryId });
  }, []);

  const updateRepositorySelection = useCallback((repositoryIds: string[]) => {
    postVsCodeMessage({ type: 'updateRepositorySelection', repositoryIds });
  }, []);

  const updateSettings = useCallback((settings: Partial<ExtensionSettings>) => {
    applyOptimisticSettingsUpdate(settings);
    postVsCodeMessage({ type: 'updateSettings', settings });
  }, []);

  const updateScopedSetting = useCallback(
    <K extends RepoScopableSettingKey>(
      key: K,
      value: RepoScopableSettingValueMap[K],
      target: SettingWriteTarget
    ) => {
      applyOptimisticScopedSettingUpdate(key, value, target);
      postVsCodeMessage({
        type: 'updateScopedSetting',
        key,
        value,
        target,
      });
    },
    []
  );

  const resetScopedSetting = useCallback((key: RepoScopableSettingKey) => {
    applyOptimisticScopedSettingReset(key);
    postVsCodeMessage({ type: 'resetScopedSetting', key });
  }, []);

  return {
    requestAnalysis,
    requestRefresh,
    cancelAnalysis,
    requestEvolutionAnalysis,
    requestEvolutionRefresh,
    cancelEvolutionAnalysis,
    openFile,
    revealInExplorer,
    copyPath,
    updateRepositorySelection,
    updateSettings,
    updateScopedSetting,
    resetScopedSetting,
  };
}
