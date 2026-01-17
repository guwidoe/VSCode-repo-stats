/**
 * Statistics for a single contributor
 */
export interface ContributorStats {
  name: string;
  email: string;
  avatarUrl?: string;
  commits: number;
  linesAdded: number;
  linesDeleted: number;
  firstCommit: Date;
  lastCommit: Date;
  weeklyActivity: WeeklyCommit[];
}

/**
 * Weekly commit activity
 */
export interface WeeklyCommit {
  week: string; // ISO week (2025-W03)
  commits: number;
  additions: number;
  deletions: number;
}

/**
 * Code frequency data for a time period
 */
export interface CodeFrequency {
  week: string; // ISO week
  additions: number;
  deletions: number;
  netChange: number;
}

/**
 * Node in the treemap hierarchy
 */
export interface TreemapNode {
  name: string; // File or directory name
  path: string; // Full path from repo root
  type: 'file' | 'directory';
  lines?: number; // LOC (files only)
  language?: string; // Detected language
  lastModified?: Date; // For age-based coloring
  children?: TreemapNode[];
}

/**
 * Cache structure for persisted data
 */
export interface CacheStructure {
  version: string; // Cache schema version
  repoPath: string;
  lastCommitSha: string; // HEAD SHA for invalidation
  lastAnalyzed: number; // Timestamp
  contributors: ContributorStats[];
  codeFrequency: CodeFrequency[];
  fileTree: TreemapNode;
  fileLOC: Record<
    string,
    {
      sha: string; // File blob SHA
      lines: number;
      language: string;
    }
  >;
}

/**
 * Analysis result returned to the webview
 */
export interface AnalysisResult {
  contributors: ContributorStats[];
  codeFrequency: CodeFrequency[];
  treemap: TreemapNode;
  repoInfo: {
    name: string;
    branch: string;
    totalCommits: number;
    totalFiles: number;
    totalLines: number;
  };
}

/**
 * Message types for extension <-> webview communication
 */
export type ExtensionMessage =
  | { type: 'dataUpdate'; payload: AnalysisResult }
  | { type: 'loading'; payload: boolean }
  | { type: 'error'; payload: string };

export type WebviewMessage =
  | { type: 'requestData'; payload?: { timeRange?: string } }
  | { type: 'openFile'; payload: { path: string } }
  | { type: 'refresh' };
