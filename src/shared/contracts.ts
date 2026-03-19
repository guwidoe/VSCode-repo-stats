/**
 * Shared Repo Stats contracts used by both the extension host and the webview.
 * Keep this file free of VS Code and Node-specific runtime dependencies.
 */

// ============================================================================
// Contributor Types
// ============================================================================

export interface WeeklyCommit {
  week: string; // ISO week format: "2025-W03"
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
  firstCommit: string; // ISO date string
  lastCommit: string; // ISO date string
  weeklyActivity: WeeklyCommit[];
}

// ============================================================================
// Code Frequency Types
// ============================================================================

export interface CodeFrequency {
  week: string; // ISO week format: "2025-W03"
  additions: number;
  deletions: number;
  netChange: number;
}

// ============================================================================
// Evolution Types
// ============================================================================

export type EvolutionDimension = 'cohort' | 'author' | 'ext' | 'dir' | 'domain';

export type EvolutionSamplingMode = 'time' | 'commit' | 'auto';

export interface EvolutionSnapshotPoint {
  /** Actual commit represented by this snapshot. */
  commitSha: string;
  /** 0-based position within the sampled commit history for the analyzed branch. */
  commitIndex: number;
  /** Total number of commits considered while building the evolution timeline. */
  totalCommitCount: number;
  /** ISO timestamp for the represented commit. */
  committedAt: string;
  /** How this snapshot was selected. */
  samplingMode: EvolutionSamplingMode;
  /** True when this point is synthetic/fill-forward rather than directly sampled. */
  synthetic?: boolean;
}

export interface EvolutionTimeSeriesData {
  /** Snapshot metadata aligned with the series columns. */
  snapshots?: EvolutionSnapshotPoint[];
  /** Convenience mirror of snapshot dates for charting APIs expecting x-arrays. */
  ts: string[];
  /** Series labels (e.g. author names, cohorts). */
  labels: string[];
  /** Series x snapshots matrix (same shape as labels x snapshots). */
  y: number[][];
}

export interface EvolutionDiagnostics {
  expectedBlameMisses: number;
}

export interface EvolutionTargetHead {
  repositoryId: string;
  repositoryName: string;
  branch: string;
  headSha: string;
}

export interface EvolutionResult {
  generatedAt: string; // ISO date string
  targetId: string;
  historyMode: 'singleBranch' | 'mergedMembers';
  revisionHash: string;
  settingsHash: string;
  memberHeads: EvolutionTargetHead[];
  cohorts: EvolutionTimeSeriesData;
  authors: EvolutionTimeSeriesData;
  exts: EvolutionTimeSeriesData;
  dirs: EvolutionTimeSeriesData;
  domains: EvolutionTimeSeriesData;
  diagnostics?: EvolutionDiagnostics;
}

export type EvolutionStatus = 'idle' | 'loading' | 'ready' | 'error' | 'stale';
export type EvolutionProgressStage = 'preparing' | 'sampling' | 'analyzing' | 'finalizing';

// ============================================================================
// Treemap Types
// ============================================================================

export interface TreemapNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  lines?: number;
  bytes?: number;
  language?: string;
  lastModified?: string; // ISO date string from git history
  binary?: boolean; // True for non-code files (images, fonts, etc.)
  repositoryId?: string;
  repositoryRelativePath?: string;
  children?: TreemapNode[];

  // Extended scc metrics
  complexity?: number; // Cyclomatic complexity (file: total, folder: sum)
  commentLines?: number; // Comment line count
  blankLines?: number; // Blank line count

  // File-level blame metrics (present on files, undefined for folders)
  blamedLines?: number; // Number of lines counted by git blame
  lineAgeAvgDays?: number; // Weighted average age of lines (days)
  lineAgeMinDays?: number; // Youngest line age (days)
  lineAgeMaxDays?: number; // Oldest line age (days)
  topOwnerAuthor?: string; // Author with most owned lines in this file
  topOwnerEmail?: string; // Email of top owner
  topOwnerLines?: number; // Owned lines of top owner
  topOwnerShare?: number; // topOwnerLines / blamedLines (0..1)

  // Folder-only aggregates (undefined for files)
  complexityAvg?: number; // Average complexity per file in subtree
  complexityMax?: number; // Maximum file complexity in subtree
  fileCount?: number; // Number of files in subtree
}

