import type {
  RepoScopableSettingKey,
  RepoScopableSettingValueMap,
  RepoScopedSettings,
  ScopedSettingValue,
} from '../types/index.js';
import {
  buildScopedSettingValue as buildSharedScopedSettingValue,
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

export function buildScopedSettingValue<T>(inspect: ConfigInspectValue<T>): ScopedSettingValue<T> {
  return buildSharedScopedSettingValue({
    defaultValue: inspect.defaultValue,
    globalValue: inspect.globalValue,
    repoValue: inspect.workspaceFolderValue,
  });
}

export { getScopedSettingDisplayValue };

export type ScopedSettingDisplayValue = ReturnType<
  typeof getScopedSettingDisplayValue<RepoScopableSettingKey>
>;

export type ScopedSettingValueMap = RepoScopableSettingValueMap;
export type ScopedSettings = RepoScopedSettings;
