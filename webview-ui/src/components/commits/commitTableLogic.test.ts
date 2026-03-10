import { describe, expect, it } from 'vitest';
import type { CommitAnalytics } from '../../types';
import {
  buildCommitTableRows,
  filterCommits,
  sortCommits,
  toggleCommitSort,
  DEFAULT_COMMIT_SORT,
} from './commitTableLogic';

function createAnalytics(): CommitAnalytics {
  return {
    authorDirectory: {
      idByEmail: {
        'alice@example.com': 0,
        'bob@example.com': 1,
      },
      namesById: ['Alice', 'Bob'],
      emailsById: ['alice@example.com', 'bob@example.com'],
    },
    records: [
      {
        sha: 'aaaaaaaa11111111',
        authorId: 0,
        committedAt: '2026-01-02T00:00:00.000Z',
        timestamp: Date.parse('2026-01-02T00:00:00.000Z') / 1000,
        summary: 'Refine chart axes',
        additions: 40,
        deletions: 10,
        changedLines: 50,
        filesChanged: 3,
      },
      {
        sha: 'bbbbbbbb22222222',
        authorId: 1,
        committedAt: '2026-01-10T00:00:00.000Z',
        timestamp: Date.parse('2026-01-10T00:00:00.000Z') / 1000,
        summary: 'Fix tooltip overflow',
        additions: 12,
        deletions: 4,
        changedLines: 16,
        filesChanged: 1,
      },
      {
        sha: 'cccccccc33333333',
        authorId: 0,
        committedAt: '2026-02-01T00:00:00.000Z',
        timestamp: Date.parse('2026-02-01T00:00:00.000Z') / 1000,
        summary: 'Redesign commit explorer',
        additions: 120,
        deletions: 45,
        changedLines: 165,
        filesChanged: 8,
      },
    ],
    summary: {
      totalCommits: 3,
      totalAdditions: 172,
      totalDeletions: 59,
      totalChangedLines: 231,
      averageChangedLines: 77,
      medianChangedLines: 50,
      averageFilesChanged: 4,
    },
    contributorSummaries: [],
    changedLineBuckets: [],
    fileChangeBuckets: [],
    indexes: {
      byTimestampAsc: [0, 1, 2],
      byAdditionsDesc: [2, 0, 1],
      byDeletionsDesc: [2, 0, 1],
      byChangedLinesDesc: [2, 0, 1],
      byFilesChangedDesc: [2, 0, 1],
    },
  };
}

describe('commitTableLogic', () => {
  it('builds denormalized commit rows with author names for the grid', () => {
    const rows = buildCommitTableRows(createAnalytics());

    expect(rows[0]?.authorName).toBe('Alice');
    expect(rows[1]?.authorNameLower).toBe('bob');
    expect(rows[2]?.summaryLower).toContain('commit explorer');
  });

  it('filters commits by text, date, and numeric column filters', () => {
    const rows = buildCommitTableRows(createAnalytics());

    const filtered = filterCommits(rows, {
      authorName: { kind: 'text', value: 'alice' },
      committedAt: { kind: 'date', from: '2026-01-01', to: '2026-01-31' },
      changedLines: { kind: 'number', min: '40', max: '60' },
    });

    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.summary).toBe('Refine chart axes');
  });

  it('sorts commits by arbitrary visible table columns', () => {
    const rows = buildCommitTableRows(createAnalytics());

    const sortedByAuthor = sortCommits(rows, { key: 'authorName', direction: 'asc' });
    const sortedByFiles = sortCommits(rows, { key: 'filesChanged', direction: 'desc' });

    expect(sortedByAuthor.map((row) => row.authorName)).toEqual(['Alice', 'Alice', 'Bob']);
    expect(sortedByFiles.map((row) => row.filesChanged)).toEqual([8, 3, 1]);
  });

  it('toggles sort direction and restores default direction when switching columns', () => {
    const toggledOnce = toggleCommitSort(DEFAULT_COMMIT_SORT, 'committedAt');
    const toggledColumn = toggleCommitSort(DEFAULT_COMMIT_SORT, 'authorName');

    expect(toggledOnce).toEqual({ key: 'committedAt', direction: 'asc' });
    expect(toggledColumn).toEqual({ key: 'authorName', direction: 'asc' });
  });
});