// ============================================================================
// Analysis Result Types
// ============================================================================

export interface RepositoryInfo {
  name: string;
  path: string;
  branch: string;
  commitCount: number;
  headSha: string;
}

export type RepositorySource = 'workspace' | 'bookmarked';

export interface RepositoryOption {
  path: string;
  name: string;
  source: RepositorySource;
  workspaceFolderName?: string;
  relativePath?: string;
}

export type AnalysisTargetKind = 'repository' | 'repositoryWithSubmodules' | 'workspace';
export type AnalysisTargetMemberRole = 'primary' | 'submodule' | 'workspaceRepo';

export interface AnalysisTargetMember {
  id: string;
  role: AnalysisTargetMemberRole;
  repoPath: string;
  displayName: string;
  logicalRoot: string;
  pathPrefix: string;
  workspaceFolderName?: string;
  excludePatterns?: string[];
}

export interface AnalysisTarget {
  id: string;
  kind: AnalysisTargetKind;
  label: string;
  description?: string;
  members: AnalysisTargetMember[];
  settingsScope: 'repo' | 'workspace';
  settingsPath?: string;
}

export interface AnalysisTargetOption {
  id: string;
  kind: AnalysisTargetKind;
  label: string;
  description?: string;
  memberCount: number;
  settingsScope: 'repo' | 'workspace';
}

export interface AnalysisTargetInfo {
  id: string;
  kind: AnalysisTargetKind;
  label: string;
  memberCount: number;
}

export interface AnalyzedRepositoryInfo extends RepositoryInfo {
  id: string;
  role: AnalysisTargetMemberRole;
  logicalRoot: string;
  pathPrefix: string;
}

export interface SccInfo {
  version: string;
  source: 'system' | 'downloaded' | 'mixed' | 'none';
}

export interface AnalysisDiagnostics {
  repositoriesLimited: Array<{
    repositoryId: string;
    repositoryName: string;
    analyzedCommitCount: number;
    commitCount: number;
  }>;
}

export interface BlameOwnershipEntry {
  author: string;
  email: string;
  lines: number;
}

export interface BlameMetrics {
  analyzedAt: string; // ISO date string
  maxAgeDays: number;
  ageByDay: number[]; // ageByDay[days] = LOC
  ownershipByAuthor: BlameOwnershipEntry[];
  totals: {
    totalBlamedLines: number;
    filesAnalyzed: number;
    filesSkipped: number;
    cacheHits: number;
  };
}

export interface BlameFileCacheEntry {
  blobSha: string;
  totalLines: number;
  ageCounts: Array<[number, number]>;
  ownership: BlameOwnershipEntry[];
  minAgeDays: number;
  maxAgeDays: number;
  avgAgeDays: number;
  topOwnerAuthor: string;
  topOwnerEmail: string;
  topOwnerLines: number;
  topOwnerShare: number;
}

export interface AnalysisResult {
  target: AnalysisTargetInfo;
  repositories: AnalyzedRepositoryInfo[];
  contributors: ContributorStats[];
  codeFrequency: CodeFrequency[];
  commitAnalytics: CommitAnalytics;
  fileTree: TreemapNode;
  analyzedAt: string; // ISO date string
  // Limit tracking - shows warning when data may be incomplete
  analyzedCommitCount: number;
  maxCommitsLimit: number;
  limitReached: boolean;
  // SCC tool info
  sccInfo: SccInfo;
  // HEAD-only blame metrics for current line ownership/age
  blameMetrics: BlameMetrics;
  diagnostics?: AnalysisDiagnostics;
}

// ============================================================================
// Commit Analytics Types
// ============================================================================

export interface CommitAuthorDirectory {
  idByEmail: Record<string, number>;
  namesById: string[];
  emailsById: string[];
}

export interface CommitRecord {
  sha: string;
  repositoryId: string;
  authorId: number;
  committedAt: string;
  timestamp: number;
  summary: string;
  additions: number;
  deletions: number;
  changedLines: number;
  filesChanged: number;
}

