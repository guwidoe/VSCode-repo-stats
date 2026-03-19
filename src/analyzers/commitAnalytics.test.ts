import { describe, expect, it } from 'vitest';
import {
  buildCodeFrequencyFromCommitAnalytics,
  buildCommitAnalytics,
  buildContributorStatsFromCommitAnalytics,
  parseCommitHistoryLog,
} from './commitAnalytics';
import { queryCommitAnalytics } from '../shared/commitAnalyticsQuery';

const RAW_LOG = [
  '__COMMIT__|aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa|Alice|alice@example.com|2024-01-01T12:00:00Z|add app',
  '1\t0\tsrc/app.ts',
  '__COMMIT__|bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb|Alice|alice@example.com|2024-01-08T12:00:00Z|add excluded fixture',
  '1\t0\tbackend/fixtures/seed.ts',
  '__COMMIT__|cccccccccccccccccccccccccccccccccccccccc|Bob|bob@example.com|2024-01-15T12:00:00Z|expand app',
  '2\t1\tsrc/app.ts',
  '1\t0\tsrc/util.ts',
  '__COMMIT__|dddddddddddddddddddddddddddddddddddddddd|Bob|bob@example.com|2024-01-22T12:00:00Z|merge branch',
].join('\n');

describe('commit analytics', () => {
  it('builds compact analytics from git history logs and respects excludes', () => {
    const parsed = parseCommitHistoryLog(RAW_LOG, ['**/backend/fixtures/**']);
    const analytics = buildCommitAnalytics(parsed);

    expect(analytics.authorDirectory.namesById).toEqual(['Alice', 'Bob']);
    expect(analytics.authorDirectory.idByEmail).toEqual({
      'alice@example.com': 0,
      'bob@example.com': 1,
    });

    expect(analytics.records).toEqual([
      {
        sha: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        repositoryId: 'default',
        authorId: 0,
        committedAt: '2024-01-01T12:00:00Z',
        timestamp: 1704110400,
        summary: 'add app',
        additions: 1,
        deletions: 0,
        changedLines: 1,
        filesChanged: 1,
      },
      {
        sha: 'cccccccccccccccccccccccccccccccccccccccc',
        repositoryId: 'default',
        authorId: 1,
        committedAt: '2024-01-15T12:00:00Z',
        timestamp: 1705320000,
        summary: 'expand app',
        additions: 3,
        deletions: 1,
        changedLines: 4,
        filesChanged: 2,
      },
      {
        sha: 'dddddddddddddddddddddddddddddddddddddddd',
        repositoryId: 'default',
        authorId: 1,
        committedAt: '2024-01-22T12:00:00Z',
        timestamp: 1705924800,
        summary: 'merge branch',
        additions: 0,
        deletions: 0,
        changedLines: 0,
        filesChanged: 0,
      },
    ]);

    expect(analytics.summary).toMatchObject({
      totalCommits: 3,
      totalAdditions: 4,
      totalDeletions: 1,
      totalChangedLines: 5,
      averageChangedLines: 5 / 3,
      medianChangedLines: 1,
      averageFilesChanged: 1,
    });

    expect(analytics.indexes.byTimestampAsc).toEqual([0, 1, 2]);
    expect(analytics.indexes.byAdditionsDesc).toEqual([1, 0, 2]);
    expect(analytics.indexes.byDeletionsDesc).toEqual([1, 2, 0]);
    expect(analytics.indexes.byChangedLinesDesc).toEqual([1, 0, 2]);
    expect(analytics.indexes.byFilesChangedDesc).toEqual([1, 0, 2]);
  });

  it('supports future commit explorer queries without reparsing history', () => {
    const analytics = buildCommitAnalytics(
      parseCommitHistoryLog(RAW_LOG, ['**/backend/fixtures/**'])
    );

    expect(
      queryCommitAnalytics(analytics, {
        minChangedLines: 2,
        sortBy: 'changedLines',
        sortDirection: 'desc',
      })
    ).toEqual([
      expect.objectContaining({
        sha: 'cccccccccccccccccccccccccccccccccccccccc',
        changedLines: 4,
      }),
    ]);

    expect(
      queryCommitAnalytics(analytics, {
        messageText: 'expand',
        committedAfter: '2024-01-10',
        sortBy: 'additions',
        sortDirection: 'desc',
      }).map((record) => record.sha)
    ).toEqual(['cccccccccccccccccccccccccccccccccccccccc']);

    expect(
      queryCommitAnalytics(analytics, {
        sortBy: 'timestamp',
        sortDirection: 'desc',
        limit: 2,
      }).map((record) => record.sha)
    ).toEqual([
      'dddddddddddddddddddddddddddddddddddddddd',
      'cccccccccccccccccccccccccccccccccccccccc',
    ]);
  });

  it('derives contributor and frequency views from the same analytics backbone', () => {
    const analytics = buildCommitAnalytics(
      parseCommitHistoryLog(RAW_LOG, ['**/backend/fixtures/**'])
    );

    expect(buildContributorStatsFromCommitAnalytics(analytics)).toEqual([
      {
        name: 'Bob',
        email: 'bob@example.com',
        commits: 2,
        linesAdded: 3,
        linesDeleted: 1,
        firstCommit: '2024-01-15T12:00:00Z',
        lastCommit: '2024-01-22T12:00:00Z',
        weeklyActivity: [
          {
            week: '2024-W03',
            commits: 1,
            additions: 3,
            deletions: 1,
          },
          {
            week: '2024-W04',
            commits: 1,
            additions: 0,
            deletions: 0,
          },
        ],
      },
      {
        name: 'Alice',
        email: 'alice@example.com',
        commits: 1,
        linesAdded: 1,
        linesDeleted: 0,
        firstCommit: '2024-01-01T12:00:00Z',
        lastCommit: '2024-01-01T12:00:00Z',
        weeklyActivity: [
          {
            week: '2024-W01',
            commits: 1,
            additions: 1,
            deletions: 0,
          },
        ],
      },
    ]);

    expect(buildCodeFrequencyFromCommitAnalytics(analytics)).toEqual([
      {
        week: '2024-W01',
        additions: 1,
        deletions: 0,
        netChange: 1,
      },
      {
        week: '2024-W03',
        additions: 3,
        deletions: 1,
        netChange: 2,
      },
      {
        week: '2024-W04',
        additions: 0,
        deletions: 0,
        netChange: 0,
      },
    ]);
  });
});
