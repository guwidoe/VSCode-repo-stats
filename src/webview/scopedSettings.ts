import type {
  ExtensionSettings,
  RepoScopableSettingKey,
  RepoScopedSettings,
  ScopedSettingSource,
  ScopedSettingValue,
} from '../types/index.js';

export interface ConfigInspectValue<T> {
  defaultValue?: T;
  globalValue?: T;
  workspaceFolderValue?: T;
}

export function resolveScopedSettingSource<T>(inspect: ConfigInspectValue<T>): ScopedSettingSource {
  if (inspect.workspaceFolderValue !== undefined) {
    return 'repo';
  }
  if (inspect.globalValue !== undefined) {
    return 'global';
  }
  return 'default';
}

export function buildScopedSettingValue<T>(inspect: ConfigInspectValue<T>): ScopedSettingValue<T> {
  if (inspect.defaultValue === undefined) {
    throw new Error('Missing defaultValue for scoped setting. Check package.json configuration defaults.');
  }

  return {
    defaultValue: inspect.defaultValue,
    globalValue: inspect.globalValue,
    repoValue: inspect.workspaceFolderValue,
    source: resolveScopedSettingSource(inspect),
  };
}

export function getScopedSettingDisplayValue<K extends RepoScopableSettingKey>(
  scopedSettings: RepoScopedSettings,
  key: K,
  target: 'global' | 'repo'
): ExtensionSettings[K] {
  const setting = scopedSettings[key];
  if (target === 'repo') {
    return (setting.repoValue ?? setting.globalValue ?? setting.defaultValue) as ExtensionSettings[K];
  }

  return (setting.globalValue ?? setting.defaultValue) as ExtensionSettings[K];
}