export interface CommitStatBucket {
  minInclusive: number;
  maxInclusive: number;
  count: number;
}

export type CommitSortField = 'timestamp' | 'additions' | 'deletions' | 'changedLines' | 'filesChanged';
export type CommitSortDirection = 'asc' | 'desc';

export interface CommitAnalyticsQuery {
  authorIds?: number[];
  messageText?: string;
  committedAfter?: string;
  committedBefore?: string;
  minAdditions?: number;
  maxAdditions?: number;
  minDeletions?: number;
  maxDeletions?: number;
  minChangedLines?: number;
  maxChangedLines?: number;
  minFilesChanged?: number;
  maxFilesChanged?: number;
  sortBy?: CommitSortField;
  sortDirection?: CommitSortDirection;
  offset?: number;
  limit?: number;
}

export interface CommitMetricSummary {
  totalCommits: number;
  totalAdditions: number;
  totalDeletions: number;
  totalChangedLines: number;
  averageChangedLines: number;
  medianChangedLines: number;
  averageFilesChanged: number;
}

export interface CommitContributorSummary extends CommitMetricSummary {
  authorId: number;
  authorName: string;
  authorEmail: string;
}

export interface CommitIndexRanges {
  byTimestampAsc: number[];
  byAdditionsDesc: number[];
  byDeletionsDesc: number[];
  byChangedLinesDesc: number[];
  byFilesChangedDesc: number[];
}

export interface CommitAnalytics {
  authorDirectory: CommitAuthorDirectory;
  records: CommitRecord[];
  summary: CommitMetricSummary;
  contributorSummaries: CommitContributorSummary[];
  changedLineBuckets: CommitStatBucket[];
  fileChangeBuckets: CommitStatBucket[];
  indexes: CommitIndexRanges;
}

// ============================================================================
// Cache Types
// ============================================================================

export interface FileLOCEntry {
  sha: string;
  lines: number;
  language: string;
}

export interface CacheStructure {
  version: string;
  targetId: string;
  revisionHash: string;
  settingsHash?: string;
  lastAnalyzed: number; // timestamp
  data: AnalysisResult;
  blameFileCaches: Record<string, Record<string, BlameFileCacheEntry>>;
  fileLOC: Record<string, FileLOCEntry>;
}

// ============================================================================
// Message Types (Extension <-> Webview Communication)
// ============================================================================

export type ExtensionMessage =
  | { type: 'analysisStarted' }
  | { type: 'analysisProgress'; phase: string; progress: number }
  | { type: 'analysisComplete'; data: AnalysisResult }
  | { type: 'analysisError'; error: string }
  | {
      type: 'repositorySelectionLoaded';
      repositories: RepositoryOption[];
      selectedRepositoryIds: string[];
      selectedTarget: AnalysisTargetOption | null;
    }
  | { type: 'incrementalUpdate'; data: Partial<AnalysisResult> }
  | { type: 'evolutionStarted' }
  | {
      type: 'evolutionProgress';
      phase: string;
      progress: number;
      stage: EvolutionProgressStage;
      currentRepositoryLabel?: string;
      currentRepositoryIndex?: number;
      totalRepositories?: number;
      currentSnapshotIndex?: number;
      totalSnapshots?: number;
      etaSeconds?: number;
    }
  | { type: 'evolutionComplete'; data: EvolutionResult }
  | { type: 'evolutionError'; error: string }
  | { type: 'evolutionStale'; reason: string }
  | { type: 'stalenessStatus'; coreStale: boolean; evolutionStale: boolean }
  | {
      type: 'settingsLoaded';
      settings: ExtensionSettings;
      scopedSettings: RepoScopedSettings;
      repoScopeAvailable: boolean;
    };

export type WebviewMessage =
  | { type: 'requestAnalysis' }
  | { type: 'requestRefresh' }
  | { type: 'requestEvolutionAnalysis' }
  | { type: 'requestEvolutionRefresh' }
  | { type: 'checkStaleness' }
  | { type: 'updateRepositorySelection'; repositoryIds: string[] }
  | { type: 'openFile'; path: string; repositoryId?: string }
  | { type: 'revealInExplorer'; path: string; repositoryId?: string }
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
