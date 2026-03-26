import { beforeEach, describe, expect, it, vi } from 'vitest';

const vscodeMocks = vi.hoisted(() => ({
  showTextDocument: vi.fn(async () => undefined),
  executeCommand: vi.fn(async () => undefined),
  writeText: vi.fn(async () => undefined),
}));

vi.mock('vscode', () => ({
  window: {
    showTextDocument: vscodeMocks.showTextDocument,
  },
  commands: {
    executeCommand: vscodeMocks.executeCommand,
  },
  env: {
    clipboard: {
      writeText: vscodeMocks.writeText,
    },
  },
  Uri: {
    file: (fsPath: string) => ({ fsPath }),
  },
}));

import { ProviderFileActions } from './providerFileActions.js';
import type { AnalysisTargetContext } from './context.js';

function createTargetContext(): AnalysisTargetContext {
  return {
    option: {
      id: 'target-1',
      kind: 'workspace',
      label: 'Target',
      memberCount: 2,
      settingsScope: 'workspace',
    },
    target: {
      id: 'target-1',
      kind: 'workspace',
      label: 'Target',
      settingsScope: 'workspace',
      members: [
        {
          id: 'repo-1',
          repoPath: '/workspace/repo-a',
          displayName: 'repo-a',
          logicalRoot: 'repo-a',
          pathPrefix: '',
          role: 'primary',
        },
        {
          id: 'repo-2',
          repoPath: '/workspace/repo-b',
          displayName: 'repo-b',
          logicalRoot: 'nested/repo-b',
          pathPrefix: 'nested/repo-b',
          role: 'workspaceRepo',
        },
      ],
    },
  };
}

describe('ProviderFileActions', () => {
  beforeEach(() => {
    vscodeMocks.showTextDocument.mockClear();
    vscodeMocks.executeCommand.mockClear();
    vscodeMocks.writeText.mockClear();
  });

  it('resolves repository-aware logical paths to contained files', async () => {
    const actions = new ProviderFileActions({
      getSelectedTarget: vi.fn(async () => createTargetContext()),
    });

    await expect(actions.resolveTargetFilePath('nested/repo-b/src/app.ts')).resolves.toBe('/workspace/repo-b/src/app.ts');
    await expect(actions.resolveTargetFilePath('src/index.ts', 'repo-1')).resolves.toBe('/workspace/repo-a/src/index.ts');
  });

  it('returns undefined when the repository id is unknown', async () => {
    const actions = new ProviderFileActions({
      getSelectedTarget: vi.fn(async () => createTargetContext()),
    });

    await expect(actions.resolveTargetFilePath('src/index.ts', 'missing')).resolves.toBeUndefined();
  });

  it('routes open, reveal, and copy operations through vscode for resolved paths', async () => {
    const actions = new ProviderFileActions({
      getSelectedTarget: vi.fn(async () => createTargetContext()),
    });

    await expect(actions.openRepositoryFile('nested/repo-b/src/app.ts')).resolves.toEqual({ ok: true });
    await expect(actions.revealRepositoryFile('nested/repo-b/src/app.ts')).resolves.toEqual({ ok: true });
    await expect(actions.copyRepositoryPath('nested/repo-b/src/app.ts')).resolves.toEqual({ ok: true });

    expect(vscodeMocks.showTextDocument).toHaveBeenCalledWith({ fsPath: '/workspace/repo-b/src/app.ts' });
    expect(vscodeMocks.executeCommand).toHaveBeenCalledWith('revealInExplorer', { fsPath: '/workspace/repo-b/src/app.ts' });
    expect(vscodeMocks.writeText).toHaveBeenCalledWith('/workspace/repo-b/src/app.ts');
  });

  it('returns explicit failure results when a logical path cannot be resolved', async () => {
    const actions = new ProviderFileActions({
      getSelectedTarget: vi.fn(async () => createTargetContext()),
    });

    await expect(actions.openRepositoryFile('src/index.ts', 'missing')).resolves.toEqual({ ok: false });
    await expect(actions.revealRepositoryFile('src/index.ts', 'missing')).resolves.toEqual({ ok: false });
    await expect(actions.copyRepositoryPath('src/index.ts', 'missing')).resolves.toEqual({ ok: false });

    expect(vscodeMocks.showTextDocument).not.toHaveBeenCalled();
    expect(vscodeMocks.executeCommand).not.toHaveBeenCalled();
    expect(vscodeMocks.writeText).not.toHaveBeenCalled();
  });
});
