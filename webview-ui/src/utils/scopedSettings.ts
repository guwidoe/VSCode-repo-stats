import type {
  ExtensionSettings,
  RepoScopableSettingKey,
  RepoScopableSettingValueMap,
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

function setScopedSettingValue<K extends RepoScopableSettingKey>(
  settings: ExtensionSettings,
  key: K,
  value: RepoScopableSettingValueMap[K]
): ExtensionSettings {
  switch (key) {
    case 'evolution.snapshotIntervalDays':
      return {
        ...settings,
        evolution: {
          ...settings.evolution,
          snapshotIntervalDays: value as number,
        },
      };
    case 'evolution.maxSnapshots':
      return {
        ...settings,
        evolution: {
          ...settings.evolution,
          maxSnapshots: value as number,
        },
      };
    case 'evolution.maxSeries':
      return {
        ...settings,
        evolution: {
          ...settings.evolution,
          maxSeries: value as number,
        },
      };
    case 'evolution.cohortFormat':
      return {
        ...settings,
        evolution: {
          ...settings.evolution,
          cohortFormat: value as string,
        },
      };
    default:
      return {
        ...settings,
        [key]: value,
      } as ExtensionSettings;
  }
}

export function getScopedSettingDisplayValue<K extends RepoScopableSettingKey>(
  scopedSettings: RepoScopedSettings,
  key: K,
  target: SettingWriteTarget
): RepoScopableSettingValueMap[K] {
  const setting = scopedSettings[key];
  if (target === 'repo') {
    return (setting.repoValue ?? setting.globalValue ?? setting.defaultValue) as RepoScopableSettingValueMap[K];
  }

  return (setting.globalValue ?? setting.defaultValue) as RepoScopableSettingValueMap[K];
}

export function applyScopedSettingUpdate<K extends RepoScopableSettingKey>(
  currentSettings: ExtensionSettings,
  currentScopedSettings: RepoScopedSettings,
  key: K,
  value: RepoScopableSettingValueMap[K],
  target: SettingWriteTarget
): { settings: ExtensionSettings; scopedSettings: RepoScopedSettings } {
  const nextEntry = {
    ...currentScopedSettings[key],
    globalValue: target === 'global' ? value : currentScopedSettings[key].globalValue,
    repoValue: target === 'repo' ? value : currentScopedSettings[key].repoValue,
    source: getSource({
      globalValue: target === 'global' ? value : currentScopedSettings[key].globalValue,
      repoValue: target === 'repo' ? value : currentScopedSettings[key].repoValue,
    }),
  };

  const nextScopedSettings: RepoScopedSettings = {
    ...currentScopedSettings,
    [key]: nextEntry,
  };

  return {
    settings: setScopedSettingValue(
      currentSettings,
      key,
      getScopedSettingDisplayValue(nextScopedSettings, key, 'repo')
    ),
    scopedSettings: nextScopedSettings,
  };
}

export function resetRepoScopedSettingOverride<K extends RepoScopableSettingKey>(
  currentSettings: ExtensionSettings,
  currentScopedSettings: RepoScopedSettings,
  key: K
): { settings: ExtensionSettings; scopedSettings: RepoScopedSettings } {
  const nextEntry = {
    ...currentScopedSettings[key],
    repoValue: undefined,
    source: getSource({
      globalValue: currentScopedSettings[key].globalValue,
    }),
  };

  const nextScopedSettings: RepoScopedSettings = {
    ...currentScopedSettings,
    [key]: nextEntry,
  };

  return {
    settings: setScopedSettingValue(
      currentSettings,
      key,
      getScopedSettingDisplayValue(nextScopedSettings, key, 'repo')
    ),
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
