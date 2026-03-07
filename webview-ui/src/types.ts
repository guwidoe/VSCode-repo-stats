/**
 * Shared types for the webview UI.
 * These mirror the extension types for message passing.
 */

// ============================================================================
// Data Types
// ============================================================================

export interface WeeklyCommit {
  week: string;
  commits: number;
  additions: number;
  deletions: number;
}

export interface ContributorStats {
  name: string;
  email: string;
  avatarUrl?: string;
  commits: number;
  linesAdded: number;
  linesDeleted: number;
  firstCommit: string;
  lastCommit: string;
  weeklyActivity: WeeklyCommit[];
}

export interface CodeFrequency {
  week: string;
  additions: number;
  deletions: number;
  netChange: number;
}

export type EvolutionDimension = 'cohort' | 'author' | 'ext' | 'dir' | 'domain';

export interface EvolutionTimeSeriesData {
  ts: string[];
  labels: string[];
  y: number[][];
}

export interface EvolutionDiagnostics {
  expectedBlameMisses: number;
}

export interface EvolutionResult {
  generatedAt: string;
  headSha: string;
  branch: string;
  settingsHash: string;
  cohorts: EvolutionTimeSeriesData;
  authors: EvolutionTimeSeriesData;
  exts: EvolutionTimeSeriesData;
  dirs: EvolutionTimeSeriesData;
  domains: EvolutionTimeSeriesData;
  diagnostics?: EvolutionDiagnostics;
}

export type EvolutionStatus = 'idle' | 'loading' | 'ready' | 'error' | 'stale';

export interface TreemapNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  lines?: number;
  bytes?: number;
  language?: string;
  lastModified?: string; // ISO date string from git history
  binary?: boolean; // True for non-code files (images, fonts, etc.)
  children?: TreemapNode[];

  // Extended scc metrics
  complexity?: number; // Cyclomatic complexity (file: total, folder: sum)
  commentLines?: number; // Comment line count
  blankLines?: number; // Blank line count

  // File-level blame metrics (present on files, undefined for folders)
  blamedLines?: number;
  lineAgeAvgDays?: number;
  lineAgeMinDays?: number;
  lineAgeMaxDays?: number;
  topOwnerAuthor?: string;
  topOwnerEmail?: string;
  topOwnerLines?: number;
  topOwnerShare?: number;

  // Folder-only aggregates (undefined for files)
  complexityAvg?: number; // Average complexity per file in subtree
  complexityMax?: number; // Maximum file complexity in subtree
  fileCount?: number; // Number of files in subtree
}

export interface RepositoryInfo {
  name: string;
  path: string;
  branch: string;
  commitCount: number;
  headSha: string;
}

export interface SccInfo {
  version: string;
  source: 'system' | 'downloaded' | 'none';
}

export interface SubmoduleInfo {
  paths: string[];
  count: number;
}

export interface BlameOwnershipEntry {
  author: string;
  email: string;
  lines: number;
}

export interface BlameMetrics {
  analyzedAt: string;
  maxAgeDays: number;
  ageByDay: number[];
  ownershipByAuthor: BlameOwnershipEntry[];
  totals: {
    totalBlamedLines: number;
    filesAnalyzed: number;
    filesSkipped: number;
    cacheHits: number;
  };
}

export interface AnalysisResult {
  repository: RepositoryInfo;
  contributors: ContributorStats[];
  codeFrequency: CodeFrequency[];
  fileTree: TreemapNode;
  analyzedAt: string;
  // Limit tracking - shows warning when data may be incomplete
  analyzedCommitCount: number;
  maxCommitsLimit: number;
  limitReached: boolean;
  // SCC tool info
  sccInfo: SccInfo;
  // HEAD-only blame metrics for current line ownership/age
  blameMetrics: BlameMetrics;
  // Detected submodule info
  submodules?: SubmoduleInfo;
}

// ============================================================================
// Settings Types
// ============================================================================

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
  snapshotIntervalDays: number;
  maxSnapshots: number;
  maxSeries: number;
  cohortFormat: string;
}

