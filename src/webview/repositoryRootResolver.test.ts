import { describe, expect, it, vi } from 'vitest';

vi.mock('vscode', () => ({
  Uri: {
    file: (fsPath: string) => ({ fsPath }),
  },
}));

import { RepositoryRootResolver } from './repositoryRootResolver.js';

describe('RepositoryRootResolver', () => {
  it('returns not-repository when git reports false', async () => {
    const resolver = new RepositoryRootResolver(() => ({
      checkIsRepo: vi.fn(async () => false),
    }) as never);

    await expect(resolver.resolve('/workspace/repo', 'workspace')).resolves.toEqual({ kind: 'not-repository' });
  });

  it('returns a resolved root uri for valid repositories', async () => {
    const resolver = new RepositoryRootResolver(() => ({
      checkIsRepo: vi.fn(async () => true),
      revparse: vi.fn(async () => '/workspace/repo\n'),
    }) as never);

    await expect(resolver.resolve('/workspace/repo', 'workspace')).resolves.toEqual({
      kind: 'resolved',
      rootUri: { fsPath: '/workspace/repo' },
    });
  });

  it('returns a warning when root resolution throws', async () => {
    const resolver = new RepositoryRootResolver(() => ({
      checkIsRepo: vi.fn(async () => true),
      revparse: vi.fn(async () => {
        throw new Error('boom');
      }),
    }) as never);

    await expect(resolver.resolve('/workspace/repo', 'workspace')).resolves.toEqual({
      kind: 'error',
      warning: {
        source: 'workspace',
        message: 'Failed to resolve repository root: boom',
        repositoryPath: '/workspace/repo',
      },
    });
  });
});
