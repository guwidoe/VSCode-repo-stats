import { beforeEach, describe, expect, it, vi } from 'vitest';

const vscodeMocks = vi.hoisted(() => ({
  showOpenDialog: vi.fn(async () => undefined),
  showErrorMessage: vi.fn(async () => undefined),
  showInformationMessage: vi.fn(async () => undefined),
  configGet: vi.fn(() => []),
  configUpdate: vi.fn(async () => undefined),
}));

vi.mock('vscode', () => ({
  window: {
    showOpenDialog: vscodeMocks.showOpenDialog,
    showErrorMessage: vscodeMocks.showErrorMessage,
    showInformationMessage: vscodeMocks.showInformationMessage,
  },
  workspace: {
    getConfiguration: vi.fn(() => ({
      get: vscodeMocks.configGet,
      update: vscodeMocks.configUpdate,
    })),
  },
  ConfigurationTarget: {
    Global: 'global',
  },
}));

import { BookmarkedRepositoryManager } from './bookmarkedRepositoryManager.js';

describe('BookmarkedRepositoryManager', () => {
  beforeEach(() => {
    vscodeMocks.showOpenDialog.mockReset();
    vscodeMocks.showErrorMessage.mockReset();
    vscodeMocks.showInformationMessage.mockReset();
    vscodeMocks.configGet.mockReset();
    vscodeMocks.configUpdate.mockReset();
    vscodeMocks.configGet.mockReturnValue([]);
  });

  it('normalizes configured repository paths', () => {
    vscodeMocks.configGet.mockReturnValue([' /tmp/example ', 42, ''] as never);
    const manager = new BookmarkedRepositoryManager();

    expect(manager.getConfiguredBookmarkedRepositories()).toEqual(['/tmp/example']);
  });

  it('adds a selected repository after resolving its git root', async () => {
    vscodeMocks.showOpenDialog.mockResolvedValue([{ fsPath: '/workspace/repo/subdir' }] as never);
    const manager = new BookmarkedRepositoryManager(() => ({
      checkIsRepo: vi.fn(async () => true),
      revparse: vi.fn(async () => '/workspace/repo\n'),
    }) as never);

    await expect(manager.promptAndAddRepository()).resolves.toBe('/workspace/repo');
    expect(vscodeMocks.configUpdate).toHaveBeenCalledWith(
      'bookmarkedRepositories',
      ['/workspace/repo'],
      'global'
    );
    expect(vscodeMocks.showInformationMessage).toHaveBeenCalledWith('Added bookmarked repository: /workspace/repo');
  });

  it('reports already-bookmarked repositories without updating configuration', async () => {
    vscodeMocks.showOpenDialog.mockResolvedValue([{ fsPath: '/workspace/repo' }] as never);
    vscodeMocks.configGet.mockReturnValue(['/workspace/repo'] as never);
    const manager = new BookmarkedRepositoryManager(() => ({
      checkIsRepo: vi.fn(async () => true),
      revparse: vi.fn(async () => '/workspace/repo\n'),
    }) as never);

    await expect(manager.promptAndAddRepository()).resolves.toBeNull();
    expect(vscodeMocks.configUpdate).not.toHaveBeenCalled();
    expect(vscodeMocks.showInformationMessage).toHaveBeenCalledWith('Repository already bookmarked: /workspace/repo');
  });
});
