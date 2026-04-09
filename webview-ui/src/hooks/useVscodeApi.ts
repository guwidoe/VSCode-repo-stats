import { useCallback, useEffect } from 'react';
import type {
  ExtensionSettings,
  RepoScopableSettingKey,
  RepoScopableSettingValueMap,
  ScopedSettingUpdateMessage,
  SettingWriteTarget,
} from '../types';
import {
  applyExtensionMessage,
  parseExtensionMessage,
} from './vscodeExtensionMessageHandler';
import {
  postVscodeMessage,
  resetVscodeApiForTests,
} from './vscodeApiBridge';
import {
  applyOptimisticScopedSettingReset,
  applyOptimisticScopedSettingUpdate,
  applyOptimisticSettingsUpdate,
} from './vscodeOptimisticSettings';

export { resetVscodeApiForTests };

function createScopedSettingUpdateMessage<K extends RepoScopableSettingKey>(
  key: K,
  value: RepoScopableSettingValueMap[K],
  target: SettingWriteTarget
): ScopedSettingUpdateMessage<K> {
  return {
    type: 'updateScopedSetting',
    key,
    value,
    target,
  } as ScopedSettingUpdateMessage<K>;
}

export function useVscodeApi() {
  useEffect(() => {
    const handleMessage = (event: MessageEvent<unknown>) => {
      const message = parseExtensionMessage(event.data);
      if (!message) {
        console.warn('[RepoStats] Ignored malformed extension message.', event.data);
        return;
      }

      applyExtensionMessage(message);
    };

    window.addEventListener('message', handleMessage);
    postVscodeMessage({ type: 'getSettings' });
    postVscodeMessage({ type: 'checkStaleness' });

    const stalenessTimer = window.setInterval(() => {
      postVscodeMessage({ type: 'checkStaleness' });
    }, 15000);

    return () => {
      window.clearInterval(stalenessTimer);
      window.removeEventListener('message', handleMessage);
    };
  }, []);

  const requestAnalysis = useCallback(() => {
    postVscodeMessage({ type: 'requestAnalysis' });
  }, []);

  const requestRefresh = useCallback(() => {
    postVscodeMessage({ type: 'requestRefresh' });
  }, []);

  const cancelAnalysis = useCallback(() => {
    postVscodeMessage({ type: 'cancelAnalysis' });
  }, []);

  const requestEvolutionAnalysis = useCallback(() => {
    postVscodeMessage({ type: 'requestEvolutionAnalysis' });
  }, []);

  const requestEvolutionRefresh = useCallback(() => {
    postVscodeMessage({ type: 'requestEvolutionRefresh' });
  }, []);

  const cancelEvolutionAnalysis = useCallback(() => {
    postVscodeMessage({ type: 'cancelEvolutionAnalysis' });
  }, []);

  const openFile = useCallback((path: string, repositoryId?: string) => {
    postVscodeMessage({ type: 'openFile', path, repositoryId });
  }, []);

  const revealInExplorer = useCallback((path: string, repositoryId?: string) => {
    postVscodeMessage({ type: 'revealInExplorer', path, repositoryId });
  }, []);

  const copyPath = useCallback((path: string, repositoryId?: string) => {
    postVscodeMessage({ type: 'copyPath', path, repositoryId });
  }, []);

  const updateRepositorySelection = useCallback((repositoryIds: string[]) => {
    postVscodeMessage({ type: 'updateRepositorySelection', repositoryIds });
  }, []);

  const updateSettings = useCallback((settings: Partial<ExtensionSettings>) => {
    applyOptimisticSettingsUpdate(settings);
    postVscodeMessage({ type: 'updateSettings', settings });
  }, []);

  const updateScopedSetting = useCallback(
    <K extends RepoScopableSettingKey>(
      key: K,
      value: RepoScopableSettingValueMap[K],
      target: SettingWriteTarget
    ) => {
      applyOptimisticScopedSettingUpdate(key, value, target);
      postVscodeMessage(createScopedSettingUpdateMessage(key, value, target));
    },
    []
  );

  const resetScopedSetting = useCallback((key: RepoScopableSettingKey) => {
    applyOptimisticScopedSettingReset(key);
    postVscodeMessage({ type: 'resetScopedSetting', key });
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
