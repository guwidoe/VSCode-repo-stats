import { beforeEach, describe, expect, it } from 'vitest';
import type { AnalysisResult, ExtensionMessage, ExtensionSettings } from '../types';
import { useStore } from '../store';
import { applyExtensionMessage } from './vscodeExtensionMessageHandler';
import { applyOptimisticSettingsUpdate } from './vscodeOptimisticSettings';

function createSettings(): ExtensionSettings {
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
      samplingMode: 'time',
      snapshotIntervalDays: 7,
      snapshotIntervalCommits: 10,
      showInactivePeriods: false,
      maxSnapshots: 20,
      maxSeries: 20,
      cohortFormat: '%Y',
    },
  };
}

function createAnalysisResult(): AnalysisResult {
  return {
    target: {
      id: 'repo:one',
      kind: 'repository',
      label: 'Repo One',
      memberCount: 1,
    },
    repositories: [
      {
        id: 'repo-1',
        role: 'primary',
        logicalRoot: 'repo-1',
        pathPrefix: '',
        name: 'Repo One',
        path: '/tmp/repo-1',
        branch: 'main',
        commitCount: 1,
        headSha: 'abc123',
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
    fileTree: { name: 'root', path: '', type: 'directory', children: [] },
    analyzedAt: new Date('2026-03-24T00:00:00Z').toISOString(),
    analyzedCommitCount: 1,
    maxCommitsLimit: 1000,
    limitReached: false,
    sccInfo: { version: '1.0.0', source: 'system' },
    blameMetrics: {
      analyzedAt: new Date('2026-03-24T00:00:00Z').toISOString(),
      maxAgeDays: 0,
      ageByDay: [],
      ownershipByAuthor: [],
      totals: {
        totalBlamedLines: 0,
        filesAnalyzed: 0,
        filesSkipped: 0,
        cacheHits: 0,
      },
    },
  };
}

beforeEach(() => {
  useStore.getState().reset();
});

describe('applyExtensionMessage', () => {
  it('normalizes evolution payloads before storing them', () => {
    const message = {
      type: 'evolutionComplete',
      data: {
        generatedAt: new Date('2026-03-24T00:00:00Z').toISOString(),
        targetId: 'repo:one',
        historyMode: 'singleBranch',
        revisionHash: 'rev-1',
        settingsHash: 'settings-1',
        memberHeads: [],
        cohorts: { labels: ['2026'], ts: ['2026-03-24T00:00:00Z'], y: [[1]] },
        authors: { labels: ['Alice'], ts: ['2026-03-24T00:00:00Z'], y: [[1]] },
        exts: { labels: ['.ts'], ts: ['2026-03-24T00:00:00Z'], y: [[1]] },
        dirs: { labels: ['src/'], ts: ['2026-03-24T00:00:00Z'], y: [[1]] },
        domains: { labels: ['example.com'], ts: ['2026-03-24T00:00:00Z'], y: [[1]] },
      },
    } satisfies ExtensionMessage as ExtensionMessage;

    applyExtensionMessage(message);

    expect(useStore.getState().evolutionData?.extensions.labels).toEqual(['.ts']);
    expect(useStore.getState().evolutionData?.directories.labels).toEqual(['src/']);
  });

  it('resets analysis state when the repository selection changes', () => {
    useStore.getState().setData(createAnalysisResult());

    applyExtensionMessage({
      type: 'repositorySelectionLoaded',
      repositories: [{ path: '/tmp/repo-2', name: 'Repo Two', source: 'workspace' }],
      selectedRepositoryIds: ['repo-2'],
      selectedTarget: {
        id: 'repo:two',
        kind: 'repository',
        label: 'Repo Two',
        memberCount: 1,
        settingsScope: 'repo',
      },
    });

    expect(useStore.getState().data).toBeNull();
    expect(useStore.getState().selectedRepositoryIds).toEqual(['repo-2']);
  });
});

describe('applyOptimisticSettingsUpdate', () => {
  it('updates settings and marks evolution stale optimistically', () => {
    const settings = createSettings();
    useStore.getState().setSettings(settings);
    useStore.getState().setEvolutionData({
      generatedAt: new Date('2026-03-24T00:00:00Z').toISOString(),
      targetId: 'repo:one',
      historyMode: 'singleBranch',
      revisionHash: 'rev-1',
      settingsHash: 'settings-1',
      memberHeads: [],
      cohorts: { labels: [], snapshots: [], timestamps: [], seriesValues: [], ts: [], y: [] },
      authors: { labels: [], snapshots: [], timestamps: [], seriesValues: [], ts: [], y: [] },
      extensions: { labels: [], snapshots: [], timestamps: [], seriesValues: [], ts: [], y: [] },
      directories: { labels: [], snapshots: [], timestamps: [], seriesValues: [], ts: [], y: [] },
      exts: { labels: [], snapshots: [], timestamps: [], seriesValues: [], ts: [], y: [] },
      dirs: { labels: [], snapshots: [], timestamps: [], seriesValues: [], ts: [], y: [] },
      domains: { labels: [], snapshots: [], timestamps: [], seriesValues: [], ts: [], y: [] },
    });

    applyOptimisticSettingsUpdate({
      evolution: {
        ...settings.evolution,
        maxSnapshots: 25,
      },
    });

    expect(useStore.getState().settings?.evolution.maxSnapshots).toBe(25);
    expect(useStore.getState().evolutionStale).toBe(true);
  });
});
