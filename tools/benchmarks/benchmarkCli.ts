import * as path from 'path';
import { ANALYSIS_BENCHMARK_TARGETS } from './analysisTargets.js';
import type { BenchmarkRunResult } from './contracts.js';

export interface ParsedBenchmarkCliArgs {
  command: 'run' | 'list-targets';
  targetNames: string[];
  measuredIterations?: number;
  warmupIterations?: number;
  outputPath?: string;
  json: boolean;
  maxCommitsOverride?: number;
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

export function parseBenchmarkCliArgs(argv: string[]): ParsedBenchmarkCliArgs {
  const parsed: ParsedBenchmarkCliArgs = {
    command: 'run',
    targetNames: [],
    json: false,
  };

  const args = [...argv];
  if (args[0] === 'run' || args[0] === 'list-targets') {
    parsed.command = args.shift() as ParsedBenchmarkCliArgs['command'];
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

export function formatBenchmarkTargetList(): string {
  return ANALYSIS_BENCHMARK_TARGETS
    .map((target) => `${target.name}\t${target.description}`)
    .join('\n');
}
