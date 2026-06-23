import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { CommitAnalytics, CommitMetadataSettings, CommitRecord } from '../../types';
import type { CommitTableRow } from './types';
import { CommitMetadataTrends } from './CommitMetadataTrends';

function createRecord(overrides: Partial<CommitRecord>): CommitRecord {
  return {
    sha: overrides.sha ?? 'sha',
    repositoryId: overrides.repositoryId ?? 'repo',
    authorId: overrides.authorId ?? 0,
    committedAt: overrides.committedAt ?? '2026-01-01T00:00:00.000Z',
    timestamp: overrides.timestamp ?? Date.parse(overrides.committedAt ?? '2026-01-01T00:00:00.000Z'),
    summary: overrides.summary ?? 'feat: add chart',
    additions: overrides.additions ?? 1,
    deletions: overrides.deletions ?? 0,
    changedLines: overrides.changedLines ?? 1,
    filesChanged: overrides.filesChanged ?? 1,
    changedFiles: overrides.changedFiles,
  };
}

function createAnalytics(records: CommitRecord[]): CommitAnalytics {
  return {
    authorDirectory: {
      idByEmail: { 'ada@example.com': 0 },
      namesById: ['Ada'],
      emailsById: ['ada@example.com'],
    },
    records,
    summary: {
      totalCommits: records.length,
      totalAdditions: records.reduce((sum, record) => sum + record.additions, 0),
      totalDeletions: records.reduce((sum, record) => sum + record.deletions, 0),
      totalChangedLines: records.reduce((sum, record) => sum + record.changedLines, 0),
      averageChangedLines: 0,
      medianChangedLines: 0,
      averageFilesChanged: 0,
    },
    contributorSummaries: [],
    changedLineBuckets: [],
    fileChangeBuckets: [],
    indexes: {
      byTimestampAsc: records.map((_, index) => index),
      byAdditionsDesc: [],
      byDeletionsDesc: [],
      byChangedLinesDesc: [],
      byFilesChangedDesc: [],
    },
  };
}

function createSettings(overrides: Partial<CommitMetadataSettings> = {}): CommitMetadataSettings {
  return {
    extractors: [
      {
        id: 'conventionalType',
        name: 'Conventional Type',
        enabled: true,
        dimension: 'type',
        includeUnmatched: false,
        unmatchedValue: 'Uncategorized',
        aliases: {},
        kind: 'builtIn',
        builtInId: 'conventionalType',
      },
      {
        id: 'bracketTag',
        name: 'Bracket Tags',
        enabled: true,
        dimension: 'tag',
        includeUnmatched: false,
        unmatchedValue: 'Untagged',
        aliases: {},
        kind: 'builtIn',
        builtInId: 'bracketTag',
      },
    ],
    defaultExtractorId: 'conventionalType',
    defaultBucketMode: 'calendar',
    defaultCalendarGranularity: 'month',
    defaultCommitBucketStrategy: 'fixedSize',
    defaultCommitBucketSize: 2,
    defaultCommitBucketCount: 2,
    defaultMetric: 'commits',
    defaultChartType: 'stackedBar',
    multiValueMode: 'countEach',
    includeUncategorized: false,
    maxSeries: 12,
    includeOtherSeries: true,
    ...overrides,
  };
}

function createRows(records: CommitRecord[]): CommitTableRow[] {
  return records.map((record) => ({
    ...record,
    authorName: 'Ada',
    authorEmail: 'ada@example.com',
    authorNameLower: 'ada',
    summaryLower: record.summary.toLowerCase(),
    shaLower: record.sha.toLowerCase(),
  }));
}

describe('CommitMetadataTrends', () => {
  it('renders controls, switches bucket mode, and drills into chart segments', () => {
    const records = [
      createRecord({ sha: 'aaaaaaaa', summary: 'feat: add chart', committedAt: '2026-01-01T00:00:00.000Z' }),
      createRecord({ sha: 'bbbbbbbb', summary: 'fix: repair chart', committedAt: '2026-01-02T00:00:00.000Z' }),
    ];

    render(
      <CommitMetadataTrends
        analytics={createAnalytics(records)}
        settings={createSettings()}
        rows={createRows(records)}
      />
    );

    expect(screen.getByRole('heading', { name: 'Metadata Trends' })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Bucket by'), { target: { value: 'commitCount' } });
    expect(screen.getByLabelText('Bucket size')).toBeInTheDocument();

    fireEvent.click(screen.getByTitle('feat: 1'));
    expect(screen.getByText('feat in Commits 1–2')).toBeInTheDocument();
    expect(screen.getByText('feat: add chart')).toBeInTheDocument();
  });

  it('shows no-match and settings call to action for unmatched extractors', () => {
    const onOpenSettings = vi.fn();
    const records = [createRecord({ sha: 'aaaaaaaa', summary: 'plain commit' })];

    render(
      <CommitMetadataTrends
        analytics={createAnalytics(records)}
        settings={createSettings({ defaultExtractorId: 'bracketTag' })}
        rows={createRows(records)}
        onOpenSettings={onOpenSettings}
      />
    );

    expect(screen.getByRole('heading', { name: 'No matching metadata' })).toBeInTheDocument();
    fireEvent.click(screen.getByText('Configure extractors'));
    expect(onOpenSettings).toHaveBeenCalledTimes(1);
  });
});
