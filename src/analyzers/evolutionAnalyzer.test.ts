import { describe, expect, it } from 'vitest';
import {
  EvolutionAnalyzer,
  EvolutionGitClient,
} from './evolutionAnalyzer';
import { ExtensionSettings, NotAGitRepoError } from '../types';

class FakeGitClient implements EvolutionGitClient {
  private readonly responses = new Map<string, string>();
  private readonly errors = new Map<string, Error>();
  private readonly revparseResponses = new Map<string, string>();
  public blameCallCount = 0;

  constructor(private readonly isRepoResult: boolean = true) {}

  setRawResponse(args: string[], output: string): void {
    this.responses.set(args.join(' '), output);
  }

  setRawError(args: string[], error: Error): void {
    this.errors.set(args.join(' '), error);
  }

  setRevparseResponse(args: string[], output: string): void {
    this.revparseResponses.set(args.join(' '), output);
  }

  async checkIsRepo(): Promise<boolean> {
    return this.isRepoResult;
  }

  async revparse(args: string[]): Promise<string> {
    const key = args.join(' ');
    const response = this.revparseResponses.get(key);
    if (response === undefined) {
      throw new Error(`Missing revparse response for: ${key}`);
    }

    return response;
  }

  async raw(args: string[]): Promise<string> {
    const key = args.join(' ');
    if (key.includes('blame')) {
      this.blameCallCount += 1;
    }

    const error = this.errors.get(key);
    if (error) {
      throw error;
    }

    const response = this.responses.get(key);
    if (response === undefined) {
      throw new Error(`Missing raw response for: ${key}`);
    }

    return response;
  }
}

