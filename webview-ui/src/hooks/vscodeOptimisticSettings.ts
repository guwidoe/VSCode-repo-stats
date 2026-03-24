import type {
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

function applyOptimisticSettingsPatch(
  currentSettings: ExtensionSettings,
  nextSettings: Partial<ExtensionSettings>
): void {
  const state = useStore.getState();
  state.setStaleness(
    getOptimisticStalenessForSettingsChange({
      currentSettings,
      nextSettings,
      hasCoreData: state.data !== null,
      hasEvolutionData: state.evolutionData !== null,
      currentStaleness: {
        coreStale: state.coreStale,
        evolutionStale: state.evolutionStale,
      },
    })
  );
}

export function applyOptimisticSettingsUpdate(settings: Partial<ExtensionSettings>): void {
  const state = useStore.getState();
  const currentSettings = state.settings;
  if (!currentSettings) {
    return;
  }

  const nextSettings = {
    ...currentSettings,
    ...settings,
  };

  state.setSettings(nextSettings);
  applyOptimisticSettingsPatch(currentSettings, settings);
}

export function applyOptimisticScopedSettingUpdate<K extends RepoScopableSettingKey>(
  key: K,
  value: RepoScopableSettingValueMap[K],
  target: SettingWriteTarget
): void {
  const state = useStore.getState();
  if (!state.settings || !state.scopedSettings) {
    return;
  }

  const next = applyScopedSettingUpdate(
    state.settings,
    state.scopedSettings,
    key,
    value,
    target
  );
  state.setSettings(next.settings);
  state.setScopedSettings(next.scopedSettings);
  applyOptimisticSettingsPatch(state.settings, next.settings);
}

export function applyOptimisticScopedSettingReset(key: RepoScopableSettingKey): void {
  const state = useStore.getState();
  if (!state.settings || !state.scopedSettings) {
    return;
  }

  const next = resetRepoScopedSettingOverride(state.settings, state.scopedSettings, key);
  state.setSettings(next.settings);
  state.setScopedSettings(next.scopedSettings);
  applyOptimisticSettingsPatch(state.settings, next.settings);
}
