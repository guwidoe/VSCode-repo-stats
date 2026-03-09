import { describe, expect, it } from 'vitest';
import type { ExtensionSettings, RepoScopedSettings } from '../types';
import {
  applyScopedSettingUpdate,
  getScopedSettingDisplayValue,
  getScopedSettingSourceLabel,
  resetRepoScopedSettingOverride,
} from './scopedSettings';

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
      globalValue: true,
      source: 'global',
    },
    maxCommitsToAnalyze: {
      defaultValue: 10000,
      globalValue: 2000,
      source: 'global',
    },
    'evolution.samplingMode': {
      defaultValue: 'time',
      source: 'default',
    },
    'evolution.snapshotIntervalDays': {
      defaultValue: 30,
      globalValue: 14,
      source: 'global',
    },
    'evolution.snapshotIntervalCommits': {
      defaultValue: 100,
      source: 'default',
    },
    'evolution.showInactivePeriods': {
      defaultValue: false,
      source: 'default',
    },
    'evolution.maxSnapshots': {
      defaultValue: 80,
      repoValue: 40,
      source: 'repo',
    },
    'evolution.maxSeries': {
      defaultValue: 20,
      source: 'default',
    },
    'evolution.cohortFormat': {
      defaultValue: '%Y',
      source: 'default',
    },
  };
}

describe('scopedSettings', () => {
  it('shows global editor value without leaking repo override', () => {
    expect(getScopedSettingDisplayValue(createScopedSettings(), 'excludePatterns', 'global')).toEqual([
      'vendor',
    ]);
  });

  it('updates global scope without changing effective repo override', () => {
    const result = applyScopedSettingUpdate(
      createSettings(),
      createScopedSettings(),
      'excludePatterns',
      ['tmp'],
      'global'
    );

    expect(result.settings.excludePatterns).toEqual(['fixtures']);
    expect(result.scopedSettings.excludePatterns.globalValue).toEqual(['tmp']);
    expect(result.scopedSettings.excludePatterns.repoValue).toEqual(['fixtures']);
  });

  it('clears repo override and falls back to global value', () => {
    const result = resetRepoScopedSettingOverride(
      createSettings(),
      createScopedSettings(),
      'excludePatterns'
    );

    expect(result.settings.excludePatterns).toEqual(['vendor']);
    expect(result.scopedSettings.excludePatterns.repoValue).toBeUndefined();
    expect(result.scopedSettings.excludePatterns.source).toBe('global');
  });

  it('updates nested evolution settings through scoped writes', () => {
    const result = applyScopedSettingUpdate(
      createSettings(),
      createScopedSettings(),
      'evolution.maxSnapshots',
      12,
      'repo'
    );

    expect(result.settings.evolution.maxSnapshots).toBe(12);
    expect(result.scopedSettings['evolution.maxSnapshots'].repoValue).toBe(12);
  });

  it('renders contextual source labels', () => {
    expect(getScopedSettingSourceLabel('repo', 'repo')).toBe('Saved in Repo');
    expect(getScopedSettingSourceLabel('global', 'repo')).toBe('Inherited from Global');
    expect(getScopedSettingSourceLabel('global', 'global')).toBe('Saved Globally');
  });
});
