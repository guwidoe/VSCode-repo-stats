import { describe, expect, it } from 'vitest';
import type { AnalysisCallbacks } from '../coordinator';
import { createEmptyBlameMetrics } from '../blameMetrics';
import { AnalysisCancelledError } from '../cancellation';
import { TargetAnalysisCoordinator } from './targetCoordinator';
import type {
  AnalysisResult,
  AnalysisTarget,
  BlameFileCacheEntry,
  BlameMetrics,
  ExtensionSettings,
} from '../../types';

function createSettings(): ExtensionSettings {
  return {
    excludePatterns: [],
    maxCommitsToAnalyze: 100,
    defaultColorMode: 'language',
    generatedPatterns: [],
    binaryExtensions: [],
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
      samplingMode: 'time',
      snapshotIntervalDays: 30,
      showInactivePeriods: false,
      maxSnapshots: 40,
      maxSeries: 20,
      cohortFormat: '%Y',
    },
  };
}

function createTarget(memberCount: number): AnalysisTarget {
  return {
    id: `target-${memberCount}`,
    kind: memberCount === 1 ? 'repository' : 'workspace',
    label: memberCount === 1 ? 'single' : 'workspace',
    members: Array.from({ length: memberCount }, (_, index) => ({
      id: `repo-${index + 1}`,
      role: memberCount === 1 ? 'primary' : 'workspaceRepo',
      repoPath: `/repos/repo-${index + 1}`,
      displayName: `Repo ${index + 1}`,
      logicalRoot: `repo-${index + 1}`,
      pathPrefix: memberCount === 1 ? '' : `repo-${index + 1}`,
    })),
    settingsScope: memberCount === 1 ? 'repo' : 'workspace',
  };
}

function createBlameMetrics(lines: number): BlameMetrics {
  return {
    analyzedAt: '2024-01-02T00:00:00Z',
    maxAgeDays: 10,
    ageByDay: [lines],
    ownershipByAuthor: [{ author: 'Test User', email: 'test@example.com', lines }],
    totals: {
      totalBlamedLines: lines,
      filesAnalyzed: 1,
      filesSkipped: 0,
      cacheHits: 0,
    },
  };
}

