import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { CommitMetadataSettings as CommitMetadataSettingsValue, RepoScopedSettings } from '../../types';
import { CommitMetadataSettings } from './CommitMetadataSettings';

function createMetadataSettings(overrides: Partial<CommitMetadataSettingsValue> = {}): CommitMetadataSettingsValue {
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
        id: 'custom-tags',
        name: 'Custom Tags',
        enabled: true,
        dimension: 'tag',
        includeUnmatched: false,
        unmatchedValue: 'Untagged',
        aliases: {},
        kind: 'regex',
        regex: '[',
        flags: 'g',
        captureGroup: 'tag',
        normalization: 'lowercase',
      },
    ],
    defaultExtractorId: 'conventionalType',
    defaultBucketMode: 'calendar',
    defaultCalendarGranularity: 'month',
    defaultCommitBucketStrategy: 'fixedSize',
    defaultCommitBucketSize: 100,
    defaultCommitBucketCount: 12,
    defaultMetric: 'commits',
    defaultChartType: 'stackedBar',
    multiValueMode: 'countEach',
    includeUncategorized: true,
    maxSeries: 12,
    includeOtherSeries: true,
    ...overrides,
  };
}

function createScopedSettings(metadata = createMetadataSettings()): RepoScopedSettings {
  return {
    excludePatterns: { defaultValue: [], source: 'default' },
    generatedPatterns: { defaultValue: [], source: 'default' },
    binaryExtensions: { defaultValue: [], source: 'default' },
    locExcludedExtensions: { defaultValue: [], source: 'default' },
    maxCommitsToAnalyze: { defaultValue: 1000, source: 'default' },
    'evolution.historyTraversalMode': { defaultValue: 'firstParent', source: 'default' },
    'evolution.samplingMode': { defaultValue: 'auto', source: 'default' },
    'evolution.snapshotIntervalDays': { defaultValue: 30, source: 'default' },
    'evolution.showInactivePeriods': { defaultValue: false, source: 'default' },
    'evolution.maxSnapshots': { defaultValue: 20, source: 'default' },
    'evolution.maxSeries': { defaultValue: 20, source: 'default' },
    'evolution.cohortFormat': { defaultValue: '%Y', source: 'default' },
    commitMetadata: { defaultValue: metadata, source: 'default' },
  };
}

describe('CommitMetadataSettings', () => {
  it('shows regex validation errors and persists extractor edits', () => {
    const updateScopedSetting = vi.fn();

    render(
      <CommitMetadataSettings
        scopedSettings={createScopedSettings()}
        repoScopeAvailable
        updateScopedSetting={updateScopedSetting}
        resetScopedSetting={vi.fn()}
      />
    );

    expect(screen.getByText(/Invalid regular expression/)).toBeInTheDocument();

    const regexInput = screen.getByDisplayValue('[');
    fireEvent.change(regexInput, { target: { value: '\\[(?<tag>[^\\]]+)\\]' } });

    expect(updateScopedSetting).toHaveBeenCalledWith(
      'commitMetadata',
      expect.objectContaining({
        extractors: expect.arrayContaining([
          expect.objectContaining({ id: 'custom-tags', regex: '\\[(?<tag>[^\\]]+)\\]' }),
        ]),
      }),
      'global'
    );
  });

  it('adds custom extractors and updates default chart settings', () => {
    const updateScopedSetting = vi.fn();

    render(
      <CommitMetadataSettings
        scopedSettings={createScopedSettings(createMetadataSettings({ extractors: [] }))}
        repoScopeAvailable={false}
        updateScopedSetting={updateScopedSetting}
        resetScopedSetting={vi.fn()}
      />
    );

    fireEvent.click(screen.getByText('Add custom extractor'));
    expect(updateScopedSetting).toHaveBeenCalledWith(
      'commitMetadata',
      expect.objectContaining({ extractors: expect.arrayContaining([expect.objectContaining({ kind: 'regex' })]) }),
      'global'
    );

    fireEvent.click(screen.getByText('Heatmap'));
    expect(updateScopedSetting).toHaveBeenCalledWith(
      'commitMetadata',
      expect.objectContaining({ defaultChartType: 'heatmap' }),
      'global'
    );
  });
});
