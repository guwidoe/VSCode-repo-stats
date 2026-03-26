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
  timestamps: string[];
  /** Series labels (e.g. author names, cohorts). */
  labels: string[];
  /** Series x snapshots matrix (same shape as labels x snapshots). */
  seriesValues: number[][];
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
  generatedAt: string;
  targetId: string;
  historyMode: 'singleBranch' | 'mergedMembers';
  revisionHash: string;
  settingsHash: string;
  memberHeads: EvolutionTargetHead[];
  cohorts: EvolutionTimeSeriesData;
  authors: EvolutionTimeSeriesData;
  extensions: EvolutionTimeSeriesData;
  directories: EvolutionTimeSeriesData;
  domains: EvolutionTimeSeriesData;
  diagnostics?: EvolutionDiagnostics;
}

type EvolutionTimeSeriesShape = Pick<EvolutionTimeSeriesData, 'labels' | 'snapshots'> & {
  timestamps?: string[];
  ts?: string[];
  seriesValues?: number[][];
  y?: number[][];
};

type EvolutionResultShape = Omit<
  EvolutionResult,
  'cohorts' | 'authors' | 'extensions' | 'directories' | 'domains'
> & {
  cohorts: EvolutionTimeSeriesShape;
  authors: EvolutionTimeSeriesShape;
  extensions?: EvolutionTimeSeriesShape;
  directories?: EvolutionTimeSeriesShape;
  exts?: EvolutionTimeSeriesShape;
  dirs?: EvolutionTimeSeriesShape;
  domains: EvolutionTimeSeriesShape;
};

export function normalizeEvolutionTimeSeriesData(
  data: EvolutionTimeSeriesShape
): EvolutionTimeSeriesData {
  const timestamps = data.timestamps ?? data.ts ?? [];
  const seriesValues = data.seriesValues ?? data.y ?? [];

  return {
    snapshots: data.snapshots,
    timestamps,
    labels: data.labels,
    seriesValues,
  };
}

export function normalizeEvolutionResult(result: EvolutionResultShape): EvolutionResult {
  const extensions = result.extensions ?? result.exts;
  const directories = result.directories ?? result.dirs;

  if (!extensions || !directories) {
    throw new Error('Evolution result is missing extension or directory series data.');
  }

  const normalizedExtensions = normalizeEvolutionTimeSeriesData(extensions);
  const normalizedDirectories = normalizeEvolutionTimeSeriesData(directories);

  return {
    ...result,
    cohorts: normalizeEvolutionTimeSeriesData(result.cohorts),
    authors: normalizeEvolutionTimeSeriesData(result.authors),
    extensions: normalizedExtensions,
    directories: normalizedDirectories,
    domains: normalizeEvolutionTimeSeriesData(result.domains),
  };
}

export type EvolutionStatus = 'idle' | 'loading' | 'ready' | 'error' | 'stale';
export type EvolutionProgressStage = 'preparing' | 'sampling' | 'analyzing' | 'finalizing';
