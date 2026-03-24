import { describe, expect, it } from 'vitest';
import {
  formatBenchmarkRun,
  formatBenchmarkTargetList,
  parseBenchmarkCliArgs,
} from './benchmarkCli.js';
import type { BenchmarkRunResult } from './contracts.js';

function createRun(): BenchmarkRunResult {
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
      targetNames: ['synthetic-small'],
    },
    targets: [
      {
        name: 'synthetic-small',
        description: 'fixture',
        fixturePath: '/tmp/repo',
        iterations: [],
        totalMs: {
          count: 3,
          min: 10,
          max: 12,
          mean: 11,
          median: 11,
          p95: 12,
        },
        phaseStats: {
          raw: {
            count: 3,
            min: 4,
            max: 5,
            mean: 4.5,
            median: 4.5,
            p95: 5,
          },
        },
        metadata: {
          repositoryCommitCount: 100,
          analyzedCommitCount: 80,
          fileCount: 20,
          limitReached: false,
        },
      },
    ],
  };
}

describe('benchmarkCli', () => {
  it('parses benchmark CLI arguments', () => {
    expect(parseBenchmarkCliArgs(['run', '--target', 'synthetic-small', '--iterations', '2', '--warmups', '1', '--output', 'out.json', '--json', '--max-commits', '50'])).toMatchObject({
      command: 'run',
      targetNames: ['synthetic-small'],
      measuredIterations: 2,
      warmupIterations: 1,
      json: true,
      maxCommitsOverride: 50,
    });
  });

  it('formats run summaries and target lists', () => {
    expect(formatBenchmarkRun(createRun())).toContain('Analysis benchmark run');
    expect(formatBenchmarkTargetList()).toContain('synthetic-small');
  });

  it('rejects unknown CLI arguments', () => {
    expect(() => parseBenchmarkCliArgs(['--bogus'])).toThrow('Unknown argument: --bogus');
  });
});
