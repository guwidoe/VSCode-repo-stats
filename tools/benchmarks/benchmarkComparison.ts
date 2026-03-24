import type { BenchmarkRunResult } from './contracts.js';
export type {
  BenchmarkIterationSummary,
  BenchmarkRunResult,
  BenchmarkTargetResult,
  SummaryStats,
} from './contracts.js';

export interface ComparisonThresholds {
  warnPercent: number;
  failPercent: number;
  minimumInterestingPhaseMs: number;
}

export interface MetricComparison {
  name: string;
  baselineMedianMs: number;
  currentMedianMs: number;
  deltaMs: number;
  deltaPercent: number;
  status: 'improved' | 'stable' | 'warn' | 'regressed';
}

export interface TargetComparison {
  name: string;
  total: MetricComparison;
  phases: MetricComparison[];
}

export interface BenchmarkComparisonReport {
  thresholds: ComparisonThresholds;
  targets: TargetComparison[];
  hasRegression: boolean;
}

const DEFAULT_THRESHOLDS: ComparisonThresholds = {
  warnPercent: 5,
  failPercent: 15,
  minimumInterestingPhaseMs: 10,
};

function roundMetric(value: number): number {
  return Math.round(value * 100) / 100;
}

function classifyDelta(deltaPercent: number, thresholds: ComparisonThresholds): MetricComparison['status'] {
  if (deltaPercent <= -thresholds.warnPercent) {
    return 'improved';
  }
  if (deltaPercent >= thresholds.failPercent) {
    return 'regressed';
  }
  if (deltaPercent >= thresholds.warnPercent) {
    return 'warn';
  }
  return 'stable';
}

function compareMetric(
  name: string,
  baselineMedianMs: number,
  currentMedianMs: number,
  thresholds: ComparisonThresholds
): MetricComparison {
  const safeBaseline = baselineMedianMs <= 0 ? 0.0001 : baselineMedianMs;
  const deltaMs = currentMedianMs - baselineMedianMs;
  const deltaPercent = (deltaMs / safeBaseline) * 100;

  return {
    name,
    baselineMedianMs: roundMetric(baselineMedianMs),
    currentMedianMs: roundMetric(currentMedianMs),
    deltaMs: roundMetric(deltaMs),
    deltaPercent: roundMetric(deltaPercent),
    status: classifyDelta(deltaPercent, thresholds),
  };
}

export function compareBenchmarkRuns(
  baseline: BenchmarkRunResult,
  current: BenchmarkRunResult,
  partialThresholds: Partial<ComparisonThresholds> = {}
): BenchmarkComparisonReport {
  const thresholds: ComparisonThresholds = {
    ...DEFAULT_THRESHOLDS,
    ...partialThresholds,
  };

  const baselineTargets = new Map(baseline.targets.map((target) => [target.name, target]));
  const targets: TargetComparison[] = [];

  for (const currentTarget of current.targets) {
    const baselineTarget = baselineTargets.get(currentTarget.name);
    if (!baselineTarget) {
      continue;
    }

    const total = compareMetric(
      'total',
      baselineTarget.totalMs.median,
      currentTarget.totalMs.median,
      thresholds
    );

    const phaseNames = new Set([
      ...Object.keys(baselineTarget.phaseStats),
      ...Object.keys(currentTarget.phaseStats),
    ]);

    const phases = Array.from(phaseNames)
      .map((phaseName) => ({
        name: phaseName,
        baseline: baselineTarget.phaseStats[phaseName]?.median ?? 0,
        current: currentTarget.phaseStats[phaseName]?.median ?? 0,
      }))
      .filter((entry) => Math.max(entry.baseline, entry.current) >= thresholds.minimumInterestingPhaseMs)
      .map((entry) => compareMetric(entry.name, entry.baseline, entry.current, thresholds))
      .sort((a, b) => b.currentMedianMs - a.currentMedianMs || a.name.localeCompare(b.name));

    targets.push({
      name: currentTarget.name,
      total,
      phases,
    });
  }

  const hasRegression = targets.some((target) => target.total.status === 'regressed');

  return {
    thresholds,
    targets,
    hasRegression,
  };
}

export function formatBenchmarkComparisonReport(report: BenchmarkComparisonReport): string {
  const lines: string[] = [];
  lines.push('Analysis benchmark comparison');
  lines.push(
    `Thresholds: warn >= ${report.thresholds.warnPercent}% · fail >= ${report.thresholds.failPercent}%`
  );

  for (const target of report.targets) {
    lines.push('');
    lines.push(`Target: ${target.name}`);
    lines.push(
      `  total: ${target.total.currentMedianMs.toFixed(2)} ms vs ${target.total.baselineMedianMs.toFixed(2)} ms ` +
      `(${target.total.deltaPercent >= 0 ? '+' : ''}${target.total.deltaPercent.toFixed(2)}%) [${target.total.status}]`
    );

    for (const phase of target.phases.slice(0, 8)) {
      lines.push(
        `  ${phase.name}: ${phase.currentMedianMs.toFixed(2)} ms vs ${phase.baselineMedianMs.toFixed(2)} ms ` +
        `(${phase.deltaPercent >= 0 ? '+' : ''}${phase.deltaPercent.toFixed(2)}%) [${phase.status}]`
      );
    }
  }

  if (report.targets.length === 0) {
    lines.push('');
    lines.push('No overlapping targets between baseline and current run.');
  }

  return lines.join('\n');
}
