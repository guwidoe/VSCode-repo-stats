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
      globalValue: true,
      source: 'global',
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

  it('renders contextual source labels', () => {
    expect(getScopedSettingSourceLabel('repo', 'repo')).toBe('Saved in Repo');
    expect(getScopedSettingSourceLabel('global', 'repo')).toBe('Inherited from Global');
    expect(getScopedSettingSourceLabel('global', 'global')).toBe('Saved Globally');
  });
});
