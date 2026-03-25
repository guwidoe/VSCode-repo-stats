import { beforeEach, describe, expect, it, vi } from 'vitest';
import { normalizeEvolutionResult, type AnalysisResult, type EvolutionResult, type ExtensionSettings } from '../types';
import type { AnalysisTargetContext } from './context';

const mockCacheManagerState = {
  getIfValid: null as AnalysisResult | null,
  blameFileCaches: {} as Record<string, Record<string, unknown>>,
  save: vi.fn(async () => {}),
  clear: vi.fn(async () => {}),
};

const mockEvolutionCacheManagerState = {
  getIfValid: null as EvolutionResult | null,
  getLatest: null as EvolutionResult | null,
  save: vi.fn(async () => {}),
  clear: vi.fn(async () => {}),
};

const mockCoordinatorState = {
  revisions: [{ repositoryId: 'repo-1', branch: 'main', headSha: 'head-1' }],
  latestBlameFileCaches: { 'repo-1': {} as Record<string, unknown> },
  analyze: vi.fn(async (callbacks?: {
    onProgress?: (phase: string, progress: number) => void;
    onCoreReady?: (result: AnalysisResult) => void;
    onBlameUpdate?: (blameMetrics: AnalysisResult['blameMetrics']) => void;
  }) => {
    callbacks?.onProgress?.('Loading commits', 25);
    callbacks?.onCoreReady?.(createAnalysisResult('core-result', 0));
    callbacks?.onBlameUpdate?.(createAnalysisResult('final-result', 5).blameMetrics);
    return createAnalysisResult('final-result', 5);
  }),
};

const mockEvolutionAnalyzerState = {
  analyze: vi.fn(async (onProgress?: (update: Record<string, unknown>) => void) => {
    onProgress?.({ phase: 'Sampling history', progress: 33, stage: 'sampling' });
    return createEvolutionResult('current-evo-hash', 'settings-hash');
  }),
};

const gitHeads = new Map<string, { branch: string; headSha: string; error?: Error }>();

vi.mock('../cache/cacheManager.js', () => ({
  CacheManager: class {
    getBlameFileCaches() {
      return mockCacheManagerState.blameFileCaches;
    }
    getIfValid() {
      return mockCacheManagerState.getIfValid;
    }
    async save() {
      await mockCacheManagerState.save();
    }
    async clear() {
      await mockCacheManagerState.clear();
    }
  },
}));

vi.mock('../cache/evolutionCacheManager.js', () => ({
  EvolutionCacheManager: class {
    getIfValid() {
      return mockEvolutionCacheManagerState.getIfValid;
    }
    getLatest() {
      return mockEvolutionCacheManagerState.getLatest;
    }
    async save() {
      await mockEvolutionCacheManagerState.save();
    }
    async clear() {
      await mockEvolutionCacheManagerState.clear();
    }
  },
}));

vi.mock('../analyzers/target/targetCoordinator.js', () => ({
  TargetAnalysisCoordinator: class {
    async getTargetRevision() {
      return mockCoordinatorState.revisions;
    }
    async analyze(callbacks?: Parameters<typeof mockCoordinatorState.analyze>[0]) {
      return mockCoordinatorState.analyze(callbacks);
    }
    getLatestBlameFileCaches() {
      return mockCoordinatorState.latestBlameFileCaches;
    }
  },
}));

vi.mock('../analyzers/target/targetEvolutionAnalyzer.js', () => ({
  createTargetEvolutionAnalyzer: () => ({
    analyze: mockEvolutionAnalyzerState.analyze,
  }),
}));

vi.mock('simple-git', () => ({
  default: (repoPath: string) => ({
    revparse: async (args: string[]) => {
      const next = gitHeads.get(repoPath);
      if (!next) {
        throw new Error(`No git head configured for ${repoPath}`);
      }
      if (next.error) {
        throw next.error;
      }
      return args.includes('--abbrev-ref') ? next.branch : next.headSha;
    },
  }),
}));

