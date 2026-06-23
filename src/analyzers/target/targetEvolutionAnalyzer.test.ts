import { afterEach, describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';
import { execFileSync } from 'child_process';
import type { AnalysisTarget, ExtensionSettings } from '../../types';
import { AnalysisCancelledError } from '../cancellation';
import { createEmptyHistogram } from '../evolution/shared';
import { createTargetEvolutionAnalyzer, TargetEvolutionAnalyzer } from './targetEvolutionAnalyzer';
import type { MemberCommit, MemberHeadInfo } from './memberEvolutionRuntime';

function runGit(args: string[], cwd: string, env: NodeJS.ProcessEnv = {}): string {
  return execFileSync('git', args, {
    cwd,
    env: { ...process.env, ...env },
    encoding: 'utf8',
  }).trim();
}

function commitFile(options: {
  repoPath: string;
  filePath: string;
  content: string;
  name: string;
  email: string;
  date: string;
  message: string;
}): void {
  const fullPath = path.join(options.repoPath, options.filePath);
  mkdirSync(path.dirname(fullPath), { recursive: true });
  writeFileSync(fullPath, options.content, 'utf8');
  runGit(['add', options.filePath], options.repoPath);
  runGit(['commit', '-m', options.message], options.repoPath, {
    GIT_AUTHOR_NAME: options.name,
    GIT_AUTHOR_EMAIL: options.email,
    GIT_AUTHOR_DATE: options.date,
    GIT_COMMITTER_NAME: options.name,
    GIT_COMMITTER_EMAIL: options.email,
    GIT_COMMITTER_DATE: options.date,
  });
}

function commitEmpty(options: {
  repoPath: string;
  name: string;
  email: string;
  date: string;
  message: string;
}): void {
  runGit(['commit', '--allow-empty', '-m', options.message], options.repoPath, {
    GIT_AUTHOR_NAME: options.name,
    GIT_AUTHOR_EMAIL: options.email,
    GIT_AUTHOR_DATE: options.date,
    GIT_COMMITTER_NAME: options.name,
    GIT_COMMITTER_EMAIL: options.email,
    GIT_COMMITTER_DATE: options.date,
  });
}

function initializeRepo(repoPath: string): void {
  runGit(['init', '-b', 'main'], repoPath);
  runGit(['config', 'user.name', 'Test User'], repoPath);
  runGit(['config', 'user.email', 'test@example.com'], repoPath);
  runGit(['config', 'commit.gpgsign', 'false'], repoPath);
}

function createTarget(
  members: Array<{ repoPath: string; displayName: string }>,
  id = 'workspace:test',
  kind: AnalysisTarget['kind'] = 'workspace'
): AnalysisTarget {
  return {
    id,
    kind,
    label: kind === 'repository' ? members[0]?.displayName ?? 'Repository' : 'Workspace repositories',
    settingsScope: kind === 'repository' ? 'repo' : 'workspace',
    members: members.map((member) => ({
      id: member.repoPath,
      role: kind === 'repository' ? 'primary' : 'workspaceRepo',
      repoPath: member.repoPath,
      displayName: member.displayName,
      logicalRoot: member.displayName,
      pathPrefix: kind === 'repository' ? '' : member.displayName,
    })),
  };
}

function createSettings(overrides: Partial<ExtensionSettings['evolution']> = {}): ExtensionSettings {
  return {
    excludePatterns: [],
    maxCommitsToAnalyze: 1000,
    defaultColorMode: 'language',
    generatedPatterns: [],
    binaryExtensions: ['.png'],
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
    treemap: {
      ageColorRangeMode: 'auto',
      ageColorNewestDate: '',
      ageColorOldestDate: '',
    },
    evolution: {
      autoRun: false,
      historyTraversalMode: 'firstParent',
      samplingMode: 'time',
      snapshotIntervalDays: 7,
      showInactivePeriods: false,
      maxSnapshots: 20,
      maxSeries: 20,
      cohortFormat: '%Y',
      ...overrides,
    },
    commitMetadata: {
      extractors: [
        {
          id: 'conventionalType',
          name: 'Conventional Commit Type',
          enabled: true,
          dimension: 'type',
          includeUnmatched: false,
          unmatchedValue: 'Uncategorized',
          aliases: {},
          kind: 'builtIn',
          builtInId: 'conventionalType',
        },
      ],
      defaultExtractorId: 'conventionalType',
      defaultBucketMode: 'calendar',
      defaultCalendarGranularity: 'month',
      defaultCommitBucketStrategy: 'fixedSize',
      defaultCommitBucketSize: 100,
      defaultCommitBucketCount: 12,
      defaultMetric: 'commits',
      defaultChartType: 'stackedBar',
      multiValueMode: 'countEach',
      includeUncategorized: true,
      maxSeries: 12,
      includeOtherSeries: true,
    },
  };
}

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error?: unknown) => void;
  const promise = new Promise<T>((innerResolve, innerReject) => {
    resolve = innerResolve;
    reject = innerReject;
  });

  return { promise, resolve, reject };
}

