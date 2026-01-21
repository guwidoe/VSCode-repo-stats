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

export interface TreemapNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  lines?: number;
  bytes?: number;
  language?: string;
  lastModified?: string; // ISO date string from git history
  children?: TreemapNode[];
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
}

// ============================================================================
// Settings Types
// ============================================================================

export interface ExtensionSettings {
  excludePatterns: string[];
  maxCommitsToAnalyze: number;
  defaultColorMode: 'language' | 'age';
  generatedPatterns: string[];
}

// ============================================================================
// Message Types
// ============================================================================

export type ExtensionMessage =
  | { type: 'analysisStarted' }
  | { type: 'analysisProgress'; phase: string; progress: number }
  | { type: 'analysisComplete'; data: AnalysisResult }
  | { type: 'analysisError'; error: string }
  | { type: 'incrementalUpdate'; data: Partial<AnalysisResult> }
  | { type: 'settingsLoaded'; settings: ExtensionSettings };

export type WebviewMessage =
  | { type: 'requestAnalysis' }
  | { type: 'requestRefresh' }
  | { type: 'openFile'; path: string }
  | { type: 'revealInExplorer'; path: string }
  | { type: 'copyPath'; path: string }
  | { type: 'getSettings' }
  | { type: 'updateSettings'; settings: Partial<ExtensionSettings> };

// ============================================================================
// UI State Types
// ============================================================================

export type ViewType = 'overview' | 'contributors' | 'frequency' | 'treemap' | 'settings';

export type TimePeriod = 'all' | 'year' | '6months' | '3months' | 'month';

export type FrequencyGranularity = 'weekly' | 'monthly';

export type ColorMode = 'language' | 'age';

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
