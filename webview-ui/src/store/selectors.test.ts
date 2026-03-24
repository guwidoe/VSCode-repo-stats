import { describe, expect, it } from 'vitest';
import type { AnalysisResult } from '../types';
import { createInitialRepoStatsState, type RepoStatsState } from './types';
import { selectAllWeeks, selectWeeklyCommitTotals } from './index';

function createAnalysisResult(week: string, commits: number): AnalysisResult {
  return {
    target: {
      id: 'repo:/tmp/repo',
      kind: 'repository',
      label: 'repo',
      memberCount: 1,
    },
    repositories: [
      {
        id: '/tmp/repo',
        name: 'repo',
        path: '/tmp/repo',
        branch: 'main',
        commitCount: 1,
        headSha: 'abc123',
        role: 'primary',
        logicalRoot: 'repo',
        pathPrefix: '',
      },
    ],
    contributors: [
      {
        name: 'Test User',
        email: 'test@example.com',
        commits,
        linesAdded: commits * 10,
        linesDeleted: 0,
        firstCommit: '2024-01-01T00:00:00Z',
        lastCommit: '2024-01-02T00:00:00Z',
        weeklyActivity: [
          { week, commits, additions: commits * 10, deletions: 0 },
        ],
      },
    ],
    codeFrequency: [{ week, additions: commits * 10, deletions: 0, netChange: commits * 10 }],
    commitAnalytics: {
      authorDirectory: {
        idByEmail: { 'test@example.com': 0 },
        namesById: ['Test User'],
        emailsById: ['test@example.com'],
      },
      records: [],
      summary: {
        totalCommits: commits,
        totalAdditions: commits * 10,
        totalDeletions: 0,
        totalChangedLines: commits * 10,
        averageChangedLines: commits * 10,
        medianChangedLines: commits * 10,
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
      name: 'repo',
      path: '',
      type: 'directory',
      children: [],
    },
    analyzedAt: '2024-01-02T00:00:00Z',
    analyzedCommitCount: commits,
    maxCommitsLimit: 1000,
    limitReached: false,
    sccInfo: { version: '3.5.0', source: 'system' },
    blameMetrics: {
      analyzedAt: '2024-01-02T00:00:00Z',
      maxAgeDays: 30,
      ageByDay: [commits],
      ownershipByAuthor: [{ author: 'Test User', email: 'test@example.com', lines: commits }],
      totals: {
        totalBlamedLines: commits,
        filesAnalyzed: 1,
        filesSkipped: 0,
        cacheHits: 0,
      },
    },
  };
}

function createState(data: AnalysisResult): RepoStatsState {
  return {
    ...createInitialRepoStatsState(),
    data,
    reset: () => {},
    setData: () => {},
    mergeData: () => {},
    setError: () => {},
    setLoading: () => {},
    setStaleness: () => {},
    resetAnalysisState: () => {},
    setEvolutionData: () => {},
    setEvolutionError: () => {},
    setEvolutionLoading: () => {},
    setEvolutionStatus: () => {},
    setSettings: () => {},
    setScopedSettings: () => {},
    setRepoScopeAvailable: () => {},
    setRepositorySelection: () => {},
    setActiveView: () => {},
    setTimePeriod: () => {},
    setFrequencyGranularity: () => {},
    setContributorGranularity: () => {},
    setColorMode: () => {},
    setTimeRange: () => {},
    navigateToTreemapPath: () => {},
    setTreemapFilterPreset: () => {},
    toggleTreemapLanguage: () => {},
    setSizeDisplayMode: () => {},
    setMaxNestingDepth: () => {},
    setHoveredNode: () => {},
    setSelectedNode: () => {},
    clearSelection: () => {},
  };
}

describe('store selectors', () => {
  it('keeps weekly totals cache independent from all-weeks cache', () => {
    const firstState = createState(createAnalysisResult('2024-W01', 3));
    const secondState = createState(createAnalysisResult('2024-W02', 7));

    expect(selectWeeklyCommitTotals(firstState)).toEqual([{ week: '2024-W01', commits: 3 }]);
    expect(selectAllWeeks(secondState)).toEqual(['2024-W02']);
    expect(selectWeeklyCommitTotals(secondState)).toEqual([{ week: '2024-W02', commits: 7 }]);
  });
});
