import type {
  ExtensionSettings,
  RepoScopableSettingKey,
  RepoScopedSettings,
  ScopedSettingSource,
  SettingWriteTarget,
} from '../types';

function getSource<T>(setting: {
  repoValue?: T;
  globalValue?: T;
}): ScopedSettingSource {
  if (setting.repoValue !== undefined) {
    return 'repo';
  }
  if (setting.globalValue !== undefined) {
    return 'global';
  }
  return 'default';
}

export function getScopedSettingDisplayValue<K extends RepoScopableSettingKey>(
  scopedSettings: RepoScopedSettings,
  key: K,
  target: SettingWriteTarget
): ExtensionSettings[K] {
  const setting = scopedSettings[key];
  if (target === 'repo') {
    return (setting.repoValue ?? setting.globalValue ?? setting.defaultValue) as ExtensionSettings[K];
  }

  return (setting.globalValue ?? setting.defaultValue) as ExtensionSettings[K];
}

export function applyScopedSettingUpdate<K extends RepoScopableSettingKey>(
  currentSettings: ExtensionSettings,
  currentScopedSettings: RepoScopedSettings,
  key: K,
  value: ExtensionSettings[K],
  target: SettingWriteTarget
): { settings: ExtensionSettings; scopedSettings: RepoScopedSettings } {
  const nextScopedSettings: RepoScopedSettings = {
    ...currentScopedSettings,
    [key]: {
      ...currentScopedSettings[key],
      globalValue: target === 'global' ? value : currentScopedSettings[key].globalValue,
      repoValue: target === 'repo' ? value : currentScopedSettings[key].repoValue,
      source: getSource({
        globalValue: target === 'global' ? value : currentScopedSettings[key].globalValue,
        repoValue: target === 'repo' ? value : currentScopedSettings[key].repoValue,
      }),
    },
  };

  return {
    settings: {
      ...currentSettings,
      [key]: getScopedSettingDisplayValue(nextScopedSettings, key, 'repo'),
    },
    scopedSettings: nextScopedSettings,
  };
}

export function resetRepoScopedSettingOverride<K extends RepoScopableSettingKey>(
  currentSettings: ExtensionSettings,
  currentScopedSettings: RepoScopedSettings,
  key: K
): { settings: ExtensionSettings; scopedSettings: RepoScopedSettings } {
  const nextScopedSettings: RepoScopedSettings = {
    ...currentScopedSettings,
    [key]: {
      ...currentScopedSettings[key],
      repoValue: undefined,
      source: getSource({
        globalValue: currentScopedSettings[key].globalValue,
      }),
    },
  };

  return {
    settings: {
      ...currentSettings,
      [key]: getScopedSettingDisplayValue(nextScopedSettings, key, 'repo'),
    },
    scopedSettings: nextScopedSettings,
  };
}

export function getScopedSettingSourceLabel(
  source: ScopedSettingSource,
  target: SettingWriteTarget
): string {
  if (source === 'repo') {
    return 'Saved in Repo';
  }
  if (source === 'global') {
    return target === 'repo' ? 'Inherited from Global' : 'Saved Globally';
  }
  return 'Using Default';
}
