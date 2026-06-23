import { describe, expect, it } from 'vitest';
import {
  buildScopedSettingValue,
  getScopedSettingDisplayValue,
  resolveScopedSettingSource,
} from './scopedSettings';
import type { RepoScopedSettings } from '../types';

describe('resolveScopedSettingSource', () => {
  it('prefers repo over global over default', () => {
    expect(resolveScopedSettingSource({ defaultValue: [], workspaceFolderValue: ['repo'] })).toBe('repo');
    expect(resolveScopedSettingSource({ defaultValue: [], globalValue: ['global'] })).toBe('global');
    expect(resolveScopedSettingSource({ defaultValue: [] })).toBe('default');
  });
});

describe('buildScopedSettingValue', () => {
  it('builds repo-scoped state from inspect values', () => {
    expect(
      buildScopedSettingValue({
        defaultValue: [],
        globalValue: ['vendor'],
        workspaceFolderValue: ['fixtures'],
      })
    ).toEqual({
      defaultValue: [],
      globalValue: ['vendor'],
      repoValue: ['fixtures'],
      source: 'repo',
    });
  });
});

describe('getScopedSettingDisplayValue', () => {
  const scopedSettings: RepoScopedSettings = {
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
    maxCommitsToAnalyze: {
      defaultValue: 10000,
      globalValue: 2000,
      repoValue: 500,
      source: 'repo',
    },
    'evolution.historyTraversalMode': {
      defaultValue: 'firstParent',
      source: 'default',
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
    'evolution.showInactivePeriods': {
      defaultValue: false,
      source: 'default',
    },
    'evolution.maxSnapshots': {
      defaultValue: 20,
      source: 'default',
    },
    'evolution.maxSeries': {
      defaultValue: 20,
      source: 'default',
    },
    'evolution.cohortFormat': {
      defaultValue: '%Y',
      source: 'default',
    },
    commitMetadata: {
      defaultValue: {
        extractors: [],
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
      },
      repoValue: {
        extractors: [],
        defaultExtractorId: 'bracketTag',
        defaultBucketMode: 'commitCount',
        defaultCalendarGranularity: 'month',
        defaultCommitBucketStrategy: 'fixedSize',
        defaultCommitBucketSize: 50,
        defaultCommitBucketCount: 8,
        defaultMetric: 'changedLines',
        defaultChartType: 'heatmap',
        multiValueMode: 'first',
        includeUncategorized: false,
        maxSeries: 8,
        includeOtherSeries: true,
      },
      source: 'repo',
    },
  };

  it('uses repo fallback chain for repo target', () => {
    expect(getScopedSettingDisplayValue(scopedSettings, 'excludePatterns', 'repo')).toEqual(['fixtures']);
    expect(getScopedSettingDisplayValue(scopedSettings, 'generatedPatterns', 'repo')).toEqual([
      '**/generated/**',
    ]);
    expect(getScopedSettingDisplayValue(scopedSettings, 'maxCommitsToAnalyze', 'repo')).toBe(500);
    expect(getScopedSettingDisplayValue(scopedSettings, 'evolution.snapshotIntervalDays', 'repo')).toBe(14);
    expect(getScopedSettingDisplayValue(scopedSettings, 'commitMetadata', 'repo').defaultExtractorId).toBe('bracketTag');
  });

  it('uses global or default for global target', () => {
    expect(getScopedSettingDisplayValue(scopedSettings, 'excludePatterns', 'global')).toEqual(['vendor']);
    expect(getScopedSettingDisplayValue(scopedSettings, 'generatedPatterns', 'global')).toEqual([
      '**/generated/**',
    ]);
    expect(getScopedSettingDisplayValue(scopedSettings, 'maxCommitsToAnalyze', 'global')).toBe(2000);
    expect(getScopedSettingDisplayValue(scopedSettings, 'evolution.maxSnapshots', 'global')).toBe(20);
  });
});
