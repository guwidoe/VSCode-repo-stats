/**
 * Core type definitions for the Repo Stats extension.
 * These types are VSCode-independent and used by both extension and webview.
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
// Treemap Types
// ============================================================================

export interface TreemapNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  lines?: number;
  language?: string;
  lastModified?: string; // ISO date string
  children?: TreemapNode[];
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

export interface SccInfo {
  version: string;
  source: 'system' | 'downloaded' | 'none';
}

export interface AnalysisResult {
  repository: RepositoryInfo;
  contributors: ContributorStats[];
  codeFrequency: CodeFrequency[];
  fileTree: TreemapNode;
  analyzedAt: string; // ISO date string
  // Limit tracking - shows warning when data may be incomplete
  analyzedCommitCount: number;
  maxCommitsLimit: number;
  limitReached: boolean;
  // SCC tool info
  sccInfo: SccInfo;
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
  repoPath: string;
  lastCommitSha: string;
  lastAnalyzed: number; // timestamp
  contributors: ContributorStats[];
  codeFrequency: CodeFrequency[];
  fileTree: TreemapNode;
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
// Settings Types
// ============================================================================

export interface ExtensionSettings {
  excludePatterns: string[];
  maxCommitsToAnalyze: number;
  defaultColorMode: 'language' | 'age';
  generatedPatterns: string[];
}

// ============================================================================
// Error Types
// ============================================================================

export class RepoStatsError extends Error {
  constructor(
    message: string,
    public readonly code: string
  ) {
    super(message);
    this.name = 'RepoStatsError';
  }
}

export class NotAGitRepoError extends RepoStatsError {
  constructor(path: string) {
    super(`"${path}" is not a Git repository`, 'NOT_GIT_REPO');
    this.name = 'NotAGitRepoError';
  }
}

export class GitNotFoundError extends RepoStatsError {
  constructor() {
    super('Git is not installed or not in PATH', 'GIT_NOT_FOUND');
    this.name = 'GitNotFoundError';
  }
}

export class SccNotFoundError extends RepoStatsError {
  constructor() {
    super(
      'scc binary not found and auto-download failed. ' +
        'Please install scc manually: https://github.com/boyter/scc#install',
      'SCC_NOT_FOUND'
    );
    this.name = 'SccNotFoundError';
  }
}
