import { describe, expect, it } from 'vitest';
import {
  EvolutionAnalyzer,
  EvolutionGitClient,
} from './evolutionAnalyzer';
import { ExtensionSettings, NotAGitRepoError } from '../types';

class FakeGitClient implements EvolutionGitClient {
  private readonly responses = new Map<string, string>();
  private readonly revparseResponses = new Map<string, string>();
  public blameCallCount = 0;

  constructor(private readonly isRepoResult: boolean = true) {}

  setRawResponse(args: string[], output: string): void {
    this.responses.set(args.join(' '), output);
  }

  setRevparseResponse(args: string[], output: string): void {
    this.revparseResponses.set(args.join(' '), output);
  }

  async checkIsRepo(): Promise<boolean> {
    return this.isRepoResult;
  }

  async revparse(args: string[]): Promise<string> {
    return this.revparseResponses.get(args.join(' ')) ?? '';
  }

  async raw(args: string[]): Promise<string> {
    const key = args.join(' ');
    if (key.includes('blame')) {
      this.blameCallCount += 1;
    }
    return this.responses.get(key) ?? '';
  }
}

function createSettings(overrides?: Partial<ExtensionSettings['evolution']>): ExtensionSettings {
  return {
    excludePatterns: [],
    maxCommitsToAnalyze: 1000,
    defaultColorMode: 'language',
    generatedPatterns: [],
    binaryExtensions: ['.png', '.jpg'],
    locExcludedExtensions: [],
    showEmptyTimePeriods: true,
    defaultGranularityMode: 'auto',
    autoGranularityThreshold: 20,
    overviewDisplayMode: 'percent',
    tooltipSettings: {
      showLinesOfCode: true,
      showFileSize: true,
      showLanguage: true,
      showLastModified: true,
      showComplexity: false,
      showCommentLines: false,
      showCommentRatio: false,
      showBlankLines: false,
      showCodeDensity: false,
      showFileCount: true,
    },
    evolution: {
      autoRun: false,
      snapshotIntervalDays: 30,
      maxSnapshots: 80,
      maxSeries: 20,
      cohortFormat: '%Y',
      ...overrides,
    },
  };
}

describe('EvolutionAnalyzer', () => {
  it('throws NotAGitRepoError for non-repositories', async () => {
    const git = new FakeGitClient(false);
    const analyzer = new EvolutionAnalyzer('/tmp/repo', createSettings(), git);

    await expect(analyzer.analyze()).rejects.toBeInstanceOf(NotAGitRepoError);
  });

  it('reuses unchanged file histograms between snapshots', async () => {
    const git = new FakeGitClient(true);
    const settings = createSettings({ snapshotIntervalDays: 30, maxSnapshots: 10 });

    git.setRevparseResponse(['--abbrev-ref', 'HEAD'], 'main\n');
    git.setRevparseResponse(['HEAD'], 'cccccccccccccccccccccccccccccccccccccccc\n');

    git.setRawResponse(
      ['log', '--first-parent', '--reverse', '--format=%H|%ct', 'main'],
      [
        'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa|1577836800',
        'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb|1580515200',
        'cccccccccccccccccccccccccccccccccccccccc|1640995200',
      ].join('\n')
    );

    git.setRawResponse(
      ['ls-tree', '-r', '--name-only', 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'],
      'src/app.ts\n'
    );

    git.setRawResponse(
      ['diff-tree', '--no-commit-id', '--name-status', '-r', 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'],
      ''
    );
    git.setRawResponse(
      ['diff-tree', '--no-commit-id', '--name-status', '-r', 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb', 'cccccccccccccccccccccccccccccccccccccccc'],
      'M\tsrc/app.ts\n'
    );

    git.setRawResponse(
      ['blame', 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', '--line-porcelain', '--', 'src/app.ts'],
      [
        'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa 1 1 2',
        'author Alice',
        'author-mail <alice@example.com>',
        'author-time 1577836800',
        '\tline 1',
        '\tline 2',
      ].join('\n')
    );

    git.setRawResponse(
      ['blame', 'cccccccccccccccccccccccccccccccccccccccc', '--line-porcelain', '--', 'src/app.ts'],
      [
        'cccccccccccccccccccccccccccccccccccccccc 1 1 3',
        'author Bob',
        'author-mail <bob@example.com>',
        'author-time 1640995200',
        '\tline 1',
        '\tline 2',
        '\tline 3',
      ].join('\n')
    );

    const analyzer = new EvolutionAnalyzer('/tmp/repo', settings, git);
    const result = await analyzer.analyze();

    expect(result.authors.labels).toContain('Alice');
    expect(result.authors.labels).toContain('Bob');

    const aliceIndex = result.authors.labels.indexOf('Alice');
    const bobIndex = result.authors.labels.indexOf('Bob');

    expect(result.authors.y[aliceIndex]).toEqual([2, 2, 0]);
    expect(result.authors.y[bobIndex]).toEqual([0, 0, 3]);

    // Blame should run only for first and changed snapshot (not unchanged middle snapshot)
    expect(git.blameCallCount).toBe(2);
  });

  it('respects maxSnapshots downsampling', async () => {
    const git = new FakeGitClient(true);
    const settings = createSettings({ snapshotIntervalDays: 1, maxSnapshots: 3 });

    git.setRevparseResponse(['--abbrev-ref', 'HEAD'], 'main\n');
    git.setRevparseResponse(['HEAD'], '9999999999999999999999999999999999999999\n');

    const commits: string[] = [];
    for (let i = 0; i < 10; i++) {
      const sha = `${i}`.repeat(40).slice(0, 40);
      commits.push(`${sha}|${1700000000 + (i * 86400)}`);
      git.setRawResponse(
        ['ls-tree', '-r', '--name-only', sha],
        `src/file${i}.ts\n`
      );
      git.setRawResponse(
        ['blame', sha, '--line-porcelain', '--', `src/file${i}.ts`],
        [
          `${sha} 1 1 1`,
          `author User${i}`,
          `author-mail <user${i}@example.com>`,
          `author-time ${1700000000 + (i * 86400)}`,
          '\tline',
        ].join('\n')
      );
    }

    git.setRawResponse(
      ['log', '--first-parent', '--reverse', '--format=%H|%ct', 'main'],
      commits.join('\n')
    );

    const analyzer = new EvolutionAnalyzer('/tmp/repo', settings, git);
    const result = await analyzer.analyze();

    expect(result.cohorts.ts.length).toBeLessThanOrEqual(3);
  });
});
