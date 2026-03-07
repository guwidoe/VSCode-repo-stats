import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { AnalysisResult, ExtensionSettings, RepoScopedSettings } from '../../types';
import { GeneralSettings } from './GeneralSettings';

function createSettings(): ExtensionSettings {
  return {
    excludePatterns: ['fixtures'],
    maxCommitsToAnalyze: 1000,
    defaultColorMode: 'language',
    generatedPatterns: ['**/generated/**'],
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
    evolution: {
      autoRun: false,
      snapshotIntervalDays: 30,
      maxSnapshots: 80,
      maxSeries: 20,
      cohortFormat: '%Y',
    },
  };
}

function createScopedSettings(): RepoScopedSettings {
  return {
    excludePatterns: {
      defaultValue: [],
      globalValue: ['vendor'],
      repoValue: ['fixtures'],
      source: 'repo',
    },
    generatedPatterns: {
      defaultValue: ['**/generated/**'],
      source: 'default',
    },
    binaryExtensions: {
      defaultValue: ['.png'],
      source: 'default',
    },
    locExcludedExtensions: {
      defaultValue: [],
      source: 'default',
    },
    includeSubmodules: {
      defaultValue: false,
      source: 'default',
    },
  };
}

function createData(): AnalysisResult {
  return {
    repository: {
      name: 'repo',
      path: '/tmp/repo',
      branch: 'main',
      commitCount: 1,
      headSha: 'abc123',
    },
    contributors: [],
    codeFrequency: [],
    fileTree: { name: 'repo', path: '', type: 'directory', children: [] },
    analyzedAt: '2026-01-01T00:00:00Z',
    analyzedCommitCount: 1,
    maxCommitsLimit: 1000,
    limitReached: false,
    sccInfo: { version: 'test', source: 'system' },
    blameMetrics: {
      analyzedAt: '2026-01-01T00:00:00Z',
      maxAgeDays: 0,
      ageByDay: [],
      ownershipByAuthor: [],
      totals: { totalBlamedLines: 0, filesAnalyzed: 0, filesSkipped: 0, cacheHits: 0 },
    },
  };
}

describe('GeneralSettings', () => {
  it('shows repo-scoped value by default and can switch to global value', () => {
    render(
      <GeneralSettings
        settings={createSettings()}
        scopedSettings={createScopedSettings()}
        data={createData()}
        updateSettings={vi.fn()}
        updateScopedSetting={vi.fn()}
        resetScopedSetting={vi.fn()}
        requestRefresh={vi.fn()}
      />
    );

    expect(screen.getByText('fixtures')).toBeInTheDocument();
    expect(screen.queryByText('vendor')).not.toBeInTheDocument();

    fireEvent.click(screen.getAllByRole('button', { name: 'Global' })[0]);

    expect(screen.getByText('vendor')).toBeInTheDocument();
    expect(screen.queryByText('fixtures')).not.toBeInTheDocument();
  }, 10000);

  it('offers a reset action when a repo override exists', () => {
    const resetScopedSetting = vi.fn();

    render(
      <GeneralSettings
        settings={createSettings()}
        scopedSettings={createScopedSettings()}
        data={createData()}
        updateSettings={vi.fn()}
        updateScopedSetting={vi.fn()}
        resetScopedSetting={resetScopedSetting}
        requestRefresh={vi.fn()}
      />
    );

    fireEvent.click(screen.getAllByRole('button', { name: 'Use Global' })[0]);
    expect(resetScopedSetting).toHaveBeenCalledWith('excludePatterns');
  });
});
