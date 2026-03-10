import type { ExtensionSettings } from '../types/index.js';

export interface AnalysisBenchmarkTarget {
  name: string;
  description: string;
  fixture: GeneratedRepoFixtureSpec;
  settings?: Partial<ExtensionSettings>;
}

export interface GeneratedRepoFixtureSpec {
  seed: number;
  commitCount: number;
  initialFileCount: number;
  filesTouchedPerCommit: number;
  maxLinesPerMutation: number;
  createFileEvery: number;
  maxGeneratedFiles: number;
  includeBinaryFiles: number;
}

export const DEFAULT_BENCHMARK_SETTINGS: ExtensionSettings = {
  excludePatterns: [],
  maxCommitsToAnalyze: 25_000,
  defaultColorMode: 'language',
  generatedPatterns: [
    '**/generated/**',
    '**/gen/**',
    '**/__generated__/**',
    '**/dist/**',
    '**/build/**',
    '**/*.generated.*',
    '**/*.min.js',
    '**/*.min.css',
    '**/package-lock.json',
  ],
  binaryExtensions: ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.woff', '.woff2'],
  locExcludedExtensions: [],
  includeSubmodules: false,
  showEmptyTimePeriods: true,
  defaultGranularityMode: 'auto',
  autoGranularityThreshold: 20,
  overviewDisplayMode: 'percent',
  tooltipSettings: {
    showLinesOfCode: true,
    showFileSize: true,
    showLanguage: true,
    showLastModified: true,
    showComplexity: false,
    showCommentLines: false,
    showCommentRatio: false,
    showBlankLines: false,
    showCodeDensity: false,
    showFileCount: true,
  },
  treemap: {
    ageColorRangeMode: 'auto',
    ageColorNewestDate: '',
    ageColorOldestDate: '',
  },
  evolution: {
    autoRun: false,
    samplingMode: 'time',
    snapshotIntervalDays: 30,
    snapshotIntervalCommits: 100,
    showInactivePeriods: false,
    maxSnapshots: 80,
    maxSeries: 20,
    cohortFormat: '%Y',
  },
};

export const ANALYSIS_BENCHMARK_TARGETS: AnalysisBenchmarkTarget[] = [
  {
    name: 'synthetic-small',
    description: 'Small deterministic repo with light history churn',
    fixture: {
      seed: 11,
      commitCount: 180,
      initialFileCount: 36,
      filesTouchedPerCommit: 4,
      maxLinesPerMutation: 5,
      createFileEvery: 18,
      maxGeneratedFiles: 12,
      includeBinaryFiles: 4,
    },
  },
  {
    name: 'synthetic-medium',
    description: 'Medium deterministic repo sized for everyday regression comparisons',
    fixture: {
      seed: 23,
      commitCount: 720,
      initialFileCount: 96,
      filesTouchedPerCommit: 8,
      maxLinesPerMutation: 9,
      createFileEvery: 14,
      maxGeneratedFiles: 24,
      includeBinaryFiles: 10,
    },
  },
  {
    name: 'synthetic-large',
    description: 'Larger deterministic repo that stresses git history, LOC, and blame phases',
    fixture: {
      seed: 37,
      commitCount: 1_800,
      initialFileCount: 180,
      filesTouchedPerCommit: 14,
      maxLinesPerMutation: 14,
      createFileEvery: 10,
      maxGeneratedFiles: 40,
      includeBinaryFiles: 16,
    },
  },
];

export function getAnalysisBenchmarkTarget(name: string): AnalysisBenchmarkTarget {
  const target = ANALYSIS_BENCHMARK_TARGETS.find((entry) => entry.name === name);
  if (!target) {
    throw new Error(`Unknown benchmark target: ${name}`);
  }
  return target;
}

export function resolveBenchmarkSettings(
  overrides: Partial<ExtensionSettings> | undefined,
  maxCommitsOverride?: number
): ExtensionSettings {
  const settings: ExtensionSettings = {
    ...DEFAULT_BENCHMARK_SETTINGS,
    ...overrides,
    tooltipSettings: {
      ...DEFAULT_BENCHMARK_SETTINGS.tooltipSettings,
      ...(overrides?.tooltipSettings ?? {}),
    },
    treemap: {
      ...DEFAULT_BENCHMARK_SETTINGS.treemap,
      ...(overrides?.treemap ?? {}),
    },
    evolution: {
      ...DEFAULT_BENCHMARK_SETTINGS.evolution,
      ...(overrides?.evolution ?? {}),
    },
  };

  if (maxCommitsOverride !== undefined) {
    settings.maxCommitsToAnalyze = maxCommitsOverride;
  }

  return settings;
}
