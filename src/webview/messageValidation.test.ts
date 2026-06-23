import { describe, expect, it } from 'vitest';
import * as path from 'path';
import {
  parseWebviewMessage,
  resolveContainedPath,
  validateLogicalPath,
} from './messageValidation';

function createCommitMetadataSettings() {
  return {
    extractors: [
      {
        id: 'conventionalType',
        name: 'Conventional Commit Type',
        enabled: true,
        dimension: 'type',
        includeUnmatched: false,
        unmatchedValue: 'Uncategorized',
        aliases: {},
        kind: 'builtIn' as const,
        builtInId: 'conventionalType' as const,
      },
    ],
    defaultExtractorId: 'conventionalType',
    defaultBucketMode: 'calendar' as const,
    defaultCalendarGranularity: 'month' as const,
    defaultCommitBucketStrategy: 'fixedSize' as const,
    defaultCommitBucketSize: 100,
    defaultCommitBucketCount: 12,
    defaultMetric: 'commits' as const,
    defaultChartType: 'stackedBar' as const,
    multiValueMode: 'countEach' as const,
    includeUncategorized: true,
    maxSeries: 12,
    includeOtherSeries: true,
  };
}

describe('parseWebviewMessage', () => {
  it('accepts valid path-bearing messages', () => {
    expect(parseWebviewMessage({ type: 'openFile', path: 'src/index.ts', repositoryId: 'repo-1' })).toEqual({
      type: 'openFile',
      path: 'src/index.ts',
      repositoryId: 'repo-1',
    });
  });

  it('accepts cancel messages', () => {
    expect(parseWebviewMessage({ type: 'cancelAnalysis' })).toEqual({ type: 'cancelAnalysis' });
    expect(parseWebviewMessage({ type: 'cancelEvolutionAnalysis' })).toEqual({ type: 'cancelEvolutionAnalysis' });
  });

  it('rejects invalid repository selections', () => {
    expect(() => parseWebviewMessage({ type: 'updateRepositorySelection', repositoryIds: ['a', 1] })).toThrow(
      'Expected repositoryIds to be an array of strings.'
    );
  });

  it('rejects invalid scoped setting payloads', () => {
    expect(() => parseWebviewMessage({
      type: 'updateScopedSetting',
      key: 'evolution.maxSnapshots',
      value: 'not-a-number',
      target: 'repo',
    })).toThrow('Received invalid value for scoped setting evolution.maxSnapshots.');
  });

  it('accepts commit metadata scoped settings', () => {
    expect(parseWebviewMessage({
      type: 'updateScopedSetting',
      key: 'commitMetadata',
      value: createCommitMetadataSettings(),
      target: 'repo',
    })).toMatchObject({
      type: 'updateScopedSetting',
      key: 'commitMetadata',
      target: 'repo',
    });
  });

  it('rejects invalid commit metadata settings payloads', () => {
    expect(() => parseWebviewMessage({
      type: 'updateScopedSetting',
      key: 'commitMetadata',
      value: {
        ...createCommitMetadataSettings(),
        defaultBucketMode: 'invalid',
      },
      target: 'repo',
    })).toThrow('Received invalid value for scoped setting commitMetadata.');
  });

  it('rejects malformed settings payloads', () => {
    expect(() => parseWebviewMessage({
      type: 'updateSettings',
      settings: {
        evolution: {
          autoRun: true,
        },
      },
    })).toThrow('Received invalid settings payload from webview.');
  });

  it('rejects webview path traversal requests', () => {
    expect(() => validateLogicalPath('../secrets.txt')).toThrow(
      'Repo Stats rejected a path traversal request from the webview.'
    );
  });

  it('resolves repository-contained paths safely', () => {
    expect(resolveContainedPath('/repo', 'src/index.ts', path)).toBe(path.resolve('/repo', 'src/index.ts'));
    expect(() => resolveContainedPath('/repo', '../etc/passwd', path)).toThrow(
      'Repo Stats rejected a path outside the selected repository.'
    );
  });
});
