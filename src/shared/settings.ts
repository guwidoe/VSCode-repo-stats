import type {
  ExtensionSettings,
  RepoScopableSettingKey,
  RepoScopableSettingValueMap,
  RepoScopedSettings,
  ScopedSettingSource,
  ScopedSettingValue,
  SettingWriteTarget,
} from './contracts.js';

interface ScopedSettingLookup<T> {
  globalValue?: T;
  repoValue?: T;
}

interface ScopedSettingSeed<T> extends ScopedSettingLookup<T> {
  defaultValue?: T;
}

interface ConfigurationInspectSeed<T> {
  defaultValue?: T;
  globalValue?: T;
  workspaceFolderValue?: T;
}

export interface SettingsUpdateEntry {
  key: string;
  value: unknown;
}

function sorted(values: string[]): string[] {
  return [...values].sort((a, b) => a.localeCompare(b));
}

export function resolveScopedSettingSource<T>(setting: ScopedSettingLookup<T>): ScopedSettingSource {
  if (setting.repoValue !== undefined) {
    return 'repo';
  }
  if (setting.globalValue !== undefined) {
    return 'global';
  }
  return 'default';
}

export function buildScopedSettingValue<T>(seed: ScopedSettingSeed<T>): ScopedSettingValue<T> {
  if (seed.defaultValue === undefined) {
    throw new Error('Missing defaultValue for scoped setting. Check package.json configuration defaults.');
  }

  return {
    defaultValue: seed.defaultValue,
    globalValue: seed.globalValue,
    repoValue: seed.repoValue,
    source: resolveScopedSettingSource(seed),
  };
}

export function buildScopedSettingValueFromInspect<T>(inspect: ConfigurationInspectSeed<T>): ScopedSettingValue<T> {
  return buildScopedSettingValue({
    defaultValue: inspect.defaultValue,
    globalValue: inspect.globalValue,
    repoValue: inspect.workspaceFolderValue,
  });
}

function resolveScopedSettingDisplayValue<T>(setting: ScopedSettingValue<T>, target: SettingWriteTarget): T {
  if (target === 'repo') {
    return setting.repoValue ?? setting.globalValue ?? setting.defaultValue;
  }

  return setting.globalValue ?? setting.defaultValue;
}

export function getScopedSettingDisplayValue<K extends RepoScopableSettingKey>(
  scopedSettings: RepoScopedSettings,
  key: K,
  target: SettingWriteTarget
): RepoScopableSettingValueMap[K] {
  return resolveScopedSettingDisplayValue(scopedSettings[key], target);
}

const scopedSettingAppliers: {
  [K in RepoScopableSettingKey]: (
    settings: ExtensionSettings,
    value: RepoScopableSettingValueMap[K]
  ) => ExtensionSettings;
} = {
  excludePatterns: (settings, value) => ({ ...settings, excludePatterns: value }),
  generatedPatterns: (settings, value) => ({ ...settings, generatedPatterns: value }),
  binaryExtensions: (settings, value) => ({ ...settings, binaryExtensions: value }),
  locExcludedExtensions: (settings, value) => ({ ...settings, locExcludedExtensions: value }),
  maxCommitsToAnalyze: (settings, value) => ({ ...settings, maxCommitsToAnalyze: value }),
  'evolution.samplingMode': (settings, value) => ({
    ...settings,
    evolution: {
      ...settings.evolution,
      samplingMode: value,
    },
  }),
  'evolution.snapshotIntervalDays': (settings, value) => ({
    ...settings,
    evolution: {
      ...settings.evolution,
      snapshotIntervalDays: value,
    },
  }),
  'evolution.snapshotIntervalCommits': (settings, value) => ({
    ...settings,
    evolution: {
      ...settings.evolution,
      snapshotIntervalCommits: value,
    },
  }),
  'evolution.showInactivePeriods': (settings, value) => ({
    ...settings,
    evolution: {
      ...settings.evolution,
      showInactivePeriods: value,
    },
  }),
  'evolution.maxSnapshots': (settings, value) => ({
    ...settings,
    evolution: {
      ...settings.evolution,
      maxSnapshots: value,
    },
  }),
  'evolution.maxSeries': (settings, value) => ({
    ...settings,
    evolution: {
      ...settings.evolution,
      maxSeries: value,
    },
  }),
  'evolution.cohortFormat': (settings, value) => ({
    ...settings,
    evolution: {
      ...settings.evolution,
      cohortFormat: value,
    },
  }),
};

