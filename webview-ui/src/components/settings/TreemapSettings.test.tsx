import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { AnalysisResult, ExtensionSettings } from '../../types';
import { TreemapSettings } from './TreemapSettings';

function createSettings(): ExtensionSettings {
  return {
    excludePatterns: [],
    maxCommitsToAnalyze: 1000,
    defaultColorMode: 'language',
    generatedPatterns: [],
    binaryExtensions: ['.png'],
    locExcludedExtensions: [],
    includeSubmodules: false,
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

function createData(): AnalysisResult {
  return {
    repository: {
      name: 'repo',
      path: '/tmp/repo',
      branch: 'main',
      commitCount: 10,
      headSha: 'abc123',
    },
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
      indexes: { byTimestampAsc: [], byAdditionsDesc: [], byDeletionsDesc: [], byChangedLinesDesc: [], byFilesChangedDesc: [] },
    },
    fileTree: {
      name: 'repo',
      path: '',
      type: 'directory',
      children: [
        {
          name: 'old.ts',
          path: 'old.ts',
          type: 'file',
          lastModified: '2024-01-01T00:00:00.000Z',
        },
        {
          name: 'new.ts',
          path: 'new.ts',
          type: 'file',
          lastModified: '2026-01-01T00:00:00.000Z',
        },
        {
          name: 'epoch.ts',
          path: 'epoch.ts',
          type: 'file',
          lastModified: '1970-01-01T00:00:00.000Z',
        },
      ],
    },
    analyzedAt: '2026-03-05T00:00:00.000Z',
    analyzedCommitCount: 10,
    maxCommitsLimit: 1000,
    limitReached: false,
    sccInfo: { version: '1.0.0', source: 'system' },
    blameMetrics: {
      analyzedAt: '2026-03-05T00:00:00.000Z',
      maxAgeDays: 10,
      ageByDay: [],
      ownershipByAuthor: [],
      totals: { totalBlamedLines: 0, filesAnalyzed: 0, filesSkipped: 0, cacheHits: 0 },
    },
  };
}

describe('TreemapSettings', () => {
  it('seeds custom age range dates from valid treemap file timestamps', () => {
    const updateSettings = vi.fn();

    render(
      <TreemapSettings
        settings={createSettings()}
        data={createData()}
        updateSettings={updateSettings}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Custom' }));

    expect(updateSettings).toHaveBeenCalledWith({
      treemap: {
        ageColorRangeMode: 'custom',
        ageColorNewestDate: '2026-01-01',
        ageColorOldestDate: '2024-01-01',
      },
    });
  });
});