function createSettings(overrides?: Partial<ExtensionSettings['evolution']>): ExtensionSettings {
  const baseEvolution: ExtensionSettings['evolution'] = {
    autoRun: false,
    samplingMode: 'time',
    snapshotIntervalDays: 30,
    snapshotIntervalCommits: 100,
    showInactivePeriods: false,
    maxSnapshots: 80,
    maxSeries: 20,
    cohortFormat: '%Y',
  };

  return {
    excludePatterns: [],
    maxCommitsToAnalyze: 1000,
    defaultColorMode: 'language',
    generatedPatterns: [],
    binaryExtensions: ['.png', '.jpg'],
    locExcludedExtensions: [],
    includeSubmodules: false,
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
    treemap: {
      ageColorRangeMode: 'auto',
      ageColorNewestDate: '',
      ageColorOldestDate: '',
    },
    evolution: {
      ...baseEvolution,
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
    expect(result.authors.snapshots).toEqual([
      {
        commitSha: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        commitIndex: 0,
        totalCommitCount: 3,
        committedAt: '2020-01-01T00:00:00.000Z',
        samplingMode: 'time',
      },
      {
        commitSha: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
        commitIndex: 1,
        totalCommitCount: 3,
        committedAt: '2020-02-01T00:00:00.000Z',
        samplingMode: 'time',
      },
      {
        commitSha: 'cccccccccccccccccccccccccccccccccccccccc',
        commitIndex: 2,
        totalCommitCount: 3,
        committedAt: '2022-01-01T00:00:00.000Z',
        samplingMode: 'time',
      },
    ]);

    // Blame should run only for first and changed snapshot (not unchanged middle snapshot)
    expect(git.blameCallCount).toBe(2);
  });

  it('throws on unexpected blame command failures', async () => {
    const git = new FakeGitClient(true);
    const settings = createSettings({ snapshotIntervalDays: 30, maxSnapshots: 10 });

    git.setRevparseResponse(['--abbrev-ref', 'HEAD'], 'main\n');
    git.setRevparseResponse(['HEAD'], 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\n');
    git.setRawResponse(
      ['log', '--first-parent', '--reverse', '--format=%H|%ct', 'main'],
      'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa|1577836800'
    );
    git.setRawResponse(
      ['ls-tree', '-r', '--name-only', 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'],
      'src/app.ts\n'
    );
    git.setRawError(
      ['blame', 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', '--line-porcelain', '--', 'src/app.ts'],
      new Error('fatal: unexpected io error')
    );

    const analyzer = new EvolutionAnalyzer('/tmp/repo', settings, git);

    await expect(analyzer.analyze()).rejects.toThrow(/Failed to run git blame/);
  });

  it('supports commit-based snapshot sampling', async () => {
    const git = new FakeGitClient(true);
    const settings = createSettings({ samplingMode: 'commit', snapshotIntervalCommits: 3, maxSnapshots: 10 });

    git.setRevparseResponse(['--abbrev-ref', 'HEAD'], 'main\n');
    git.setRevparseResponse(['HEAD'], '9999999999999999999999999999999999999999\n');

    const commits: string[] = [];
    for (let i = 0; i < 8; i++) {
      const sha = `${i}`.repeat(40).slice(0, 40);
      commits.push(`${sha}|${1700000000 + (i * 86400)}`);
      git.setRawResponse(['ls-tree', '-r', '--name-only', sha], `src/file${i}.ts\n`);
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

    git.setRawResponse(['log', '--first-parent', '--reverse', '--format=%H|%ct', 'main'], commits.join('\n'));
    git.setRawResponse(['diff-tree', '--no-commit-id', '--name-status', '-r', '0000000000000000000000000000000000000000', '3333333333333333333333333333333333333333'], '');
    git.setRawResponse(['diff-tree', '--no-commit-id', '--name-status', '-r', '3333333333333333333333333333333333333333', '6666666666666666666666666666666666666666'], '');
    git.setRawResponse(['diff-tree', '--no-commit-id', '--name-status', '-r', '6666666666666666666666666666666666666666', '7777777777777777777777777777777777777777'], '');

    const analyzer = new EvolutionAnalyzer('/tmp/repo', settings, git);
    const result = await analyzer.analyze();

    expect(result.cohorts.snapshots?.map((snapshot) => snapshot.commitIndex)).toEqual([0, 3, 6, 7]);
    expect(result.cohorts.snapshots?.every((snapshot) => snapshot.samplingMode === 'commit')).toBe(true);
  });

  it('supports auto-distributed snapshot sampling', async () => {
    const git = new FakeGitClient(true);
    const settings = createSettings({ samplingMode: 'auto', maxSnapshots: 4 });

    git.setRevparseResponse(['--abbrev-ref', 'HEAD'], 'main\n');
    git.setRevparseResponse(['HEAD'], '9999999999999999999999999999999999999999\n');

    const commits: string[] = [];
    for (let i = 0; i < 10; i++) {
      const sha = `${i}`.repeat(40).slice(0, 40);
      commits.push(`${sha}|${1700000000 + (i * 86400)}`);
      git.setRawResponse(['ls-tree', '-r', '--name-only', sha], `src/file${i}.ts\n`);
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

    git.setRawResponse(['log', '--first-parent', '--reverse', '--format=%H|%ct', 'main'], commits.join('\n'));
    git.setRawResponse(['diff-tree', '--no-commit-id', '--name-status', '-r', '0000000000000000000000000000000000000000', '3333333333333333333333333333333333333333'], '');
    git.setRawResponse(['diff-tree', '--no-commit-id', '--name-status', '-r', '3333333333333333333333333333333333333333', '6666666666666666666666666666666666666666'], '');
    git.setRawResponse(['diff-tree', '--no-commit-id', '--name-status', '-r', '6666666666666666666666666666666666666666', '9999999999999999999999999999999999999999'], '');

    const analyzer = new EvolutionAnalyzer('/tmp/repo', settings, git);
    const result = await analyzer.analyze();

    expect(result.cohorts.snapshots?.map((snapshot) => snapshot.commitIndex)).toEqual([0, 3, 6, 9]);
    expect(result.cohorts.snapshots?.every((snapshot) => snapshot.samplingMode === 'auto')).toBe(true);
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

    // Downsampling selects commits 0, 5, and 9 for maxSnapshots=3.
    git.setRawResponse(
      ['diff-tree', '--no-commit-id', '--name-status', '-r', '0000000000000000000000000000000000000000', '5555555555555555555555555555555555555555'],
      ''
    );
    git.setRawResponse(
      ['diff-tree', '--no-commit-id', '--name-status', '-r', '5555555555555555555555555555555555555555', '9999999999999999999999999999999999999999'],
      ''
    );

    const analyzer = new EvolutionAnalyzer('/tmp/repo', settings, git);
    const result = await analyzer.analyze();

    expect(result.cohorts.ts.length).toBeLessThanOrEqual(3);
    expect(result.cohorts.snapshots?.map((snapshot) => snapshot.commitIndex)).toEqual([0, 5, 9]);
    expect(result.cohorts.snapshots?.every((snapshot) => snapshot.samplingMode === 'time')).toBe(true);
  });

  it('matches root-level directories for leading ** exclude patterns', async () => {
    const git = new FakeGitClient(true);
    const settings = createSettings({ snapshotIntervalDays: 30, maxSnapshots: 10 });
    settings.excludePatterns = ['**/backend/fixtures/**'];

    git.setRevparseResponse(['--abbrev-ref', 'HEAD'], 'main\n');
    git.setRevparseResponse(['HEAD'], 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\n');
    git.setRawResponse(
      ['log', '--first-parent', '--reverse', '--format=%H|%ct', 'main'],
      'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa|1577836800'
    );
    git.setRawResponse(
      ['ls-tree', '-r', '--name-only', 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'],
      ['backend/fixtures/seed.ts', 'src/app.ts'].join('\n')
    );
    git.setRawResponse(
      ['blame', 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', '--line-porcelain', '--', 'src/app.ts'],
      [
        'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa 1 1 1',
        'author Alice',
        'author-mail <alice@example.com>',
        'author-time 1577836800',
        '\tline',
      ].join('\n')
    );

    const analyzer = new EvolutionAnalyzer('/tmp/repo', settings, git);
    const result = await analyzer.analyze();

    expect(result.exts.labels).toEqual(['.ts']);
    expect(result.exts.y[0]).toEqual([1]);
    expect(git.blameCallCount).toBe(1);
  });

  it('normalizes binary extension settings before filtering evolution files', async () => {
    const git = new FakeGitClient(true);
    const settings = createSettings({ snapshotIntervalDays: 30, maxSnapshots: 10 });
    settings.binaryExtensions = ['PNG'];

    git.setRevparseResponse(['--abbrev-ref', 'HEAD'], 'main\n');
    git.setRevparseResponse(['HEAD'], 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\n');
    git.setRawResponse(
      ['log', '--first-parent', '--reverse', '--format=%H|%ct', 'main'],
      'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa|1577836800'
    );
    git.setRawResponse(
      ['ls-tree', '-r', '--name-only', 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'],
      ['assets/logo.png', 'src/app.ts'].join('\n')
    );
    git.setRawResponse(
      ['blame', 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', '--line-porcelain', '--', 'src/app.ts'],
      [
        'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa 1 1 1',
        'author Alice',
        'author-mail <alice@example.com>',
        'author-time 1577836800',
        '\tline',
      ].join('\n')
    );

    const analyzer = new EvolutionAnalyzer('/tmp/repo', settings, git);
    const result = await analyzer.analyze();

    expect(result.exts.labels).toEqual(['.ts']);
    expect(git.blameCallCount).toBe(1);
  });
});
