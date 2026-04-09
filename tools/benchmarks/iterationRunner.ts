import { performance } from 'perf_hooks';
import { AnalysisCoordinator } from '../../src/analyzers/coordinator.js';
import { createGitAnalyzer, type GitClient } from '../../src/analyzers/gitAnalyzer.js';
import { createLOCCounter, type LOCClient } from '../../src/analyzers/locCounter.js';
import type { AnalysisResult, ExtensionSettings } from '../../src/types/index.js';
import type { BenchmarkIterationSummary } from './contracts.js';
import { roundBenchmarkMetric } from './statistics.js';

interface IterationAccumulator {
  phaseTotalsMs: Record<string, number>;
  phaseCallCounts: Record<string, number>;
}

function timeAsync<T>(
  accumulator: IterationAccumulator,
  phaseName: string,
  task: () => Promise<T>
): Promise<T> {
  const startedAt = performance.now();
  return task().finally(() => {
    const elapsed = performance.now() - startedAt;
    accumulator.phaseTotalsMs[phaseName] = (accumulator.phaseTotalsMs[phaseName] ?? 0) + elapsed;
    accumulator.phaseCallCounts[phaseName] = (accumulator.phaseCallCounts[phaseName] ?? 0) + 1;
  });
}

class InstrumentedGitClient implements GitClient {
  constructor(
    private readonly inner: GitClient,
    private readonly accumulator: IterationAccumulator
  ) {}

  isRepo(): Promise<boolean> {
    return timeAsync(this.accumulator, 'isRepo', () => this.inner.isRepo());
  }

  getRepoInfo() {
    return timeAsync(this.accumulator, 'getRepoInfo', () => this.inner.getRepoInfo());
  }

  getCommitAnalytics(maxCommits: number, excludePatterns?: string[]) {
    return timeAsync(this.accumulator, 'getCommitAnalytics', () => this.inner.getCommitAnalytics(maxCommits, excludePatterns));
  }

  getContributorStats(maxCommits: number, excludePatterns?: string[]) {
    return timeAsync(this.accumulator, 'getContributorStats', () => this.inner.getContributorStats(maxCommits, excludePatterns));
  }

  getCodeFrequency(maxCommits: number, excludePatterns?: string[]) {
    return timeAsync(this.accumulator, 'getCodeFrequency', () => this.inner.getCodeFrequency(maxCommits, excludePatterns));
  }

  getFileModificationDates() {
    return timeAsync(this.accumulator, 'getFileModificationDates', () => this.inner.getFileModificationDates());
  }

  getTrackedFiles() {
    return timeAsync(this.accumulator, 'getTrackedFiles', () => this.inner.getTrackedFiles());
  }

  getSubmodulePaths() {
    return timeAsync(this.accumulator, 'getSubmodulePaths', () => this.inner.getSubmodulePaths());
  }

  getHeadBlobShas(paths?: string[]) {
    return timeAsync(this.accumulator, 'getHeadBlobShas', () => this.inner.getHeadBlobShas(paths));
  }

  raw(args: string[]) {
    return timeAsync(this.accumulator, 'raw', () => this.inner.raw(args));
  }
}

class InstrumentedLocClient implements LOCClient {
  constructor(
    private readonly inner: LOCClient,
    private readonly accumulator: IterationAccumulator
  ) {}

  countLines(excludePatterns: string[], locExcludedExtensions?: string[]) {
    return timeAsync(this.accumulator, 'countLines', () => this.inner.countLines(excludePatterns, locExcludedExtensions));
  }

  ensureSccAvailable(onProgress?: (percent: number) => void) {
    return timeAsync(this.accumulator, 'ensureSccAvailable', () => this.inner.ensureSccAvailable(onProgress));
  }

  getSccInfo() {
    return timeAsync(this.accumulator, 'getSccInfo', () => this.inner.getSccInfo());
  }
}

export async function runBenchmarkIteration(options: {
  repoPath: string;
  settings: ExtensionSettings;
  sccStoragePath: string;
}): Promise<{ iteration: BenchmarkIterationSummary; result: AnalysisResult }> {
  const accumulator: IterationAccumulator = {
    phaseTotalsMs: {},
    phaseCallCounts: {},
  };

  const gitClient = new InstrumentedGitClient(createGitAnalyzer(options.repoPath), accumulator);
  const locClientInner = createLOCCounter(options.repoPath, options.sccStoragePath);
  await locClientInner.ensureSccAvailable();
  const locClient = new InstrumentedLocClient(locClientInner, accumulator);

  const coordinator = new AnalysisCoordinator(
    options.repoPath,
    options.settings,
    options.sccStoragePath,
    gitClient,
    locClient
  );

  const startedAt = performance.now();
  const result = await coordinator.analyze();
  const totalMs = performance.now() - startedAt;

  return {
    iteration: {
      totalMs: roundBenchmarkMetric(totalMs),
      phaseTotalsMs: Object.fromEntries(
        Object.entries(accumulator.phaseTotalsMs).map(([key, value]) => [key, roundBenchmarkMetric(value)])
      ),
      phaseCallCounts: accumulator.phaseCallCounts,
    },
    result,
  };
}