export interface ExtensionSettings {
  excludePatterns: string[];
  maxCommitsToAnalyze: number;
  defaultColorMode: 'language' | 'age' | 'complexity' | 'density';
  generatedPatterns: string[];
  binaryExtensions: string[];
  locExcludedExtensions: string[];
  includeSubmodules: boolean;
  showEmptyTimePeriods: boolean;
  defaultGranularityMode: 'auto' | 'weekly' | 'monthly';
  autoGranularityThreshold: number; // Weeks threshold for auto mode (default 20)
  // Overview settings
  overviewDisplayMode: 'percent' | 'count'; // Default display mode for donut charts
  // Treemap tooltip settings
  tooltipSettings: TooltipSettings;
  // Evolution settings (on-demand analysis)
  evolution: EvolutionSettings;
}

export interface RepoScopableSettingValueMap {
  excludePatterns: string[];
  generatedPatterns: string[];
  binaryExtensions: string[];
  locExcludedExtensions: string[];
  includeSubmodules: boolean;
  maxCommitsToAnalyze: number;
  'evolution.snapshotIntervalDays': number;
  'evolution.maxSnapshots': number;
  'evolution.maxSeries': number;
  'evolution.cohortFormat': string;
}

export const REPO_SCOPABLE_SETTING_KEYS = [
  'excludePatterns',
  'generatedPatterns',
  'binaryExtensions',
  'locExcludedExtensions',
  'includeSubmodules',
  'maxCommitsToAnalyze',
  'evolution.snapshotIntervalDays',
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

// ============================================================================
// Message Types
// ============================================================================

export type ExtensionMessage =
  | { type: 'analysisStarted' }
  | { type: 'analysisProgress'; phase: string; progress: number }
  | { type: 'analysisComplete'; data: AnalysisResult }
  | { type: 'analysisError'; error: string }
  | { type: 'incrementalUpdate'; data: Partial<AnalysisResult> }
  | { type: 'evolutionStarted' }
  | { type: 'evolutionProgress'; phase: string; progress: number }
  | { type: 'evolutionComplete'; data: EvolutionResult }
  | { type: 'evolutionError'; error: string }
  | { type: 'evolutionStale'; reason: string }
  | { type: 'stalenessStatus'; coreStale: boolean; evolutionStale: boolean }
  | { type: 'settingsLoaded'; settings: ExtensionSettings; scopedSettings: RepoScopedSettings };

export type WebviewMessage =
  | { type: 'requestAnalysis' }
  | { type: 'requestRefresh' }
  | { type: 'requestEvolutionAnalysis' }
  | { type: 'requestEvolutionRefresh' }
  | { type: 'checkStaleness' }
  | { type: 'openFile'; path: string }
  | { type: 'revealInExplorer'; path: string }
  | { type: 'copyPath'; path: string }
  | { type: 'getSettings' }
  | { type: 'updateSettings'; settings: Partial<ExtensionSettings>; target?: SettingWriteTarget }
  | {
      type: 'updateScopedSetting';
      key: RepoScopableSettingKey;
      value: RepoScopableSettingValueMap[RepoScopableSettingKey];
      target: SettingWriteTarget;
    }
  | { type: 'resetScopedSetting'; key: RepoScopableSettingKey };

// ============================================================================
// UI State Types
// ============================================================================

export type ViewType = 'overview' | 'files' | 'contributors' | 'frequency' | 'evolution' | 'treemap' | 'settings' | 'about';

export type TimePeriod = 'all' | 'year' | '6months' | '3months' | 'month';

export type FrequencyGranularity = 'weekly' | 'monthly';

export type ColorMode = 'language' | 'age' | 'complexity' | 'density';

export type TreemapFilterPreset = 'all' | 'hide-binary' | 'code-only' | 'custom';

export interface TreemapFilterState {
  preset: TreemapFilterPreset;
  selectedLanguages: Set<string>;
}

export interface LoadingState {
  isLoading: boolean;
  phase: string;
  progress: number;
}
