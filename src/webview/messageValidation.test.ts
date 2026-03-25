import { describe, expect, it } from 'vitest';
import * as path from 'path';
import {
  parseWebviewMessage,
  resolveContainedPath,
  validateLogicalPath,
} from './messageValidation';

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
