import { describe, expect, it } from 'vitest';
import {
  buildRepositoryOption,
  getRepositoryRelativePath,
  selectPreferredRepositoryPath,
} from './repositorySelection';

describe('repositorySelection helpers', () => {
  it('computes repository-relative paths inside the workspace folder', () => {
    expect(getRepositoryRelativePath('/workspace/project', '/workspace/project')).toBe('.');
    expect(getRepositoryRelativePath('/workspace/project/packages/api', '/workspace/project')).toBe('packages/api');
  });

  it('builds workspace repository options with source and workspace metadata', () => {
    expect(
      buildRepositoryOption({
        source: 'workspace',
        repoPath: '/workspace/project/packages/api',
        workspaceFolderPath: '/workspace/project',
        workspaceFolderName: 'project',
      })
    ).toEqual({
      path: '/workspace/project/packages/api',
      name: 'api',
      source: 'workspace',
      workspaceFolderName: 'project',
      relativePath: 'packages/api',
    });
  });

  it('builds bookmarked repository options without workspace metadata', () => {
    expect(
      buildRepositoryOption({
        source: 'bookmarked',
        repoPath: '/repos/service-a',
      })
    ).toEqual({
      path: '/repos/service-a',
      name: 'service-a',
      source: 'bookmarked',
    });
  });

  it('selects the preferred repository when available', () => {
    const repositories = [{ path: '/workspace/a' }, { path: '/workspace/b' }];

    expect(selectPreferredRepositoryPath(repositories, '/workspace/b')).toBe('/workspace/b');
    expect(selectPreferredRepositoryPath(repositories, '/workspace/c')).toBe('/workspace/a');
    expect(selectPreferredRepositoryPath([], '/workspace/a')).toBeNull();
  });
});
