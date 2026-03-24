import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import type { AnalysisResult, TreemapNode } from '../../src/types/index.js';
import {
  ANALYSIS_BENCHMARK_TARGETS,
  getAnalysisBenchmarkTarget,
  resolveBenchmarkSettings,
  type AnalysisBenchmarkTarget,
} from './analysisTargets.js';
import {
  formatBenchmarkRun,
  formatBenchmarkTargetList,
  parseBenchmarkCliArgs,
} from './benchmarkCli.js';
import {
  benchmarkWorkspaceRoot,
  runGit,
  safeGitValue,
  sccStoragePath,
} from './environment.js';
import { ensureGeneratedFixture } from './generatedFixture.js';
import { summarizeBenchmarkValues } from './statistics.js';
import { runBenchmarkIteration } from './iterationRunner.js';
import type {
  BenchmarkIterationSummary,
  BenchmarkRunResult,
  BenchmarkTargetResult,
} from './contracts.js';
export type {
  BenchmarkIterationSummary,
  BenchmarkRunResult,
  BenchmarkTargetResult,
} from './contracts.js';
export { formatBenchmarkRun } from './benchmarkCli.js';

const BENCHMARK_SCHEMA_VERSION = 1;
const DEFAULT_WARMUP_ITERATIONS = 1;
const DEFAULT_MEASURED_ITERATIONS = 3;

export interface AnalysisBenchmarkOptions {
  targetNames?: string[];
  warmupIterations?: number;
  measuredIterations?: number;
  outputPath?: string;
  maxCommitsOverride?: number;
}

async function ensureDirectory(dirPath: string): Promise<void> {
  await fs.mkdir(dirPath, { recursive: true });
}

function collectFileCount(node: TreemapNode): number {
  if (node.type === 'file') {
    return 1;
  }
  return (node.children ?? []).reduce((sum, child) => sum + collectFileCount(child), 0);
}

async function benchmarkTarget(
  target: AnalysisBenchmarkTarget,
  options: Required<Pick<AnalysisBenchmarkOptions, 'warmupIterations' | 'measuredIterations'>> & Pick<AnalysisBenchmarkOptions, 'maxCommitsOverride'>
): Promise<BenchmarkTargetResult> {
  const fixturePath = await ensureGeneratedFixture(target);
  const settings = resolveBenchmarkSettings(target.settings, options.maxCommitsOverride);

  for (let warmupIndex = 0; warmupIndex < options.warmupIterations; warmupIndex += 1) {
    await runBenchmarkIteration({
      repoPath: fixturePath,
      settings,
      sccStoragePath: sccStoragePath(),
    });
  }

  const iterations: BenchmarkIterationSummary[] = [];
  let lastResult: AnalysisResult | null = null;

  for (let iterationIndex = 0; iterationIndex < options.measuredIterations; iterationIndex += 1) {
    const { iteration, result } = await runBenchmarkIteration({
      repoPath: fixturePath,
      settings,
      sccStoragePath: sccStoragePath(),
    });
    iterations.push(iteration);
    lastResult = result;
  }

  const allPhaseNames = new Set<string>();
  for (const iteration of iterations) {
    for (const phaseName of Object.keys(iteration.phaseTotalsMs)) {
      allPhaseNames.add(phaseName);
    }
  }

  const phaseStats = Object.fromEntries(
    Array.from(allPhaseNames)
      .sort((a, b) => a.localeCompare(b))
      .map((phaseName) => [
        phaseName,
        summarizeBenchmarkValues(iterations.map((iteration) => iteration.phaseTotalsMs[phaseName] ?? 0)),
      ])
  );

  if (!lastResult) {
    throw new Error(`No benchmark result produced for target ${target.name}`);
  }

  return {
    name: target.name,
    description: target.description,
    fixturePath,
    iterations,
    totalMs: summarizeBenchmarkValues(iterations.map((iteration) => iteration.totalMs)),
    phaseStats,
    metadata: {
      repositoryCommitCount: Number(runGit(fixturePath, ['rev-list', '--count', 'HEAD'])),
      analyzedCommitCount: lastResult.analyzedCommitCount,
      fileCount: collectFileCount(lastResult.fileTree),
      limitReached: lastResult.limitReached,
    },
  };
}

export async function runAnalysisBenchmarks(options: AnalysisBenchmarkOptions = {}): Promise<BenchmarkRunResult> {
  const targetNames = options.targetNames && options.targetNames.length > 0
    ? options.targetNames
    : ANALYSIS_BENCHMARK_TARGETS.map((target) => target.name);

  const targets = targetNames.map((targetName) => getAnalysisBenchmarkTarget(targetName));
  await ensureDirectory(benchmarkWorkspaceRoot());
  await ensureDirectory(path.dirname(sccStoragePath()));

  const measuredIterations = options.measuredIterations ?? DEFAULT_MEASURED_ITERATIONS;
  const warmupIterations = options.warmupIterations ?? DEFAULT_WARMUP_ITERATIONS;
  const targetResults: BenchmarkTargetResult[] = [];

  for (const target of targets) {
    targetResults.push(
      await benchmarkTarget(target, {
        warmupIterations,
        measuredIterations,
        maxCommitsOverride: options.maxCommitsOverride,
      })
    );
  }

  const run: BenchmarkRunResult = {
    schemaVersion: BENCHMARK_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    machine: {
      hostname: os.hostname(),
      platform: os.platform(),
      release: os.release(),
      arch: os.arch(),
      cpuCount: os.cpus().length,
      nodeVersion: process.version,
    },
    git: {
      branch: safeGitValue(['rev-parse', '--abbrev-ref', 'HEAD'], 'unknown'),
      commit: safeGitValue(['rev-parse', 'HEAD'], 'unknown'),
      shortSha: safeGitValue(['rev-parse', '--short', 'HEAD'], 'unknown'),
      subject: safeGitValue(['log', '-1', '--pretty=%s'], 'unknown'),
    },
    config: {
      warmupIterations,
      measuredIterations,
      targetNames,
    },
    targets: targetResults,
  };

  if (options.outputPath) {
    await ensureDirectory(path.dirname(options.outputPath));
    await fs.writeFile(options.outputPath, `${JSON.stringify(run, null, 2)}\n`, 'utf8');
  }

  return run;
}

export async function runAnalysisBenchmarkCli(argv: string[]): Promise<void> {
  const parsed = parseBenchmarkCliArgs(argv);

  if (parsed.command === 'list-targets') {
    process.stdout.write(`${formatBenchmarkTargetList()}\n`);
    return;
  }

  const run = await runAnalysisBenchmarks({
    targetNames: parsed.targetNames,
    measuredIterations: parsed.measuredIterations,
    warmupIterations: parsed.warmupIterations,
    outputPath: parsed.outputPath,
    maxCommitsOverride: parsed.maxCommitsOverride,
  });

  process.stdout.write(parsed.json ? `${JSON.stringify(run, null, 2)}\n` : `${formatBenchmarkRun(run)}\n`);
}
