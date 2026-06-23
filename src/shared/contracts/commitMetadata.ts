export type CommitMetadataBuiltInExtractorId =
  | 'conventionalType'
  | 'conventionalScope'
  | 'bracketTag'
  | 'hashTag'
  | 'issueKey'
  | 'author'
  | 'repository'
  | 'commitSize'
  | 'fileCount'
  | 'directory'
  | 'fileExtension';

export type CommitMetadataExtractorKind = 'builtIn' | 'regex';
export type CommitMetadataNormalization = 'none' | 'lowercase' | 'uppercase';
export type CommitMetadataUnmatchedMode = 'exclude' | 'include';
export type CommitMetadataMultiValueMode = 'countEach' | 'split' | 'first';
export type CommitMetadataBucketMode = 'calendar' | 'commitCount';
export type CommitMetadataCalendarGranularity = 'day' | 'week' | 'month' | 'quarter' | 'year';
export type CommitMetadataCommitBucketStrategy = 'fixedSize' | 'equalBuckets';
export type CommitMetadataMetric = 'commits' | 'additions' | 'deletions' | 'changedLines' | 'filesChanged';
export type CommitMetadataChartType = 'stackedBar' | 'normalizedStackedBar' | 'heatmap';
export type CommitMetadataAvailability = 'available' | 'partial' | 'unavailable';

export interface CommitMetadataExtractorBase {
  id: string;
  name: string;
  enabled: boolean;
  dimension: string;
  includeUnmatched: boolean;
  unmatchedValue: string;
  aliases: Record<string, string>;
}

export interface CommitMetadataBuiltInExtractorConfig extends CommitMetadataExtractorBase {
  kind: 'builtIn';
  builtInId: CommitMetadataBuiltInExtractorId;
}

export interface CommitMetadataRegexExtractorConfig extends CommitMetadataExtractorBase {
  kind: 'regex';
  regex: string;
  flags: string;
  captureGroup: string;
  normalization: CommitMetadataNormalization;
}

export type CommitMetadataExtractorConfig =
  | CommitMetadataBuiltInExtractorConfig
  | CommitMetadataRegexExtractorConfig;

export interface CommitMetadataSettings {
  extractors: CommitMetadataExtractorConfig[];
  defaultExtractorId: string;
  defaultBucketMode: CommitMetadataBucketMode;
  defaultCalendarGranularity: CommitMetadataCalendarGranularity;
  defaultCommitBucketStrategy: CommitMetadataCommitBucketStrategy;
  defaultCommitBucketSize: number;
  defaultCommitBucketCount: number;
  defaultMetric: CommitMetadataMetric;
  defaultChartType: CommitMetadataChartType;
  multiValueMode: CommitMetadataMultiValueMode;
  includeUncategorized: boolean;
  maxSeries: number;
  includeOtherSeries: boolean;
}

export interface CommitMetadataFact {
  commitSha: string;
  extractorId: string;
  dimension: string;
  value: string;
  weight: number;
}

export interface CommitMetadataBucket {
  id: string;
  label: string;
  mode: CommitMetadataBucketMode;
  startDate?: string;
  endDate?: string;
  startCommitIndex: number;
  endCommitIndex: number;
}

export interface CommitMetadataSeriesPoint {
  bucketId: string;
  dimension: string;
  value: string;
  commits: number;
  additions: number;
  deletions: number;
  changedLines: number;
  filesChanged: number;
  weightedCommits: number;
  commitShas: string[];
}

export interface CommitMetadataDiagnostics {
  availability: CommitMetadataAvailability;
  analyzedCommitCount: number;
  matchedCommitCount: number;
  unmatchedCommitCount: number;
  invalidExtractorIds: string[];
  unavailableDimensions: string[];
  notes: string[];
}

export interface CommitMetadataTrendResult {
  extractorId: string;
  dimension: string;
  bucketMode: CommitMetadataBucketMode;
  metric: CommitMetadataMetric;
  buckets: CommitMetadataBucket[];
  series: CommitMetadataSeriesPoint[];
  diagnostics: CommitMetadataDiagnostics;
}