import { RepoAnalysisService } from './analysisService';

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error?: unknown) => void;
  const promise = new Promise<T>((innerResolve, innerReject) => {
    resolve = innerResolve;
    reject = innerReject;
  });

  return { promise, resolve, reject };
}

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
      maxSnapshots: 50,
      maxSeries: 20,
      cohortFormat: '%Y',
    },
  };
}

function createAnalysisResult(label: string, blamedLines: number): AnalysisResult {
  return {
    target: {
      id: 'target-1',
      kind: 'repository',
      label,
      memberCount: 1,
    },
    repositories: [
      {
        id: 'repo-1',
        name: 'repo',
        path: '/repos/repo-1',
        branch: 'main',
        commitCount: 3,
        headSha: 'head-1',
        role: 'primary',
        logicalRoot: 'repo',
        pathPrefix: '',
      },
    ],
    contributors: [],
    codeFrequency: [],
    commitAnalytics: {
      authorDirectory: { idByEmail: {}, namesById: [], emailsById: [] },
      records: [],
      summary: {
        totalCommits: 0,
        totalAdditions: 0,
        totalDeletions: 0,
        totalChangedLines: 0,
        averageChangedLines: 0,
        medianChangedLines: 0,
        averageFilesChanged: 0,
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
    fileTree: { name: 'repo', path: '', type: 'directory', children: [] },
    analyzedAt: '2026-03-24T00:00:00.000Z',
    analyzedCommitCount: 0,
    maxCommitsLimit: 100,
    limitReached: false,
    sccInfo: { version: '3.5.0', source: 'system' },
    blameMetrics: {
      analyzedAt: '2026-03-24T00:00:00.000Z',
      maxAgeDays: 10,
      ageByDay: [blamedLines],
      ownershipByAuthor: [],
      totals: {
        totalBlamedLines: blamedLines,
        filesAnalyzed: blamedLines > 0 ? 1 : 0,
        filesSkipped: 0,
        cacheHits: 0,
      },
    },
  };
}

function createEvolutionResult(revisionHash: string, settingsHash: string): EvolutionResult {
  return normalizeEvolutionResult({
    generatedAt: '2026-03-24T00:00:00.000Z',
    targetId: 'target-1',
    historyMode: 'singleBranch',
    revisionHash,
    settingsHash,
    memberHeads: [
      {
        repositoryId: 'repo-1',
        repositoryName: 'repo',
        branch: 'main',
        headSha: 'head-1',
      },
    ],
    cohorts: { ts: [], y: [], labels: [] },
    authors: { ts: [], y: [], labels: [] },
    exts: { ts: [], y: [], labels: [] },
    dirs: { ts: [], y: [], labels: [] },
    domains: { ts: [], y: [], labels: [] },
  });
}

function createTargetContext(): AnalysisTargetContext {
  return {
    option: {
      id: 'target-1',
      kind: 'repository',
      label: 'Repo',
      memberCount: 1,
      settingsScope: 'repo',
    },
    target: {
      id: 'target-1',
      kind: 'repository',
      label: 'Repo',
      members: [
        {
          id: 'repo-1',
          role: 'primary',
          repoPath: '/repos/repo-1',
          displayName: 'Repo',
          logicalRoot: 'repo',
          pathPrefix: '',
        },
      ],
      settingsScope: 'repo',
    },
    settingsRepository: {
      option: { path: '/repos/repo-1', name: 'repo', source: 'workspace', relativePath: '.' },
      rootUri: { fsPath: '/repos/repo-1' },
    },
  } as AnalysisTargetContext;
}

function createService() {
  const settings = createSettings();
  const settingsService = {
    getSettings: vi.fn(() => settings),
  };
  const workspaceState = {
    get: vi.fn(),
    update: vi.fn(async () => {}),
  };
  const webview = {
    postMessage: vi.fn(),
  };

  return {
    service: new RepoAnalysisService(workspaceState as never, '/tmp/storage', settingsService as never),
    settingsService,
    workspaceState,
    webview,
  };
}

beforeEach(() => {
  mockCacheManagerState.getIfValid = null;
  mockCacheManagerState.blameFileCaches = {};
  mockCacheManagerState.save.mockClear();
  mockCacheManagerState.clear.mockClear();
  mockEvolutionCacheManagerState.getIfValid = null;
  mockEvolutionCacheManagerState.getLatest = null;
  mockEvolutionCacheManagerState.save.mockClear();
  mockEvolutionCacheManagerState.clear.mockClear();
  mockCoordinatorState.revisions = [{ repositoryId: 'repo-1', branch: 'main', headSha: 'head-1' }];
  mockCoordinatorState.latestBlameFileCaches = { 'repo-1': {} };
  mockCoordinatorState.analyze.mockClear();
  mockCoordinatorState.analyze.mockImplementation(async (callbacks) => {
    callbacks?.onProgress?.('Loading commits', 25);
    callbacks?.onCoreReady?.(createAnalysisResult('core-result', 0));
    callbacks?.onBlameUpdate?.(createAnalysisResult('final-result', 5).blameMetrics);
    return createAnalysisResult('final-result', 5);
  });
  mockEvolutionAnalyzerState.analyze.mockClear();
  mockEvolutionAnalyzerState.analyze.mockImplementation(async (onProgress) => {
    onProgress?.({ phase: 'Sampling history', progress: 33, stage: 'sampling' });
    return createEvolutionResult('current-evo-hash', 'settings-hash');
  });
  gitHeads.clear();
  gitHeads.set('/repos/repo-1', { branch: 'main', headSha: 'head-1' });
});

describe('RepoAnalysisService', () => {
  it('sends cached analysis results without starting a fresh run', async () => {
    const { service, webview } = createService();
    mockCacheManagerState.getIfValid = createAnalysisResult('cached-result', 4);

    await service.runAnalysis(webview as never, createTargetContext());

    const messageTypes = webview.postMessage.mock.calls.map(([message]) => message.type);
    expect(messageTypes).toEqual(['analysisComplete', 'stalenessStatus']);
    expect(mockCoordinatorState.analyze).not.toHaveBeenCalled();
  });

  it('emits staged analysis messages for cache misses', async () => {
    const { service, webview } = createService();

    await service.runAnalysis(webview as never, createTargetContext());

    const messages = webview.postMessage.mock.calls.map(([message]) => message);
    expect(messages.map((message) => message.type)).toEqual([
      'analysisStarted',
      'analysisProgress',
      'analysisComplete',
      'incrementalUpdate',
      'analysisComplete',
      'stalenessStatus',
    ]);
    expect(messages[2]).toMatchObject({
      type: 'analysisComplete',
      data: expect.objectContaining({ target: expect.objectContaining({ label: 'core-result' }) }),
    });
    expect(messages[3]).toMatchObject({
      type: 'incrementalUpdate',
      data: { blameMetrics: expect.objectContaining({ totals: expect.objectContaining({ totalBlamedLines: 5 }) }) },
    });
    expect(mockCacheManagerState.save).toHaveBeenCalledTimes(1);
  });

  it('serves latest cached evolution data, marks it stale, and skips autorun when disabled', async () => {
    const { service, webview, settingsService } = createService();
    mockEvolutionCacheManagerState.getLatest = createEvolutionResult('old-evo-hash', 'old-settings-hash');
    settingsService.getSettings.mockReturnValue({
      ...createSettings(),
      evolution: {
        ...createSettings().evolution,
        autoRun: false,
      },
    });

    await service.runEvolutionAnalysis(webview as never, createTargetContext(), false);

    const messageTypes = webview.postMessage.mock.calls.map(([message]) => message.type);
    expect(messageTypes).toEqual(['evolutionComplete', 'evolutionStale', 'stalenessStatus']);
    expect(mockEvolutionAnalyzerState.analyze).not.toHaveBeenCalled();
  });

  it('surfaces staleness failures through analysisError', async () => {
    const { service, webview } = createService();
    gitHeads.set('/repos/repo-1', {
      branch: 'main',
      headSha: 'head-1',
      error: new Error('git unavailable'),
    });

    await service.sendStalenessStatus(webview as never, createTargetContext());

    expect(webview.postMessage).toHaveBeenCalledWith({
      type: 'analysisError',
      error: 'git unavailable',
    });
  });

  it('suppresses stale core results after a newer run starts', async () => {
    const { service, webview } = createService();
    const firstRun = createDeferred<AnalysisResult>();
    let firstRunCallbacks: Parameters<typeof mockCoordinatorState.analyze>[0] | undefined;

    mockCoordinatorState.analyze
      .mockImplementationOnce(async (callbacks) => {
        firstRunCallbacks = callbacks;
        return firstRun.promise;
      })
      .mockImplementationOnce(async (callbacks) => {
        callbacks?.onProgress?.('Loading second run', 50);
        callbacks?.onCoreReady?.(createAnalysisResult('second-core', 0));
        callbacks?.onBlameUpdate?.(createAnalysisResult('second-final', 8).blameMetrics);
        return createAnalysisResult('second-final', 8);
      });

    const target = createTargetContext();
    const firstPromise = service.runAnalysis(webview as never, target);
    await Promise.resolve();

    const secondPromise = service.runAnalysis(webview as never, target);

    firstRunCallbacks?.onProgress?.('Loading first run', 25);
    firstRunCallbacks?.onCoreReady?.(createAnalysisResult('first-core', 0));
    firstRunCallbacks?.onBlameUpdate?.(createAnalysisResult('first-final', 3).blameMetrics);
    firstRun.resolve(createAnalysisResult('first-final', 3));

    await Promise.all([firstPromise, secondPromise]);

    const analysisCompleteLabels = webview.postMessage.mock.calls
      .map(([message]) => message)
      .filter((message) => message.type === 'analysisComplete')
      .map((message) => message.data.target.label);

    expect(analysisCompleteLabels).toEqual(['second-core', 'second-final']);
    expect(mockCacheManagerState.save).toHaveBeenCalledTimes(1);
  });

  it('suppresses stale evolution results after a newer run starts', async () => {
    const { service, webview } = createService();
    const firstRun = createDeferred<EvolutionResult>();
    let firstProgress: ((update: Record<string, unknown>) => void) | undefined;

    mockEvolutionAnalyzerState.analyze
      .mockImplementationOnce(async (onProgress) => {
        firstProgress = onProgress;
        return firstRun.promise;
      })
      .mockImplementationOnce(async (onProgress) => {
        onProgress?.({ phase: 'Second run', progress: 50, stage: 'analyzing' });
        return createEvolutionResult('second-revision', 'settings-hash');
      });

    const target = createTargetContext();
    const firstPromise = service.runEvolutionAnalysis(webview as never, target, true);
    await Promise.resolve();

    const secondPromise = service.runEvolutionAnalysis(webview as never, target, true);

    firstProgress?.({ phase: 'First run', progress: 25, stage: 'sampling' });
    firstRun.resolve(createEvolutionResult('first-revision', 'settings-hash'));

    await Promise.all([firstPromise, secondPromise]);

    const completionHashes = webview.postMessage.mock.calls
      .map(([message]) => message)
      .filter((message) => message.type === 'evolutionComplete')
      .map((message) => message.data.revisionHash);

    expect(completionHashes).toEqual(['second-revision']);
    expect(mockEvolutionCacheManagerState.save).toHaveBeenCalledTimes(1);
  });
});
