import * as fs from 'fs/promises';
import { existsSync } from 'fs';
import * as os from 'os';
import * as path from 'path';
import { spawnSync } from 'child_process';
import { performance } from 'perf_hooks';
import { AnalysisCoordinator } from '../analyzers/coordinator.js';
import { createGitAnalyzer, type GitClient } from '../analyzers/gitAnalyzer.js';
import { createLOCCounter, type LOCClient } from '../analyzers/locCounter.js';
import type { AnalysisResult, ExtensionSettings, TreemapNode } from '../types/index.js';
import {
  ANALYSIS_BENCHMARK_TARGETS,
  getAnalysisBenchmarkTarget,
  resolveBenchmarkSettings,
  type AnalysisBenchmarkTarget,
  type GeneratedRepoFixtureSpec,
} from './analysisTargets.js';
import type {
  BenchmarkIterationSummary,
  BenchmarkRunResult,
  BenchmarkTargetResult,
  SummaryStats,
} from './contracts.js';
export type {
  BenchmarkIterationSummary,
  BenchmarkRunResult,
  BenchmarkTargetResult,
  SummaryStats,
} from './contracts.js';

const FIXTURE_SCHEMA_VERSION = 1;
const BENCHMARK_SCHEMA_VERSION = 1;
const DEFAULT_WARMUP_ITERATIONS = 1;
const DEFAULT_MEASURED_ITERATIONS = 3;
const TEXT_FILE_VARIANTS = [
  { extension: '.ts', directory: 'src/core', lines: (i: number) => [
    `export function feature${i}(input: number): number {`,
    `  return input + ${i};`,
    '}',
  ] },
  { extension: '.tsx', directory: 'src/ui', lines: (i: number) => [
    `export function Card${i}() {`,
    `  return <section data-card="${i}">Card ${i}</section>;`,
    '}',
  ] },
  { extension: '.js', directory: 'scripts', lines: (i: number) => [
    `function task${i}() {`,
    `  return 'task-${i}';`,
    '}',
    `module.exports = { task${i} };`,
  ] },
  { extension: '.json', directory: 'config', lines: (i: number) => [
    '{',
    `  "name": "config-${i}",`,
    `  "enabled": ${i % 2 === 0 ? 'true' : 'false'}`,
    '}',
  ] },
  { extension: '.md', directory: 'docs', lines: (i: number) => [
    `# Document ${i}`,
    '',
    `Generated benchmark note ${i}.`,
  ] },
  { extension: '.css', directory: 'styles', lines: (i: number) => [
    `.card-${i} {`,
    `  padding: ${(i % 6) + 4}px;`,
    '}',
  ] },
  { extension: '.yml', directory: '.github/workflows', lines: (i: number) => [
    `name: workflow-${i}`,
    'on: [push]',
    'jobs:',
    '  check:',
    '    runs-on: ubuntu-latest',
  ] },
];

export interface AnalysisBenchmarkOptions {
  targetNames?: string[];
  warmupIterations?: number;
  measuredIterations?: number;
  outputPath?: string;
  maxCommitsOverride?: number;
}

interface FixtureMarker {
  schemaVersion: number;
  targetName: string;
  fixture: GeneratedRepoFixtureSpec;
}

interface IterationAccumulator {
  phaseTotalsMs: Record<string, number>;
  phaseCallCounts: Record<string, number>;
}

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state += 0x6D2B79F5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randomInt(random: () => number, minInclusive: number, maxExclusive: number): number {
  return Math.floor(random() * (maxExclusive - minInclusive)) + minInclusive;
}

function median(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[middle - 1] + sorted[middle]) / 2;
  }
  return sorted[middle];
}

function percentile(values: number[], percentileValue: number): number {
  if (values.length === 0) {
    return 0;
  }

  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil((percentileValue / 100) * sorted.length) - 1)
  );
  return sorted[index];
}

