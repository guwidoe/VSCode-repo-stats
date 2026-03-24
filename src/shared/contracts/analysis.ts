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
  lastModified?: string;
  binary?: boolean;
  repositoryId?: string;
  repositoryRelativePath?: string;
  children?: TreemapNode[];
  complexity?: number;
  commentLines?: number;
  blankLines?: number;
  blamedLines?: number;
  lineAgeAvgDays?: number;
  lineAgeMinDays?: number;
  lineAgeMaxDays?: number;
  topOwnerAuthor?: string;
  topOwnerEmail?: string;
  topOwnerLines?: number;
  topOwnerShare?: number;
  complexityAvg?: number;
  complexityMax?: number;
  fileCount?: number;
}

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

export interface AnalysisResult {
  target: AnalysisTargetInfo;
  repositories: AnalyzedRepositoryInfo[];
  contributors: ContributorStats[];
  codeFrequency: CodeFrequency[];
  commitAnalytics: CommitAnalytics;
  fileTree: TreemapNode;
  analyzedAt: string;
  analyzedCommitCount: number;
  maxCommitsLimit: number;
  limitReached: boolean;
  sccInfo: SccInfo;
  blameMetrics: BlameMetrics;
  diagnostics?: AnalysisDiagnostics;
}

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
  lastAnalyzed: number;
  data: AnalysisResult;
  blameFileCaches: Record<string, Record<string, BlameFileCacheEntry>>;
  fileLOC: Record<string, FileLOCEntry>;
}
