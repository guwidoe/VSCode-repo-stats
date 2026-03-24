import type { EvolutionSamplingMode } from './evolution.js';

export interface TooltipSettings {
  showLinesOfCode: boolean;
  showFileSize: boolean;
  showLanguage: boolean;
  showLastModified: boolean;
  showComplexity: boolean;
  showCommentLines: boolean;
  showCommentRatio: boolean;
  showBlankLines: boolean;
  showCodeDensity: boolean;
  showFileCount: boolean;
}

export interface EvolutionSettings {
  autoRun: boolean;
  samplingMode: EvolutionSamplingMode;
  snapshotIntervalDays: number;
  snapshotIntervalCommits: number;
  showInactivePeriods: boolean;
  maxSnapshots: number;
  maxSeries: number;
  cohortFormat: string;
}

export type TreemapAgeColorRangeMode = 'auto' | 'custom';

export interface TreemapSettings {
  ageColorRangeMode: TreemapAgeColorRangeMode;
  ageColorNewestDate: string;
  ageColorOldestDate: string;
}

export interface ExtensionSettings {
  excludePatterns: string[];
  maxCommitsToAnalyze: number;
  defaultColorMode: 'language' | 'age' | 'complexity' | 'density';
  generatedPatterns: string[];
  binaryExtensions: string[];
  locExcludedExtensions: string[];
  showEmptyTimePeriods: boolean;
  defaultGranularityMode: 'auto' | 'weekly' | 'monthly';
  autoGranularityThreshold: number;
  overviewDisplayMode: 'percent' | 'count';
  tooltipSettings: TooltipSettings;
  treemap: TreemapSettings;
  evolution: EvolutionSettings;
}

export interface RepoScopableSettingValueMap {
  excludePatterns: string[];
  generatedPatterns: string[];
  binaryExtensions: string[];
  locExcludedExtensions: string[];
  maxCommitsToAnalyze: number;
  'evolution.samplingMode': EvolutionSamplingMode;
  'evolution.snapshotIntervalDays': number;
  'evolution.snapshotIntervalCommits': number;
  'evolution.showInactivePeriods': boolean;
  'evolution.maxSnapshots': number;
  'evolution.maxSeries': number;
  'evolution.cohortFormat': string;
}

export const REPO_SCOPABLE_SETTING_KEYS = [
  'excludePatterns',
  'generatedPatterns',
  'binaryExtensions',
  'locExcludedExtensions',
  'maxCommitsToAnalyze',
  'evolution.samplingMode',
  'evolution.snapshotIntervalDays',
  'evolution.snapshotIntervalCommits',
  'evolution.showInactivePeriods',
  'evolution.maxSnapshots',
  'evolution.maxSeries',
  'evolution.cohortFormat',
] as const satisfies readonly (keyof RepoScopableSettingValueMap)[];

export type RepoScopableSettingKey = keyof RepoScopableSettingValueMap;
export type SettingWriteTarget = 'global' | 'repo';
export type ScopedSettingSource = 'default' | 'global' | 'repo';

export interface ScopedSettingValue<T> {
  defaultValue: T;
  globalValue?: T;
  repoValue?: T;
  source: ScopedSettingSource;
}

export type RepoScopedSettings = {
  [K in RepoScopableSettingKey]: ScopedSettingValue<RepoScopableSettingValueMap[K]>;
};
