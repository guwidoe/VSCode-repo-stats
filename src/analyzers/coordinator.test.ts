import { describe, expect, it } from 'vitest';
import { AnalysisCoordinator } from './coordinator';
import type { GitClient } from './gitAnalyzer';
import type { LOCClient } from './locCounter';
import type {
  BlameFileCacheEntry,
  CodeFrequency,
  CommitAnalytics,
  ContributorStats,
  ExtensionSettings,
  RepositoryInfo,
  SccInfo,
  TreemapNode,
} from '../types';

function createRepoInfo(): RepositoryInfo {
  return {
    name: 'repo',
    path: '/tmp/repo',
    branch: 'main',
    commitCount: 1,
    headSha: 'abc123',
  };
}

function createCommitAnalytics(): CommitAnalytics {
  return {
    authorDirectory: {
      idByEmail: {},
      namesById: [],
      emailsById: [],
    },
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
  };
}

function createEmptyTree(): TreemapNode {
  return {
    name: 'repo',
    path: '',
    type: 'directory',
    lines: 0,
    children: [],
  };
}

function createGitClient(overrides: Partial<GitClient> = {}): GitClient {
  const defaults: GitClient = {
    isRepo: async () => true,
    getRepoInfo: async () => createRepoInfo(),
    getCommitAnalytics: async () => createCommitAnalytics(),
    getContributorStats: async () => [] satisfies ContributorStats[],
    getCodeFrequency: async () => [] satisfies CodeFrequency[],
    getFileModificationDates: async () => new Map<string, string>(),
    getTrackedFiles: async () => [],
    getSubmodulePaths: async () => [],
    getHeadBlobShas: async () => new Map<string, string>(),
    raw: async () => '',
  };

  return { ...defaults, ...overrides };
}

function createLocClient(overrides: Partial<LOCClient> = {}): LOCClient {
  const defaults: LOCClient = {
    countLines: async () => createEmptyTree(),
    ensureSccAvailable: async () => {},
    getSccInfo: async () => ({
      version: 'test',
      source: 'system',
    } satisfies SccInfo),
  };

  return { ...defaults, ...overrides };
}

function createSettings(): ExtensionSettings {
  return {
    excludePatterns: ['**/backend/fixtures/**'],
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
      samplingMode: 'time',
      snapshotIntervalDays: 30,
      snapshotIntervalCommits: 100,
      showInactivePeriods: false,
      maxSnapshots: 80,
      maxSeries: 20,
      cohortFormat: '%Y',
    },
  };
}

describe('AnalysisCoordinator', () => {
  it('does not re-add tracked binary files from excluded directories', async () => {
    const coordinator = new AnalysisCoordinator(
      '/tmp/repo',
      createSettings(),
      '/tmp/scc',
      createGitClient({
        getTrackedFiles: async () => ['backend/fixtures/seed.png'],
      }),
      createLocClient(),
      {} as Record<string, BlameFileCacheEntry>
    );

    const result = await coordinator.analyze();

    expect(result.fileTree.children).toEqual([]);
  });
});
