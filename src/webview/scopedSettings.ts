import type {
  RepoScopableSettingKey,
  RepoScopableSettingValueMap,
  RepoScopedSettings,
} from '../types/index.js';
import {
  buildScopedSettingValueFromInspect as buildSharedScopedSettingValueFromInspect,
  getScopedSettingDisplayValue,
  resolveScopedSettingSource as resolveSharedScopedSettingSource,
} from '../shared/settings.js';

export interface ConfigInspectValue<T> {
  defaultValue?: T;
  globalValue?: T;
  workspaceFolderValue?: T;
}

export function resolveScopedSettingSource<T>(inspect: ConfigInspectValue<T>) {
  return resolveSharedScopedSettingSource({
    globalValue: inspect.globalValue,
    repoValue: inspect.workspaceFolderValue,
  });
}

export function buildScopedSettingValue<K extends RepoScopableSettingKey>(
  inspect: ConfigInspectValue<RepoScopableSettingValueMap[K]>
): RepoScopedSettings[K] {
  return buildSharedScopedSettingValueFromInspect(inspect) as RepoScopedSettings[K];
}

export { getScopedSettingDisplayValue };

export type ScopedSettingDisplayValue = ReturnType<
  typeof getScopedSettingDisplayValue<RepoScopableSettingKey>
>;

export type ScopedSettingValueMap = RepoScopableSettingValueMap;
export type ScopedSettings = RepoScopedSettings;
