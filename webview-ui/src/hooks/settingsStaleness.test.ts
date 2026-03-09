import { describe, expect, it } from 'vitest';
import type { ExtensionSettings } from '../types';
import { getOptimisticStalenessForSettingsChange } from './settingsStaleness';

function createSettings(): ExtensionSettings {
  return {
    excludePatterns: [],
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

describe('getOptimisticStalenessForSettingsChange', () => {
  it('marks both caches stale for exclude pattern changes', () => {
    expect(
      getOptimisticStalenessForSettingsChange({
        currentSettings: createSettings(),
        nextSettings: { excludePatterns: ['vendor'] },
        hasCoreData: true,
        hasEvolutionData: true,
        currentStaleness: { coreStale: false, evolutionStale: false },
      })
    ).toEqual({ coreStale: true, evolutionStale: true });
  });

  it('does not mark analysis stale for generated pattern changes', () => {
    expect(
      getOptimisticStalenessForSettingsChange({
        currentSettings: createSettings(),
        nextSettings: { generatedPatterns: ['**/dist/**'] },
        hasCoreData: true,
        hasEvolutionData: true,
        currentStaleness: { coreStale: false, evolutionStale: false },
      })
    ).toEqual({ coreStale: false, evolutionStale: false });
  });

  it('marks only evolution stale for evolution-only settings changes', () => {
    expect(
      getOptimisticStalenessForSettingsChange({
        currentSettings: createSettings(),
        nextSettings: {
          evolution: {
            ...createSettings().evolution,
            maxSnapshots: 40,
          },
        },
        hasCoreData: true,
        hasEvolutionData: true,
        currentStaleness: { coreStale: false, evolutionStale: false },
      })
    ).toEqual({ coreStale: false, evolutionStale: true });
  });
});
