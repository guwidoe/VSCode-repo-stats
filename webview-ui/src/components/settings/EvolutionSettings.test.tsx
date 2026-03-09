import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { ExtensionSettings, RepoScopedSettings } from '../../types';
import { EvolutionSettings } from './EvolutionSettings';

function createSettings(overrides?: Partial<ExtensionSettings['evolution']>): ExtensionSettings {
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
    evolution: {
      autoRun: false,
      samplingMode: 'time',
      snapshotIntervalDays: 30,
      snapshotIntervalCommits: 100,
      showInactivePeriods: false,
      maxSnapshots: 80,
      maxSeries: 20,
      cohortFormat: '%Y',
      ...overrides,
    },
  };
}

function createScopedSettings(overrides?: Partial<RepoScopedSettings>): RepoScopedSettings {
  return {
    excludePatterns: { defaultValue: [], source: 'default' },
    generatedPatterns: { defaultValue: [], source: 'default' },
    binaryExtensions: { defaultValue: ['.png'], source: 'default' },
    locExcludedExtensions: { defaultValue: [], source: 'default' },
    includeSubmodules: { defaultValue: false, source: 'default' },
    maxCommitsToAnalyze: { defaultValue: 10000, source: 'default' },
    'evolution.samplingMode': {
      defaultValue: 'time',
      repoValue: 'time',
      source: 'repo',
    },
    'evolution.snapshotIntervalDays': {
      defaultValue: 30,
      globalValue: 14,
      repoValue: 30,
      source: 'repo',
    },
    'evolution.snapshotIntervalCommits': {
      defaultValue: 100,
      repoValue: 100,
      source: 'repo',
    },
    'evolution.showInactivePeriods': {
      defaultValue: false,
      repoValue: false,
      source: 'repo',
    },
    'evolution.maxSnapshots': { defaultValue: 80, source: 'default' },
    'evolution.maxSeries': { defaultValue: 20, source: 'default' },
    'evolution.cohortFormat': { defaultValue: '%Y', source: 'default' },
    ...overrides,
  };
}

describe('EvolutionSettings', () => {
  it('applies time-based snapshot granularity presets through scoped updates', () => {
    const updateScopedSetting = vi.fn();

    render(
      <EvolutionSettings
        settings={createSettings()}
        scopedSettings={createScopedSettings()}
        updateSettings={vi.fn()}
        updateScopedSetting={updateScopedSetting}
        resetScopedSetting={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Daily' }));

    expect(updateScopedSetting).toHaveBeenCalledWith(
      'evolution.snapshotIntervalDays',
      1,
      'repo'
    );
  }, 10000);

  it('shows the custom time interval input for non-preset values', () => {
    render(
      <EvolutionSettings
        settings={createSettings({ snapshotIntervalDays: 45 })}
        scopedSettings={createScopedSettings({
          'evolution.snapshotIntervalDays': {
            defaultValue: 30,
            repoValue: 45,
            source: 'repo',
          },
        })}
        updateSettings={vi.fn()}
        updateScopedSetting={vi.fn()}
        resetScopedSetting={vi.fn()}
      />
    );

    expect(screen.getByText('Custom Snapshot Interval (Days)')).toBeInTheDocument();
  });

  it('lets users switch from a preset to a custom time interval', () => {
    render(
      <EvolutionSettings
        settings={createSettings()}
        scopedSettings={createScopedSettings()}
        updateSettings={vi.fn()}
        updateScopedSetting={vi.fn()}
        resetScopedSetting={vi.fn()}
      />
    );

    expect(screen.queryByText('Custom Snapshot Interval (Days)')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Custom' }));

    expect(screen.getByText('Custom Snapshot Interval (Days)')).toBeInTheDocument();
  });

  it('switches to commit mode and updates commit interval in scoped settings', () => {
    const updateScopedSetting = vi.fn();

    render(
      <EvolutionSettings
        settings={createSettings({ samplingMode: 'commit' })}
        scopedSettings={createScopedSettings({
          'evolution.samplingMode': {
            defaultValue: 'time',
            repoValue: 'commit',
            source: 'repo',
          },
        })}
        updateSettings={vi.fn()}
        updateScopedSetting={updateScopedSetting}
        resetScopedSetting={vi.fn()}
      />
    );

    expect(screen.getByText('Commit Snapshot Interval')).toBeInTheDocument();
  });

  it('can switch evolution sampling controls to global scope', () => {
    const updateScopedSetting = vi.fn();

    render(
      <EvolutionSettings
        settings={createSettings()}
        scopedSettings={createScopedSettings()}
        updateSettings={vi.fn()}
        updateScopedSetting={updateScopedSetting}
        resetScopedSetting={vi.fn()}
      />
    );

    fireEvent.click(screen.getAllByRole('button', { name: 'Global' })[1]);
    fireEvent.click(screen.getByRole('button', { name: 'Weekly' }));

    expect(updateScopedSetting).toHaveBeenCalledWith(
      'evolution.snapshotIntervalDays',
      7,
      'global'
    );
  });
});