describe('TargetEvolutionAnalyzer', () => {
  const repos: string[] = [];

  afterEach(() => {
    for (const repoPath of repos.splice(0)) {
      rmSync(repoPath, { recursive: true, force: true });
    }
  });

  it('merges evolution snapshots across multiple repositories', async () => {
    const repoA = mkdtempSync(path.join(tmpdir(), 'repo-stats-target-evo-a-'));
    const repoB = mkdtempSync(path.join(tmpdir(), 'repo-stats-target-evo-b-'));
    repos.push(repoA, repoB);

    for (const repoPath of [repoA, repoB]) {
      initializeRepo(repoPath);
    }

    commitFile({
      repoPath: repoA,
      filePath: 'src/app.ts',
      content: 'const app = 1;\n',
      name: 'Alice',
      email: 'alice@example.com',
      date: '2024-01-01T12:00:00Z',
      message: 'add app',
    });
    commitFile({
      repoPath: repoB,
      filePath: 'lib/util.ts',
      content: 'export const util = 1;\n',
      name: 'Bob',
      email: 'bob@example.com',
      date: '2024-02-01T12:00:00Z',
      message: 'add util',
    });

    const target = createTarget([
      { repoPath: repoA, displayName: 'repo-a' },
      { repoPath: repoB, displayName: 'repo-b' },
    ]);

    const phases: string[] = [];
    const result = await createTargetEvolutionAnalyzer(target, createSettings()).analyze((update) => {
      phases.push(update.phase);
    });

    expect(result.targetId).toBe('workspace:test');
    expect(result.historyMode).toBe('mergedMembers');
    expect(result.memberHeads).toHaveLength(2);
    expect(result.authors.labels).toEqual(expect.arrayContaining(['Alice', 'Bob']));
    expect(result.directories.labels).toEqual(expect.arrayContaining(['repo-a/', 'repo-b/']));
    expect(result.authors.snapshots).toHaveLength(2);
    expect(result.authors.seriesValues.flat().reduce((sum, value) => sum + value, 0)).toBeGreaterThan(0);
    expect(phases).toEqual(expect.arrayContaining([
      expect.stringContaining('Selected 2 snapshots across 2 history events'),
      expect.stringContaining('Analyzing snapshots for repo-a'),
      expect.stringContaining('Analyzing snapshots for repo-b'),
    ]));
  });

  it('keeps single-member targets on the canonical evolution analyzer path', async () => {
    const repoPath = mkdtempSync(path.join(tmpdir(), 'repo-stats-target-evo-single-'));
    repos.push(repoPath);
    initializeRepo(repoPath);

    commitFile({
      repoPath,
      filePath: 'src/app.ts',
      content: 'const app = 1;\nconst other = 2;\n',
      name: 'Alice',
      email: 'alice@example.com',
      date: '2020-01-01T12:00:00Z',
      message: 'add app',
    });
    commitEmpty({
      repoPath,
      name: 'Alice',
      email: 'alice@example.com',
      date: '2020-02-01T12:00:00Z',
      message: 'empty checkpoint',
    });
    commitFile({
      repoPath,
      filePath: 'src/app.ts',
      content: 'const renamed = 10;\nconst changed = 20;\nconst third = 30;\n',
      name: 'Bob',
      email: 'bob@example.com',
      date: '2022-01-01T12:00:00Z',
      message: 'rewrite app',
    });

    const result = await createTargetEvolutionAnalyzer(
      createTarget([{ repoPath, displayName: 'single-repo' }], 'repo:single', 'repository'),
      createSettings()
    ).analyze();

    expect(result.targetId).toBe('repo:single');
    expect(result.historyMode).toBe('singleBranch');
    expect(result.memberHeads).toHaveLength(1);
    expect(result.memberHeads[0]?.repositoryName).toBe('single-repo');
    expect(result.authors.labels).toEqual(expect.arrayContaining(['Alice', 'Bob']));

    const aliceIndex = result.authors.labels.indexOf('Alice');
    const bobIndex = result.authors.labels.indexOf('Bob');

    expect(result.authors.seriesValues[aliceIndex]).toEqual([2, 2, 0]);
    expect(result.authors.seriesValues[bobIndex]).toEqual([0, 0, 3]);
    expect(result.authors.snapshots).toHaveLength(3);
    expect(result.authors.snapshots?.map((snapshot) => snapshot.commitIndex)).toEqual([0, 1, 2]);
  });

  it('can include merged branch commits when Evolution full history mode is enabled', async () => {
    const repoPath = mkdtempSync(path.join(tmpdir(), 'repo-stats-target-evo-history-'));
    repos.push(repoPath);
    initializeRepo(repoPath);

    commitFile({
      repoPath,
      filePath: 'base.txt',
      content: 'base\n',
      name: 'Alice',
      email: 'alice@example.com',
      date: '2024-01-01T12:00:00Z',
      message: 'base',
    });
    runGit(['checkout', '-b', 'feature'], repoPath);
    commitFile({
      repoPath,
      filePath: 'feature.txt',
      content: 'feature\n',
      name: 'Feature Author',
      email: 'feature@example.com',
      date: '2024-01-02T12:00:00Z',
      message: 'feature work',
    });
    runGit(['checkout', 'main'], repoPath);
    commitFile({
      repoPath,
      filePath: 'main.txt',
      content: 'main\n',
      name: 'Main Author',
      email: 'main@example.com',
      date: '2024-01-03T12:00:00Z',
      message: 'main work',
    });
    runGit(['merge', '--no-ff', 'feature', '-m', 'merge feature'], repoPath, {
      GIT_AUTHOR_NAME: 'Merge Author',
      GIT_AUTHOR_EMAIL: 'merge@example.com',
      GIT_AUTHOR_DATE: '2024-01-04T12:00:00Z',
      GIT_COMMITTER_NAME: 'Merge Author',
      GIT_COMMITTER_EMAIL: 'merge@example.com',
      GIT_COMMITTER_DATE: '2024-01-04T12:00:00Z',
    });

    const target = createTarget([{ repoPath, displayName: 'history-repo' }], 'repo:history', 'repository');
    const firstParent = await createTargetEvolutionAnalyzer(
      target,
      createSettings({ samplingMode: 'commit', maxSnapshots: 10, historyTraversalMode: 'firstParent' })
    ).analyze();
    const fullHistory = await createTargetEvolutionAnalyzer(
      target,
      createSettings({ samplingMode: 'commit', maxSnapshots: 10, historyTraversalMode: 'full' })
    ).analyze();

    expect(firstParent.historyTraversalMode).toBe('firstParent');
    expect(firstParent.authors.snapshots?.at(-1)?.totalCommitCount).toBe(3);
    expect(fullHistory.historyTraversalMode).toBe('full');
    expect(fullHistory.authors.snapshots?.at(-1)?.totalCommitCount).toBe(4);
  });

  it('supports commit-based snapshot distribution for single-member targets', async () => {
    const repoPath = mkdtempSync(path.join(tmpdir(), 'repo-stats-target-evo-commit-'));
    repos.push(repoPath);
    initializeRepo(repoPath);

    for (let index = 0; index < 8; index += 1) {
      commitFile({
        repoPath,
        filePath: `src/file${index}.ts`,
        content: `export const value${index} = ${index};\n`,
        name: `User${index}`,
        email: `user${index}@example.com`,
        date: new Date(Date.UTC(2024, 0, index + 1, 12, 0, 0)).toISOString(),
        message: `commit ${index}`,
      });
    }

    const result = await createTargetEvolutionAnalyzer(
      createTarget([{ repoPath, displayName: 'commit-repo' }], 'repo:commit', 'repository'),
      createSettings({
        samplingMode: 'commit',
        maxSnapshots: 4,
      })
    ).analyze();

    expect(result.historyMode).toBe('singleBranch');
    expect(result.authors.snapshots?.map((snapshot) => snapshot.commitIndex)).toEqual([0, 2, 5, 7]);
    expect(result.authors.snapshots?.every((snapshot) => snapshot.samplingMode === 'commit')).toBe(true);
  });

  it('cancels during snapshot analysis without producing a final result', async () => {
    const target = createTarget([{ repoPath: '/repos/cancelled', displayName: 'cancelled-repo' }], 'repo:cancelled', 'repository');
    const abortController = new AbortController();
    const analyzeStarted = createDeferred<void>();
    const analyzeResult = createDeferred<Map<string, ReturnType<typeof createEmptyHistogram>>>();

    const commit: MemberCommit = {
      sha: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      timestamp: 1710000000,
      commitIndex: 0,
      totalCommitCount: 1,
      branch: 'main',
      globalIndex: 0,
    };
    const headInfo: MemberHeadInfo = {
      repositoryId: '/repos/cancelled',
      repositoryName: 'cancelled-repo',
      branch: 'main',
      headSha: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    };

    const analyzer = new TargetEvolutionAnalyzer(
      target,
      createSettings(),
      abortController.signal,
      (member) => ({
        member,
        expectedBlameMisses: 0,
        getHeadInfo: async () => headInfo,
        getCommitHistory: async () => [commit],
        analyzeCommits: async () => {
          analyzeStarted.resolve();
          return analyzeResult.promise;
        },
      })
    );

    const analysisPromise = analyzer.analyze();
    await analyzeStarted.promise;

    abortController.abort('user');
    analyzeResult.resolve(new Map([[commit.sha, createEmptyHistogram()]]));

    await expect(analysisPromise).rejects.toBeInstanceOf(AnalysisCancelledError);
  });
});
