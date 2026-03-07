import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { ExtensionSettings, RepoScopedSettings } from '../../types';
import { EvolutionSettings } from './EvolutionSettings';

function createSettings(snapshotIntervalDays = 30): ExtensionSettings {
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
      snapshotIntervalDays,
      maxSnapshots: 80,
      maxSeries: 20,
      cohortFormat: '%Y',
    },
  };
}

function createScopedSettings(snapshotIntervalDays = 30): RepoScopedSettings {
  return {
    excludePatterns: { defaultValue: [], source: 'default' },
    generatedPatterns: { defaultValue: [], source: 'default' },
    binaryExtensions: { defaultValue: ['.png'], source: 'default' },
    locExcludedExtensions: { defaultValue: [], source: 'default' },
    includeSubmodules: { defaultValue: false, source: 'default' },
    maxCommitsToAnalyze: { defaultValue: 10000, source: 'default' },
    'evolution.snapshotIntervalDays': {
      defaultValue: 30,
      globalValue: 14,
      repoValue: snapshotIntervalDays,
      source: 'repo',
    },
    'evolution.maxSnapshots': { defaultValue: 80, source: 'default' },
    'evolution.maxSeries': { defaultValue: 20, source: 'default' },
    'evolution.cohortFormat': { defaultValue: '%Y', source: 'default' },
  };
}

describe('EvolutionSettings', () => {
  it('applies snapshot granularity presets through scoped updates', () => {
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

  it('shows the custom interval input for non-preset values', () => {
    render(
      <EvolutionSettings
        settings={createSettings(45)}
        scopedSettings={createScopedSettings(45)}
        updateSettings={vi.fn()}
        updateScopedSetting={vi.fn()}
        resetScopedSetting={vi.fn()}
      />
    );

    expect(screen.getByText('Custom Snapshot Interval (Days)')).toBeInTheDocument();
  });

  it('lets users switch from a preset to a custom interval', () => {
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

    fireEvent.click(screen.getAllByRole('button', { name: 'Global' })[0]);
    fireEvent.click(screen.getByRole('button', { name: 'Weekly' }));

    expect(updateScopedSetting).toHaveBeenCalledWith(
      'evolution.snapshotIntervalDays',
      7,
      'global'
    );
  });
});
