import { describe, expect, it } from 'vitest';
import type { ExtensionSettings } from './contracts';
import {
  applySettingsPatch,
  createCoreAnalysisSettingsSnapshot,
  createEvolutionAnalysisSettingsSnapshot,
  flattenSettingsUpdate,
  settingsAffectCoreAnalysis,
  settingsAffectEvolutionAnalysis,
} from './settings';

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
      snapshotIntervalDays: 30,
      maxSnapshots: 80,
      maxSeries: 20,
      cohortFormat: '%Y',
    },
  };
}

describe('applySettingsPatch', () => {
  it('merges nested tooltip and evolution settings without dropping existing values', () => {
    const current = createSettings();
    const patched = applySettingsPatch(current, {
      tooltipSettings: {
        ...current.tooltipSettings,
        showComplexity: true,
      },
      evolution: {
        ...current.evolution,
        maxSnapshots: 40,
      },
    });

    expect(patched.tooltipSettings.showComplexity).toBe(true);
    expect(patched.tooltipSettings.showLinesOfCode).toBe(true);
    expect(patched.evolution.maxSnapshots).toBe(40);
    expect(patched.evolution.snapshotIntervalDays).toBe(30);
  });
});

describe('analysis settings snapshots', () => {
  it('normalizes order-sensitive array settings for core analysis', () => {
    const base = createSettings();
    const reordered = {
      ...base,
      excludePatterns: ['b', 'a'],
      binaryExtensions: ['.svg', '.png'],
    };
    const sorted = {
      ...base,
      excludePatterns: ['a', 'b'],
      binaryExtensions: ['.png', '.svg'],
    };

    expect(createCoreAnalysisSettingsSnapshot(reordered)).toEqual(
      createCoreAnalysisSettingsSnapshot(sorted)
    );
  });

  it('tracks evolution-only settings separately from core analysis', () => {
    const current = createSettings();
    const next = applySettingsPatch(current, {
      evolution: {
        ...current.evolution,
        maxSnapshots: 10,
      },
    });

    expect(settingsAffectCoreAnalysis(current, next)).toBe(false);
    expect(settingsAffectEvolutionAnalysis(current, next)).toBe(true);
    expect(createEvolutionAnalysisSettingsSnapshot(current)).not.toEqual(
      createEvolutionAnalysisSettingsSnapshot(next)
    );
  });
});

describe('flattenSettingsUpdate', () => {
  it('flattens nested evolution settings to VS Code config keys', () => {
    expect(
      flattenSettingsUpdate({
        overviewDisplayMode: 'count',
        evolution: {
          autoRun: true,
          snapshotIntervalDays: 14,
          maxSnapshots: 25,
          maxSeries: 15,
          cohortFormat: '%Y-%m',
        },
      })
    ).toEqual([
      { key: 'overviewDisplayMode', value: 'count' },
      { key: 'evolution.autoRun', value: true },
      { key: 'evolution.snapshotIntervalDays', value: 14 },
      { key: 'evolution.maxSnapshots', value: 25 },
      { key: 'evolution.maxSeries', value: 15 },
      { key: 'evolution.cohortFormat', value: '%Y-%m' },
    ]);
  });
});
