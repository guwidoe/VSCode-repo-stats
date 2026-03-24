import { describe, expect, it } from 'vitest';
import type { ExtensionSettings } from './contracts';
import {
  applySettingsPatch,
  buildScopedSettingValueFromInspect,
  createCoreAnalysisSettingsSnapshot,
  createEvolutionAnalysisSettingsSnapshot,
  flattenSettingsUpdate,
  setScopedSettingValue,
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

describe('applySettingsPatch', () => {
  it('merges nested tooltip, treemap, and evolution settings without dropping existing values', () => {
    const current = createSettings();
    const patched = applySettingsPatch(current, {
      tooltipSettings: {
        ...current.tooltipSettings,
        showComplexity: true,
      },
      treemap: {
        ...current.treemap,
        ageColorRangeMode: 'custom',
        ageColorNewestDate: '2026-01-01',
        ageColorOldestDate: '2024-01-01',
      },
      evolution: {
        ...current.evolution,
        maxSnapshots: 40,
      },
    });

    expect(patched.tooltipSettings.showComplexity).toBe(true);
    expect(patched.tooltipSettings.showLinesOfCode).toBe(true);
    expect(patched.treemap.ageColorRangeMode).toBe('custom');
    expect(patched.treemap.ageColorNewestDate).toBe('2026-01-01');
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
  it('flattens nested treemap and evolution settings to VS Code config keys', () => {
    expect(
      flattenSettingsUpdate({
        overviewDisplayMode: 'count',
        treemap: {
          ageColorRangeMode: 'custom',
          ageColorNewestDate: '2026-01-01',
          ageColorOldestDate: '2024-01-01',
        },
        evolution: {
          autoRun: true,
          samplingMode: 'commit',
          snapshotIntervalDays: 14,
          snapshotIntervalCommits: 50,
          showInactivePeriods: true,
          maxSnapshots: 25,
          maxSeries: 15,
          cohortFormat: '%Y-%m',
        },
      })
    ).toEqual([
      { key: 'overviewDisplayMode', value: 'count' },
      { key: 'treemap.ageColorRangeMode', value: 'custom' },
      { key: 'treemap.ageColorNewestDate', value: '2026-01-01' },
      { key: 'treemap.ageColorOldestDate', value: '2024-01-01' },
      { key: 'evolution.autoRun', value: true },
      { key: 'evolution.samplingMode', value: 'commit' },
      { key: 'evolution.snapshotIntervalDays', value: 14 },
      { key: 'evolution.snapshotIntervalCommits', value: 50 },
      { key: 'evolution.showInactivePeriods', value: true },
      { key: 'evolution.maxSnapshots', value: 25 },
      { key: 'evolution.maxSeries', value: 15 },
      { key: 'evolution.cohortFormat', value: '%Y-%m' },
    ]);
  });
});

describe('scoped setting helpers', () => {
  it('maps workspaceFolder inspect values to repo scoped settings without casts', () => {
    expect(buildScopedSettingValueFromInspect({
      defaultValue: ['**/generated/**'],
      globalValue: ['vendor'],
      workspaceFolderValue: ['fixtures'],
    })).toEqual({
      defaultValue: ['**/generated/**'],
      globalValue: ['vendor'],
      repoValue: ['fixtures'],
      source: 'repo',
    });
  });

  it('updates evolution scoped settings through the typed applier map', () => {
    const current = createSettings();
    const next = setScopedSettingValue(current, 'evolution.samplingMode', 'commit');

    expect(next.evolution.samplingMode).toBe('commit');
    expect(next.excludePatterns).toEqual(current.excludePatterns);
  });
});
