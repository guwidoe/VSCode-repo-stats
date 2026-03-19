import { describe, expect, it } from 'vitest';
import {
  buildRepositoryWithSubmodulesTarget,
  buildSingleRepositoryTarget,
  buildWorkspaceTarget,
  selectPreferredTargetId,
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

  it('builds a repository-with-submodules target with parent exclusions', () => {
    const target = buildRepositoryWithSubmodulesTarget({
      repository: {
        option: {
          path: '/workspace/project',
          name: 'project',
          source: 'workspace',
          workspaceFolderName: 'project',
          relativePath: '.',
        },
        rootPath: '/workspace/project',
      },
      submodulePaths: ['vendor/lib-a', 'vendor/lib-b'],
    });

    expect(target.kind).toBe('repositoryWithSubmodules');
    expect(target.members[0]?.excludePatterns).toEqual(['vendor/lib-a', 'vendor/lib-b']);
    expect(target.members.slice(1).map((member) => member.pathPrefix)).toEqual([
      'vendor/lib-a',
      'vendor/lib-b',
    ]);
  });

  it('builds a workspace target with unique path prefixes', () => {
    const target = buildWorkspaceTarget([
      {
        option: {
          path: '/workspace/app-a',
          name: 'service',
          source: 'workspace',
          workspaceFolderName: 'app-a',
          relativePath: '.',
        },
        rootPath: '/workspace/app-a',
      },
      {
        option: {
          path: '/workspace/app-b',
          name: 'service',
          source: 'workspace',
          workspaceFolderName: 'app-b',
          relativePath: '.',
        },
        rootPath: '/workspace/app-b',
      },
    ]);

    expect(target.kind).toBe('workspace');
    expect(target.members.map((member) => member.pathPrefix)).toEqual(['app-a', 'app-b']);
  });

  it('selects the preferred target id when available', () => {
    const targets = [{ id: 'repo:/a' }, { id: 'workspace:/a|/b' }];

    expect(selectPreferredTargetId(targets, 'workspace:/a|/b')).toBe('workspace:/a|/b');
    expect(selectPreferredTargetId(targets, 'missing')).toBe('repo:/a');
    expect(selectPreferredTargetId([], 'repo:/a')).toBeNull();
  });
});
