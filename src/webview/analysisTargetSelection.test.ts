import { describe, expect, it } from 'vitest';
import {
  buildSelectionTarget,
  buildSingleRepositoryTarget,
  buildTargetForSelectedRepositories,
  getTopLevelRepositoryIds,
  selectPreferredRepositoryIds,
} from './analysisTargetSelection';

describe('analysisTargetSelection helpers', () => {
  it('builds a single-repository target', () => {
    const target = buildSingleRepositoryTarget({
      option: {
        path: '/workspace/project',
        name: 'project',
        source: 'workspace',
        workspaceFolderName: 'project',
        relativePath: '.',
      },
      rootPath: '/workspace/project',
    });

    expect(target).toMatchObject({
      kind: 'repository',
      label: 'project',
      settingsScope: 'repo',
      members: [
        {
          role: 'primary',
          repoPath: '/workspace/project',
          pathPrefix: '',
        },
      ],
    });
  });

  it('builds a multi-repository selection target with parent exclusions', () => {
    const target = buildSelectionTarget([
      {
        option: {
          path: '/workspace/project',
          name: 'project',
          source: 'workspace',
          workspaceFolderName: 'project',
          relativePath: '.',
        },
        rootPath: '/workspace/project',
      },
      {
        option: {
          path: '/workspace/project/vendor/lib-a',
          name: 'lib-a',
          source: 'workspace',
          workspaceFolderName: 'project',
          relativePath: 'vendor/lib-a',
        },
        rootPath: '/workspace/project/vendor/lib-a',
      },
    ]);

    expect(target.kind).toBe('workspace');
    expect(target.members[0]?.excludePatterns).toEqual(['vendor/lib-a']);
    expect(target.members.map((member) => member.pathPrefix)).toEqual([
      'project',
      'project/vendor/lib-a',
    ]);
  });

  it('returns null when no repositories are selected', () => {
    expect(buildTargetForSelectedRepositories([])).toBeNull();
  });

  it('defaults selection to all repositories when no valid preference exists', () => {
    const repositories = [{ path: '/workspace/a' }, { path: '/workspace/b' }];

    expect(selectPreferredRepositoryIds(repositories, ['/workspace/missing'])).toEqual([
      '/workspace/a',
      '/workspace/b',
    ]);
    expect(selectPreferredRepositoryIds(repositories, ['/workspace/b'])).toEqual(['/workspace/b']);
    expect(selectPreferredRepositoryIds([], ['/workspace/a'])).toEqual([]);
  });

  it('returns only top-level repositories for the preset helper', () => {
    const repositories = [
      { path: '/workspace/project' },
      { path: '/workspace/project/vendor/lib-a' },
      { path: '/workspace/other' },
    ];

    expect(getTopLevelRepositoryIds(repositories)).toEqual([
      '/workspace/project',
      '/workspace/other',
    ]);
  });
});
