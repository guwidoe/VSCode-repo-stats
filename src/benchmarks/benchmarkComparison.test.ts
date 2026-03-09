import { describe, expect, it } from 'vitest';
import {
  compareBenchmarkRuns,
  formatBenchmarkComparisonReport,
  type BenchmarkRunResult,
} from './benchmarkComparison.js';

function createRun(totalMs: number, rawMs: number): BenchmarkRunResult {
  return {
    schemaVersion: 1,
    generatedAt: '2026-03-09T00:00:00.000Z',
    machine: {
      hostname: 'bench-host',
      platform: 'linux',
      release: '6.0',
      arch: 'x64',
      cpuCount: 8,
      nodeVersion: 'v22.0.0',
    },
    git: {
      branch: 'main',
      commit: 'abc',
      shortSha: 'abc',
      subject: 'test',
    },
    config: {
      warmupIterations: 1,
      measuredIterations: 3,
      targetNames: ['synthetic-medium'],
    },
    targets: [
      {
        name: 'synthetic-medium',
        description: 'fixture',
        fixturePath: '/tmp/repo',
        iterations: [],
        totalMs: {
          count: 3,
          min: totalMs,
          max: totalMs,
          mean: totalMs,
          median: totalMs,
          p95: totalMs,
        },
        phaseStats: {
          raw: {
            count: 3,
            min: rawMs,
            max: rawMs,
            mean: rawMs,
            median: rawMs,
            p95: rawMs,
          },
        },
        metadata: {
          repositoryCommitCount: 100,
          analyzedCommitCount: 100,
          fileCount: 20,
          limitReached: false,
        },
      },
    ],
  };
}

describe('benchmark comparison', () => {
  it('marks a large slowdown as a regression', () => {
    const report = compareBenchmarkRuns(createRun(100, 40), createRun(130, 55), {
      warnPercent: 5,
      failPercent: 15,
      minimumInterestingPhaseMs: 1,
    });

    expect(report.hasRegression).toBe(true);
    expect(report.targets[0]?.total.status).toBe('regressed');
    expect(report.targets[0]?.phases[0]?.status).toBe('regressed');
  });

  it('marks a meaningful speedup as improved', () => {
    const report = compareBenchmarkRuns(createRun(100, 40), createRun(90, 34), {
      warnPercent: 5,
      failPercent: 15,
      minimumInterestingPhaseMs: 1,
    });

    expect(report.hasRegression).toBe(false);
    expect(report.targets[0]?.total.status).toBe('improved');
    expect(formatBenchmarkComparisonReport(report)).toContain('Analysis benchmark comparison');
  });
});
