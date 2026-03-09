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

export function setScopedSettingValue<K extends RepoScopableSettingKey>(
  settings: ExtensionSettings,
  key: K,
  value: RepoScopableSettingValueMap[K]
): ExtensionSettings {
  switch (key) {
    case 'evolution.samplingMode':
      return {
        ...settings,
        evolution: {
          ...settings.evolution,
          samplingMode: value as ExtensionSettings['evolution']['samplingMode'],
        },
      };
    case 'evolution.snapshotIntervalDays':
      return {
        ...settings,
        evolution: {
          ...settings.evolution,
          snapshotIntervalDays: value as number,
        },
      };
    case 'evolution.snapshotIntervalCommits':
      return {
        ...settings,
        evolution: {
          ...settings.evolution,
          snapshotIntervalCommits: value as number,
        },
      };
    case 'evolution.showInactivePeriods':
      return {
        ...settings,
        evolution: {
          ...settings.evolution,
          showInactivePeriods: value as boolean,
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
    includeSubmodules: settings.includeSubmodules,
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
  if (settings.includeSubmodules !== undefined) {
    updates.push({ key: 'includeSubmodules', value: settings.includeSubmodules });
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
