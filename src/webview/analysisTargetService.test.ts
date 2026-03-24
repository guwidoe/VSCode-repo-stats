import { describe, expect, it, vi } from 'vitest';
import { AnalysisTargetService } from './analysisTargetService';
import type { RepositoryService } from './repositoryService';
import type { RepositoryContext } from './context';

function createRepository(path: string): RepositoryContext {
  return {
    option: {
      path,
      name: path.split('/').pop() ?? path,
      source: 'workspace',
      workspaceFolderName: 'workspace',
      relativePath: '.',
    },
    rootUri: { fsPath: path } as RepositoryContext['rootUri'],
  };
}

describe('AnalysisTargetService', () => {
  it('getSelectedTarget does not persist selection state as a side effect', async () => {
    const workspaceState = {
      get: vi.fn(() => undefined),
      update: vi.fn(() => Promise.resolve()),
    };
    const repositories = [createRepository('/repo-a')];
    const repositoryService = {
      listAvailableRepositoriesDetailed: vi.fn(async () => ({ repositories, warnings: [] })),
    } as unknown as RepositoryService;

    const service = new AnalysisTargetService(workspaceState, repositoryService);
    const target = await service.getSelectedTarget();

    expect(target?.target.members).toHaveLength(1);
    expect(workspaceState.update).not.toHaveBeenCalled();
  });

  it('resolveSelection persists repository ids by default', async () => {
    const workspaceState = {
      get: vi.fn(() => undefined),
      update: vi.fn(() => Promise.resolve()),
    };
    const repositoryService = {
      listAvailableRepositoriesDetailed: vi.fn(async () => ({
        repositories: [createRepository('/repo-a'), createRepository('/repo-b')],
        warnings: [],
      })),
    } as unknown as RepositoryService;

    const service = new AnalysisTargetService(workspaceState, repositoryService);
    const selection = await service.resolveSelection(['/repo-b']);

    expect(selection.selectedRepositoryIds).toEqual(['/repo-b']);
    expect(selection.repositoryDiscoveryWarnings).toEqual([]);
    expect(workspaceState.update).toHaveBeenCalledWith('repoStats.selectedRepositoryIds', ['/repo-b']);
  });

  it('returns repository discovery warnings to callers', async () => {
    const workspaceState = {
      get: vi.fn(() => undefined),
      update: vi.fn(() => Promise.resolve()),
    };
    const repositoryService = {
      listAvailableRepositoriesDetailed: vi.fn(async () => ({
        repositories: [],
        warnings: [{
          source: 'git-extension',
          message: 'Failed to activate Git extension',
        }],
      })),
    } as unknown as RepositoryService;

    const service = new AnalysisTargetService(workspaceState, repositoryService);
    const selection = await service.resolveSelection(undefined, { persist: false });

    expect(selection.selectedTarget).toBeNull();
    expect(selection.repositoryDiscoveryWarnings).toEqual([
      {
        source: 'git-extension',
        message: 'Failed to activate Git extension',
      },
    ]);
  });
});
