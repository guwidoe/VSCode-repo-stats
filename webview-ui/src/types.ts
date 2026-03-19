/**
 * Webview type entrypoint.
 * Shared contracts live in `src/shared/contracts.ts`; webview-only UI state types stay here.
 */

import type { EvolutionProgressStage } from '../../src/shared/contracts';

export type {
  AnalysisResult,
  AnalysisTargetOption,
  BlameFileCacheEntry,
  BlameMetrics,
  BlameOwnershipEntry,
  CacheStructure,
  CodeFrequency,
  CommitAnalytics,
  CommitAnalyticsQuery,
  CommitAuthorDirectory,
  CommitContributorSummary,
  CommitIndexRanges,
  CommitMetricSummary,
  CommitRecord,
  CommitSortDirection,
  CommitSortField,
  CommitStatBucket,
  ContributorStats,
  EvolutionDiagnostics,
  EvolutionDimension,
  EvolutionResult,
  EvolutionSamplingMode,
  EvolutionSettings,
  EvolutionSnapshotPoint,
  EvolutionStatus,
  EvolutionProgressStage,
  EvolutionTimeSeriesData,
  ExtensionMessage,
  ExtensionSettings,
  FileLOCEntry,
  RepoScopableSettingKey,
  RepoScopableSettingValueMap,
  RepoScopedSettings,
  RepositoryInfo,
  RepositoryOption,
  SccInfo,
  ScopedSettingSource,
  ScopedSettingValue,
  SettingWriteTarget,
  TooltipSettings,
  TreemapAgeColorRangeMode,
  TreemapNode,
  TreemapSettings,
  WebviewMessage,
  WeeklyCommit,
} from '../../src/shared/contracts';

export { REPO_SCOPABLE_SETTING_KEYS } from '../../src/shared/contracts';

// ============================================================================
// UI State Types
// ============================================================================

export type ViewType = 'overview' | 'files' | 'contributors' | 'commits' | 'frequency' | 'evolution' | 'treemap' | 'settings' | 'about';

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
  stage?: EvolutionProgressStage;
  currentRepositoryLabel?: string;
  currentRepositoryIndex?: number;
  totalRepositories?: number;
  currentSnapshotIndex?: number;
  totalSnapshots?: number;
  etaSeconds?: number;
}
