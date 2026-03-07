import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { ExtensionSettings } from '../../types';
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

describe('EvolutionSettings', () => {
  it('applies snapshot granularity presets', () => {
    const updateSettings = vi.fn();

    render(<EvolutionSettings settings={createSettings()} updateSettings={updateSettings} />);

    fireEvent.click(screen.getByRole('button', { name: 'Daily' }));

    expect(updateSettings).toHaveBeenCalledWith({
      evolution: {
        ...createSettings().evolution,
        snapshotIntervalDays: 1,
      },
    });
  }, 10000);

  it('shows the custom interval input for non-preset values', () => {
    render(<EvolutionSettings settings={createSettings(45)} updateSettings={vi.fn()} />);

    expect(screen.getByText('Custom Snapshot Interval (Days)')).toBeInTheDocument();
  });

  it('lets users switch from a preset to a custom interval', () => {
    render(<EvolutionSettings settings={createSettings()} updateSettings={vi.fn()} />);

    expect(screen.queryByText('Custom Snapshot Interval (Days)')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Custom' }));

    expect(screen.getByText('Custom Snapshot Interval (Days)')).toBeInTheDocument();
  });
});