function summarize(values: number[]): SummaryStats {
  if (values.length === 0) {
    return {
      count: 0,
      min: 0,
      max: 0,
      mean: 0,
      median: 0,
      p95: 0,
    };
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  return {
    count: values.length,
    min: roundMetric(min),
    max: roundMetric(max),
    mean: roundMetric(mean),
    median: roundMetric(median(values)),
    p95: roundMetric(percentile(values, 95)),
  };
}

function roundMetric(value: number): number {
  return Math.round(value * 100) / 100;
}

function repoRoot(): string {
  return path.resolve(__dirname, '../..');
}

function benchmarkWorkspaceRoot(): string {
  return path.join(repoRoot(), '.bench-results', 'workspaces', 'analysis');
}

function sccStoragePath(): string {
  return path.join(repoRoot(), '.bench-results', 'scc-storage');
}

function runGit(repoPath: string, args: string[], extraEnv: NodeJS.ProcessEnv = {}): string {
  const result = spawnSync('git', args, {
    cwd: repoPath,
    encoding: 'utf8',
    env: {
      ...process.env,
      ...extraEnv,
    },
  });

  if (result.status !== 0) {
    throw new Error(
      `git ${args.join(' ')} failed in ${repoPath}: ${result.stderr || result.stdout || 'unknown error'}`
    );
  }

  return result.stdout.trim();
}

async function ensureDirectory(dirPath: string): Promise<void> {
  await fs.mkdir(dirPath, { recursive: true });
}

async function writeTextFile(filePath: string, lines: string[]): Promise<void> {
  await ensureDirectory(path.dirname(filePath));
  await fs.writeFile(filePath, `${lines.join('\n')}\n`, 'utf8');
}

async function appendTextFile(filePath: string, lines: string[]): Promise<void> {
  await ensureDirectory(path.dirname(filePath));
  await fs.appendFile(filePath, `${lines.join('\n')}\n`, 'utf8');
}

function buildInitialTextFile(relativePath: string, fileIndex: number): string[] {
  const variant = TEXT_FILE_VARIANTS[fileIndex % TEXT_FILE_VARIANTS.length];
  return [
    ...variant.lines(fileIndex),
    '',
    `// benchmark-file: ${relativePath}`,
  ];
}

function buildMutationBlock(commitIndex: number, mutationIndex: number, lines: number): string[] {
  const block: string[] = [`// mutation ${commitIndex}-${mutationIndex}`];
  for (let i = 0; i < lines; i += 1) {
    block.push(`export const benchmark_${commitIndex}_${mutationIndex}_${i} = ${commitIndex + mutationIndex + i};`);
  }
  return block;
}

async function createGeneratedRepoFixture(target: AnalysisBenchmarkTarget, targetDir: string): Promise<void> {
  const random = mulberry32(target.fixture.seed);
  await fs.rm(targetDir, { recursive: true, force: true });
  await ensureDirectory(targetDir);

  runGit(targetDir, ['init']);
  runGit(targetDir, ['config', 'user.name', 'Repo Stats Bench']);
  runGit(targetDir, ['config', 'user.email', 'bench@example.com']);

  const trackedTextFiles: string[] = [];
  const generatedFileCount = Math.max(0, target.fixture.maxGeneratedFiles);

  for (let fileIndex = 0; fileIndex < target.fixture.initialFileCount; fileIndex += 1) {
    const variant = TEXT_FILE_VARIANTS[fileIndex % TEXT_FILE_VARIANTS.length];
    const isGenerated = fileIndex < generatedFileCount && fileIndex % 4 === 0;
    const directory = isGenerated ? `generated/module-${fileIndex % 8}` : `${variant.directory}/${fileIndex % 12}`;
    const relativePath = `${directory}/file-${fileIndex}${variant.extension}`;
    trackedTextFiles.push(relativePath);
    await writeTextFile(path.join(targetDir, relativePath), buildInitialTextFile(relativePath, fileIndex));
  }

  for (let binaryIndex = 0; binaryIndex < target.fixture.includeBinaryFiles; binaryIndex += 1) {
    const relativePath = `assets/${binaryIndex % 6}/image-${binaryIndex}.png`;
    await ensureDirectory(path.join(targetDir, path.dirname(relativePath)));
    const size = 256 + (binaryIndex * 17);
    const bytes = Buffer.alloc(size, binaryIndex % 255);
    await fs.writeFile(path.join(targetDir, relativePath), bytes);
  }

  await writeTextFile(path.join(targetDir, '.gitignore'), ['dist/', 'node_modules/']);
  await writeTextFile(path.join(targetDir, 'README.md'), ['# Synthetic benchmark repo', '', target.description]);

  commitFixtureState(targetDir, 0);

  let createdFiles = 0;
  for (let commitIndex = 1; commitIndex < target.fixture.commitCount; commitIndex += 1) {
    const touched = new Set<number>();
    while (touched.size < Math.min(target.fixture.filesTouchedPerCommit, trackedTextFiles.length)) {
      touched.add(randomInt(random, 0, trackedTextFiles.length));
    }

    let mutationIndex = 0;
    for (const fileIndex of touched) {
      const lines = randomInt(random, 1, target.fixture.maxLinesPerMutation + 1);
      await appendTextFile(
        path.join(targetDir, trackedTextFiles[fileIndex]),
        buildMutationBlock(commitIndex, mutationIndex, lines)
      );
      mutationIndex += 1;
    }

    if (
      target.fixture.createFileEvery > 0 &&
      commitIndex % target.fixture.createFileEvery === 0 &&
      createdFiles < target.fixture.maxGeneratedFiles
    ) {
      const variantIndex = randomInt(random, 0, TEXT_FILE_VARIANTS.length);
      const variant = TEXT_FILE_VARIANTS[variantIndex];
      const relativePath = `src/growth/${variantIndex}/created-${commitIndex}${variant.extension}`;
      trackedTextFiles.push(relativePath);
      createdFiles += 1;
      await writeTextFile(path.join(targetDir, relativePath), buildInitialTextFile(relativePath, commitIndex));
    }

    if (commitIndex % 25 === 0) {
      await appendTextFile(path.join(targetDir, 'README.md'), [`- checkpoint ${commitIndex}`]);
    }

    commitFixtureState(targetDir, commitIndex);
  }

  const marker: FixtureMarker = {
    schemaVersion: FIXTURE_SCHEMA_VERSION,
    targetName: target.name,
    fixture: target.fixture,
  };
  await fs.writeFile(
    path.join(targetDir, '.repo-stats-benchmark-fixture.json'),
    `${JSON.stringify(marker, null, 2)}\n`,
    'utf8'
  );
}

function commitFixtureState(targetDir: string, commitIndex: number): void {
  const commitDate = new Date(Date.UTC(2020, 0, 1 + commitIndex, commitIndex % 24, commitIndex % 60, 0));
  const env = {
    GIT_AUTHOR_DATE: commitDate.toISOString(),
    GIT_COMMITTER_DATE: commitDate.toISOString(),
  };

  runGit(targetDir, ['add', '-A'], env);
  runGit(targetDir, ['commit', '-m', `benchmark fixture commit ${commitIndex}`], env);
}

async function ensureGeneratedFixture(target: AnalysisBenchmarkTarget): Promise<string> {
  const targetDir = path.join(benchmarkWorkspaceRoot(), target.name);
  const markerPath = path.join(targetDir, '.repo-stats-benchmark-fixture.json');

  if (existsSync(markerPath)) {
    const markerRaw = await fs.readFile(markerPath, 'utf8');
    const marker = JSON.parse(markerRaw) as FixtureMarker;
    if (
      marker.schemaVersion === FIXTURE_SCHEMA_VERSION &&
      marker.targetName === target.name &&
      JSON.stringify(marker.fixture) === JSON.stringify(target.fixture) &&
      existsSync(path.join(targetDir, '.git'))
    ) {
      return targetDir;
    }
  }

  await createGeneratedRepoFixture(target, targetDir);
  return targetDir;
}

function collectFileCount(node: TreemapNode): number {
  if (node.type === 'file') {
    return 1;
  }
  return (node.children ?? []).reduce((sum, child) => sum + collectFileCount(child), 0);
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

async function runSingleIteration(
  repoPath: string,
  settings: ExtensionSettings
): Promise<{ iteration: BenchmarkIterationSummary; result: AnalysisResult }> {
  const accumulator: IterationAccumulator = {
    phaseTotalsMs: {},
    phaseCallCounts: {},
  };

  const gitClient = new InstrumentedGitClient(createGitAnalyzer(repoPath), accumulator);
  const locClientInner = createLOCCounter(repoPath, sccStoragePath());
  await locClientInner.ensureSccAvailable();
  const locClient = new InstrumentedLocClient(locClientInner, accumulator);

  const coordinator = new AnalysisCoordinator(
    repoPath,
    settings,
    sccStoragePath(),
    gitClient,
    locClient
  );

  const startedAt = performance.now();
  const result = await coordinator.analyze();
  const totalMs = performance.now() - startedAt;

  return {
    iteration: {
      totalMs: roundMetric(totalMs),
      phaseTotalsMs: Object.fromEntries(
        Object.entries(accumulator.phaseTotalsMs).map(([key, value]) => [key, roundMetric(value)])
      ),
      phaseCallCounts: accumulator.phaseCallCounts,
    },
    result,
  };
}

async function benchmarkTarget(
  target: AnalysisBenchmarkTarget,
  options: Required<Pick<AnalysisBenchmarkOptions, 'warmupIterations' | 'measuredIterations'>> & Pick<AnalysisBenchmarkOptions, 'maxCommitsOverride'>
): Promise<BenchmarkTargetResult> {
  const fixturePath = await ensureGeneratedFixture(target);
  const settings = resolveBenchmarkSettings(target.settings, options.maxCommitsOverride);

  for (let warmupIndex = 0; warmupIndex < options.warmupIterations; warmupIndex += 1) {
    await runSingleIteration(fixturePath, settings);
  }

  const iterations: BenchmarkIterationSummary[] = [];
  let lastResult: AnalysisResult | null = null;

  for (let iterationIndex = 0; iterationIndex < options.measuredIterations; iterationIndex += 1) {
    const { iteration, result } = await runSingleIteration(fixturePath, settings);
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
        summarize(iterations.map((iteration) => iteration.phaseTotalsMs[phaseName] ?? 0)),
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
    totalMs: summarize(iterations.map((iteration) => iteration.totalMs)),
    phaseStats,
    metadata: {
      repositoryCommitCount: Number(runGit(fixturePath, ['rev-list', '--count', 'HEAD'])),
      analyzedCommitCount: lastResult.analyzedCommitCount,
      fileCount: collectFileCount(lastResult.fileTree),
      limitReached: lastResult.limitReached,
    },
  };
}

function safeGitValue(args: string[], fallback: string): string {
  const result = spawnSync('git', args, {
    cwd: repoRoot(),
    encoding: 'utf8',
  });
  return result.status === 0 ? result.stdout.trim() : fallback;
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

export function formatBenchmarkRun(run: BenchmarkRunResult): string {
  const lines: string[] = [];
  lines.push(`Analysis benchmark run (${run.machine.hostname})`);
  lines.push(`git: ${run.git.shortSha} ${run.git.subject}`);
  lines.push(
    `targets: ${run.config.targetNames.join(', ')} · warmups ${run.config.warmupIterations} · measured ${run.config.measuredIterations}`
  );

  for (const target of run.targets) {
    lines.push('');
    lines.push(
      `${target.name}: median ${target.totalMs.median.toFixed(2)} ms · p95 ${target.totalMs.p95.toFixed(2)} ms · files ${target.metadata.fileCount.toLocaleString()} · commits ${target.metadata.repositoryCommitCount.toLocaleString()}`
    );

    const topPhases = Object.entries(target.phaseStats)
      .sort((a, b) => b[1].median - a[1].median || a[0].localeCompare(b[0]))
      .slice(0, 6);

    for (const [phaseName, stats] of topPhases) {
      lines.push(`  ${phaseName}: median ${stats.median.toFixed(2)} ms · p95 ${stats.p95.toFixed(2)} ms`);
    }
  }

  return lines.join('\n');
}

interface ParsedCliArgs {
  command: 'run' | 'list-targets';
  targetNames: string[];
  measuredIterations?: number;
  warmupIterations?: number;
  outputPath?: string;
  json: boolean;
  maxCommitsOverride?: number;
}

function parseCliArgs(argv: string[]): ParsedCliArgs {
  const parsed: ParsedCliArgs = {
    command: 'run',
    targetNames: [],
    json: false,
  };

  const args = [...argv];
  if (args[0] === 'run' || args[0] === 'list-targets') {
    parsed.command = args.shift() as ParsedCliArgs['command'];
  }

  while (args.length > 0) {
    const arg = args.shift();
    if (!arg) {
      continue;
    }

    if (arg === '--target') {
      const value = args.shift();
      if (!value) {
        throw new Error('Missing value for --target');
      }
      parsed.targetNames.push(value);
      continue;
    }

    if (arg === '--iterations') {
      const value = args.shift();
      if (!value) {
        throw new Error('Missing value for --iterations');
      }
      parsed.measuredIterations = Number(value);
      continue;
    }

    if (arg === '--warmups') {
      const value = args.shift();
      if (!value) {
        throw new Error('Missing value for --warmups');
      }
      parsed.warmupIterations = Number(value);
      continue;
    }

    if (arg === '--output') {
      const value = args.shift();
      if (!value) {
        throw new Error('Missing value for --output');
      }
      parsed.outputPath = path.resolve(value);
      continue;
    }

    if (arg === '--json') {
      parsed.json = true;
      continue;
    }

    if (arg === '--max-commits') {
      const value = args.shift();
      if (!value) {
        throw new Error('Missing value for --max-commits');
      }
      parsed.maxCommitsOverride = Number(value);
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return parsed;
}

export async function runAnalysisBenchmarkCli(argv: string[]): Promise<void> {
  const parsed = parseCliArgs(argv);

  if (parsed.command === 'list-targets') {
    const output = ANALYSIS_BENCHMARK_TARGETS
      .map((target) => `${target.name}\t${target.description}`)
      .join('\n');
    process.stdout.write(`${output}\n`);
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