function createResult(memberId: string, repoPath: string, blameMetrics: BlameMetrics): AnalysisResult {
  return {
    target: {
      id: repoPath,
      kind: 'repository',
      label: memberId,
      memberCount: 1,
    },
    repositories: [
      {
        id: repoPath,
        name: memberId,
        path: repoPath,
        branch: 'main',
        commitCount: 1,
        headSha: `${memberId}-head`,
        role: 'primary',
        logicalRoot: memberId,
        pathPrefix: '',
      },
    ],
    contributors: [
      {
        name: 'Test User',
        email: 'test@example.com',
        commits: 1,
        linesAdded: 10,
        linesDeleted: 0,
        firstCommit: '2024-01-01T00:00:00Z',
        lastCommit: '2024-01-02T00:00:00Z',
        weeklyActivity: [{ week: '2024-W01', commits: 1, additions: 10, deletions: 0 }],
      },
    ],
    codeFrequency: [{ week: '2024-W01', additions: 10, deletions: 0, netChange: 10 }],
    commitAnalytics: {
      authorDirectory: {
        idByEmail: { 'test@example.com': 0 },
        namesById: ['Test User'],
        emailsById: ['test@example.com'],
      },
      records: [],
      summary: {
        totalCommits: 1,
        totalAdditions: 10,
        totalDeletions: 0,
        totalChangedLines: 10,
        averageChangedLines: 10,
        medianChangedLines: 10,
        averageFilesChanged: 1,
      },
      contributorSummaries: [],
      changedLineBuckets: [],
      fileChangeBuckets: [],
      indexes: {
        byTimestampAsc: [],
        byAdditionsDesc: [],
        byDeletionsDesc: [],
        byChangedLinesDesc: [],
        byFilesChangedDesc: [],
      },
    },
    fileTree: {
      name: memberId,
      path: '',
      type: 'directory',
      children: [],
    },
    analyzedAt: '2024-01-02T00:00:00Z',
    analyzedCommitCount: 1,
    maxCommitsLimit: 100,
    limitReached: false,
    sccInfo: { version: '3.5.0', source: 'system' },
    blameMetrics,
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

class FakeCoordinator {
  constructor(
    private readonly repoPath: string,
    private readonly memberId: string,
    private readonly options: {
      emitCoreReady: boolean;
      emitBlameUpdate: boolean;
      finalBlameLines: number;
    }
  ) {}

  async analyze(callbacks: AnalysisCallbacks = {}): Promise<AnalysisResult> {
    const coreResult = createResult(this.memberId, this.repoPath, createEmptyBlameMetrics());
    if (this.options.emitCoreReady) {
      callbacks.onCoreReady?.(coreResult);
    }
    if (this.options.emitBlameUpdate) {
      callbacks.onBlameUpdate?.(createBlameMetrics(this.options.finalBlameLines));
    }
    callbacks.onProgress?.('done', 100);
    return createResult(this.memberId, this.repoPath, createBlameMetrics(this.options.finalBlameLines));
  }

  getLatestBlameFileCache(): Record<string, BlameFileCacheEntry> {
    return {};
  }

  async getRepositoryInfo(): Promise<{ branch: string; headSha: string }> {
    return { branch: 'main', headSha: `${this.memberId}-head` };
  }
}

describe('TargetAnalysisCoordinator', () => {
  it('forwards staged callbacks for single-member targets', async () => {
    const target = createTarget(1);
    const coreResults: AnalysisResult[] = [];
    const blameUpdates: BlameMetrics[] = [];

    const coordinator = new TargetAnalysisCoordinator({
      target,
      settings: createSettings(),
      sccStoragePath: '/tmp/scc',
      coordinatorFactory: (member) => new FakeCoordinator(member.repoPath, member.displayName, {
        emitCoreReady: true,
        emitBlameUpdate: true,
        finalBlameLines: 12,
      }),
    });

    const result = await coordinator.analyze({
      onCoreReady: (value) => coreResults.push(value),
      onBlameUpdate: (value) => blameUpdates.push(value),
    });

    expect(coreResults).toHaveLength(1);
    expect(coreResults[0]?.repositories[0]).toMatchObject({
      id: 'repo-1',
      role: 'primary',
      pathPrefix: '',
    });
    expect(blameUpdates).toEqual([expect.objectContaining({ totals: expect.objectContaining({ totalBlamedLines: 12 }) })]);
    expect(result.repositories[0]).toMatchObject({
      id: 'repo-1',
      role: 'primary',
      pathPrefix: '',
    });
  });

  it('emits aggregate staged callbacks for multi-member targets as members finish', async () => {
    const target = createTarget(2);
    const coreResults: AnalysisResult[] = [];
    const blameUpdates: BlameMetrics[] = [];

    const coordinator = new TargetAnalysisCoordinator({
      target,
      settings: createSettings(),
      sccStoragePath: '/tmp/scc',
      coordinatorFactory: (member) => new FakeCoordinator(member.repoPath, member.displayName, {
        emitCoreReady: true,
        emitBlameUpdate: true,
        finalBlameLines: member.id === 'repo-1' ? 5 : 7,
      }),
    });

    const result = await coordinator.analyze({
      onCoreReady: (value) => coreResults.push(value),
      onBlameUpdate: (value) => blameUpdates.push(value),
    });

    expect(coreResults).toHaveLength(2);
    expect(blameUpdates).toEqual([]);
    expect(coreResults[0]).toMatchObject({
      target: expect.objectContaining({ memberCount: 2 }),
      repositories: [expect.objectContaining({ id: 'repo-1' })],
      blameMetrics: expect.objectContaining({ totals: expect.objectContaining({ totalBlamedLines: 5 }) }),
    });
    expect(coreResults[1]).toMatchObject({
      target: expect.objectContaining({ memberCount: 2 }),
      repositories: [
        expect.objectContaining({ id: 'repo-1' }),
        expect.objectContaining({ id: 'repo-2' }),
      ],
      blameMetrics: expect.objectContaining({ totals: expect.objectContaining({ totalBlamedLines: 12 }) }),
    });
    expect(result.repositories).toHaveLength(2);
    expect(result.target.memberCount).toBe(2);
    expect(result.blameMetrics.totals.totalBlamedLines).toBe(12);
  });

  it('stops before later members run when a multi-member analysis is canceled', async () => {
    const target = createTarget(2);
    const abortController = new AbortController();
    const firstResult = createDeferred<AnalysisResult>();
    const startedMembers: string[] = [];

    const coordinator = new TargetAnalysisCoordinator({
      target,
      settings: createSettings(),
      sccStoragePath: '/tmp/scc',
      signal: abortController.signal,
      coordinatorFactory: (member) => ({
        analyze: async () => {
          startedMembers.push(member.id);
          if (member.id === 'repo-1') {
            return firstResult.promise;
          }

          return createResult(member.displayName, member.repoPath, createBlameMetrics(7));
        },
        getLatestBlameFileCache: () => ({}),
        getRepositoryInfo: async () => ({ branch: 'main', headSha: `${member.id}-head` }),
      }),
    });

    const analyzePromise = coordinator.analyze();
    await Promise.resolve();

    abortController.abort('user');
    firstResult.resolve(createResult('Repo 1', '/repos/repo-1', createBlameMetrics(5)));

    await expect(analyzePromise).rejects.toBeInstanceOf(AnalysisCancelledError);
    expect(startedMembers).toEqual(['repo-1']);
  });
});
