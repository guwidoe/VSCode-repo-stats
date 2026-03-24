export interface SummaryStats {
  count: number;
  min: number;
  max: number;
  mean: number;
  median: number;
  p95: number;
}

export interface BenchmarkIterationSummary {
  totalMs: number;
  phaseTotalsMs: Record<string, number>;
  phaseCallCounts: Record<string, number>;
}

export interface BenchmarkTargetResult {
  name: string;
  description: string;
  fixturePath: string;
  iterations: BenchmarkIterationSummary[];
  totalMs: SummaryStats;
  phaseStats: Record<string, SummaryStats>;
  metadata: {
    repositoryCommitCount: number;
    analyzedCommitCount: number;
    fileCount: number;
    limitReached: boolean;
  };
}

export interface BenchmarkRunResult {
  schemaVersion: number;
  generatedAt: string;
  machine: {
    hostname: string;
    platform: string;
    release: string;
    arch: string;
    cpuCount: number;
    nodeVersion: string;
  };
  git: {
    branch: string;
    commit: string;
    shortSha: string;
    subject: string;
  };
  config: {
    warmupIterations: number;
    measuredIterations: number;
    targetNames: string[];
  };
  targets: BenchmarkTargetResult[];
}
