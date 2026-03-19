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

class FakeGitClient implements GitClient {
  async isRepo(): Promise<boolean> {
    return true;
  }

  async getRepoInfo(): Promise<RepositoryInfo> {
    return {
      name: 'repo',
      path: '/tmp/repo',
      branch: 'main',
      commitCount: 1,
      headSha: 'abc123',
    };
  }

  async getCommitAnalytics(): Promise<CommitAnalytics> {
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

  async getContributorStats(): Promise<ContributorStats[]> {
    return [];
  }

  async getCodeFrequency(): Promise<CodeFrequency[]> {
    return [];
  }

  async getFileModificationDates(): Promise<Map<string, string>> {
    return new Map();
  }

  async getTrackedFiles(): Promise<string[]> {
    return ['backend/fixtures/seed.png'];
  }

  async getSubmodulePaths(): Promise<string[]> {
    return [];
  }

  async getHeadBlobShas(): Promise<Map<string, string>> {
    return new Map();
  }

  async raw(): Promise<string> {
    return '';
  }
}

class FakeLocClient implements LOCClient {
  async countLines(): Promise<TreemapNode> {
    return {
      name: 'repo',
      path: '',
      type: 'directory',
      lines: 0,
      children: [],
    };
  }

  async ensureSccAvailable(): Promise<void> {
    return;
  }

  async getSccInfo(): Promise<SccInfo> {
    return {
      version: 'test',
      source: 'system',
    };
  }
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
      new FakeGitClient(),
      new FakeLocClient(),
      {} as Record<string, BlameFileCacheEntry>
    );

    const result = await coordinator.analyze();

    expect(result.fileTree.children).toEqual([]);
  });
});