export function setScopedSettingValue<K extends RepoScopableSettingKey>(
  settings: ExtensionSettings,
  key: K,
  value: RepoScopableSettingValueMap[K]
): ExtensionSettings {
  return scopedSettingAppliers[key](settings, value);
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
    source: resolveScopedSettingSource({
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
    source: resolveScopedSettingSource({
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

export function applySettingsPatch(
  currentSettings: ExtensionSettings,
  nextSettings: Partial<ExtensionSettings>
): ExtensionSettings {
  return {
    ...currentSettings,
    ...nextSettings,
    tooltipSettings: nextSettings.tooltipSettings
      ? {
          ...currentSettings.tooltipSettings,
          ...nextSettings.tooltipSettings,
        }
      : currentSettings.tooltipSettings,
    treemap: nextSettings.treemap
      ? {
          ...currentSettings.treemap,
          ...nextSettings.treemap,
        }
      : currentSettings.treemap,
    evolution: nextSettings.evolution
      ? {
          ...currentSettings.evolution,
          ...nextSettings.evolution,
        }
      : currentSettings.evolution,
  };
}

export function createCoreAnalysisSettingsSnapshot(settings: ExtensionSettings): object {
  return {
    excludePatterns: sorted(settings.excludePatterns),
    maxCommitsToAnalyze: settings.maxCommitsToAnalyze,
    binaryExtensions: sorted(settings.binaryExtensions),
    locExcludedExtensions: sorted(settings.locExcludedExtensions),
  };
}

export function createEvolutionAnalysisSettingsSnapshot(settings: ExtensionSettings): object {
  return {
    excludePatterns: sorted(settings.excludePatterns),
    binaryExtensions: sorted(settings.binaryExtensions),
    evolution: {
      samplingMode: settings.evolution.samplingMode,
      snapshotIntervalDays: settings.evolution.snapshotIntervalDays,
      snapshotIntervalCommits: settings.evolution.snapshotIntervalCommits,
      maxSnapshots: settings.evolution.maxSnapshots,
      cohortFormat: settings.evolution.cohortFormat,
    },
  };
}

export function settingsAffectCoreAnalysis(
  currentSettings: ExtensionSettings,
  nextSettings: ExtensionSettings
): boolean {
  return JSON.stringify(createCoreAnalysisSettingsSnapshot(currentSettings)) !==
    JSON.stringify(createCoreAnalysisSettingsSnapshot(nextSettings));
}

export function settingsAffectEvolutionAnalysis(
  currentSettings: ExtensionSettings,
  nextSettings: ExtensionSettings
): boolean {
  return JSON.stringify(createEvolutionAnalysisSettingsSnapshot(currentSettings)) !==
    JSON.stringify(createEvolutionAnalysisSettingsSnapshot(nextSettings));
}

export function flattenSettingsUpdate(settings: Partial<ExtensionSettings>): SettingsUpdateEntry[] {
  const updates: SettingsUpdateEntry[] = [];

  if (settings.excludePatterns !== undefined) {
    updates.push({ key: 'excludePatterns', value: settings.excludePatterns });
  }
  if (settings.maxCommitsToAnalyze !== undefined) {
    updates.push({ key: 'maxCommitsToAnalyze', value: settings.maxCommitsToAnalyze });
  }
  if (settings.defaultColorMode !== undefined) {
    updates.push({ key: 'defaultColorMode', value: settings.defaultColorMode });
  }
  if (settings.generatedPatterns !== undefined) {
    updates.push({ key: 'generatedPatterns', value: settings.generatedPatterns });
  }
  if (settings.binaryExtensions !== undefined) {
    updates.push({ key: 'binaryExtensions', value: settings.binaryExtensions });
  }
  if (settings.locExcludedExtensions !== undefined) {
    updates.push({ key: 'locExcludedExtensions', value: settings.locExcludedExtensions });
  }
  if (settings.showEmptyTimePeriods !== undefined) {
    updates.push({ key: 'showEmptyTimePeriods', value: settings.showEmptyTimePeriods });
  }
  if (settings.defaultGranularityMode !== undefined) {
    updates.push({ key: 'defaultGranularityMode', value: settings.defaultGranularityMode });
  }
  if (settings.autoGranularityThreshold !== undefined) {
    updates.push({ key: 'autoGranularityThreshold', value: settings.autoGranularityThreshold });
  }
  if (settings.overviewDisplayMode !== undefined) {
    updates.push({ key: 'overviewDisplayMode', value: settings.overviewDisplayMode });
  }
  if (settings.tooltipSettings !== undefined) {
    updates.push({ key: 'tooltipSettings', value: settings.tooltipSettings });
  }
  if (settings.treemap !== undefined) {
    updates.push({ key: 'treemap.ageColorRangeMode', value: settings.treemap.ageColorRangeMode });
    updates.push({ key: 'treemap.ageColorNewestDate', value: settings.treemap.ageColorNewestDate });
    updates.push({ key: 'treemap.ageColorOldestDate', value: settings.treemap.ageColorOldestDate });
  }
  if (settings.evolution !== undefined) {
    updates.push({ key: 'evolution.autoRun', value: settings.evolution.autoRun });
    updates.push({ key: 'evolution.samplingMode', value: settings.evolution.samplingMode });
    updates.push({ key: 'evolution.snapshotIntervalDays', value: settings.evolution.snapshotIntervalDays });
    updates.push({ key: 'evolution.snapshotIntervalCommits', value: settings.evolution.snapshotIntervalCommits });
    updates.push({ key: 'evolution.showInactivePeriods', value: settings.evolution.showInactivePeriods });
    updates.push({ key: 'evolution.maxSnapshots', value: settings.evolution.maxSnapshots });
    updates.push({ key: 'evolution.maxSeries', value: settings.evolution.maxSeries });
    updates.push({ key: 'evolution.cohortFormat', value: settings.evolution.cohortFormat });
  }

  return updates;
}
