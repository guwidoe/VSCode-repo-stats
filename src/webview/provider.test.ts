import { beforeEach, describe, expect, it, vi } from 'vitest';

const vscodeMocks = vi.hoisted(() => ({
  showErrorMessage: vi.fn(async () => undefined),
  showInformationMessage: vi.fn(async () => undefined),
}));

vi.mock('vscode', () => ({
  window: {
    showErrorMessage: vscodeMocks.showErrorMessage,
    showInformationMessage: vscodeMocks.showInformationMessage,
  },
  workspace: {
    getConfiguration: vi.fn(() => ({
      get: vi.fn(() => []),
      update: vi.fn(async () => {}),
    })),
  },
  commands: {
    executeCommand: vi.fn(async () => {}),
  },
  env: {
    clipboard: {
      writeText: vi.fn(async () => {}),
    },
  },
  Uri: {
    file: (fsPath: string) => ({ fsPath }),
    joinPath: (...parts: Array<{ fsPath?: string } | string>) => ({
      fsPath: parts.map((part) => typeof part === 'string' ? part : part.fsPath ?? '').join('/'),
    }),
  },
  ConfigurationTarget: {
    Global: 'global',
    WorkspaceFolder: 'workspaceFolder',
  },
  ViewColumn: { One: 1 },
  StatusBarAlignment: { Right: 1 },
}));

import { RepoStatsProvider } from './provider';

function createProvider() {
  const workspaceState = {
    get: vi.fn(),
    update: vi.fn(async () => {}),
  };
  const provider = new RepoStatsProvider({ fsPath: '/extension' } as never, workspaceState as never, '/tmp/storage');
  const providerAny = provider as unknown as {
    analysisService: Record<string, unknown>;
    analysisTargetService: Record<string, unknown>;
    settingsService: Record<string, unknown>;
    contextSync: Record<string, unknown>;
    fileActions: Record<string, unknown>;
    handleWebviewMessage: (message: unknown, webview: { postMessage: (message: unknown) => void }) => Promise<void>;
    runAnalysis: (webview: unknown) => Promise<void>;
    updateSettings: (settings: unknown, target: string) => Promise<boolean>;
    updateScopedSetting: (key: string, value: unknown, target: string) => Promise<boolean>;
  };

  providerAny.analysisService = {
    runAnalysis: vi.fn(async () => {}),
    runEvolutionAnalysis: vi.fn(async () => {}),
    sendStalenessStatus: vi.fn(async () => {}),
  };
  providerAny.analysisTargetService = {
    getSelectedTarget: vi.fn(async () => null),
    resolveSelection: vi.fn(async () => ({
      repositories: [],
      selectedRepositoryIds: [],
      selectedTarget: null,
      selectedTargetOption: null,
      repositoryDiscoveryWarnings: [],
    })),
  };
  providerAny.settingsService = {
    getSettings: vi.fn(() => ({})),
    getRepoScopedSettings: vi.fn(() => ({})),
    canUseRepoScope: vi.fn(() => false),
  };
  providerAny.contextSync = {
    sendCurrentTargetContext: vi.fn(async () => {}),
    updateRepositorySelection: vi.fn(async () => {}),
    handlePostSettingsMutation: vi.fn(async () => {}),
  };
  providerAny.fileActions = {
    openRepositoryFile: vi.fn(async () => {}),
    revealRepositoryFile: vi.fn(async () => {}),
    copyRepositoryPath: vi.fn(async () => {}),
  };

  return {
    provider,
    providerAny,
    webview: { postMessage: vi.fn() },
  };
}

beforeEach(() => {
  vscodeMocks.showErrorMessage.mockClear();
  vscodeMocks.showInformationMessage.mockClear();
});

describe('RepoStatsProvider message routing', () => {
  it('routes analysis requests through runAnalysis', async () => {
    const { providerAny, webview } = createProvider();
    providerAny.runAnalysis = vi.fn(async () => {});

    await providerAny.handleWebviewMessage({ type: 'requestAnalysis' }, webview);

    expect(providerAny.runAnalysis).toHaveBeenCalledWith(webview);
  });

  it('routes file actions with repository identity', async () => {
    const { providerAny, webview } = createProvider();
    providerAny.fileActions.openRepositoryFile = vi.fn(async () => {});
    providerAny.fileActions.revealRepositoryFile = vi.fn(async () => {});
    providerAny.fileActions.copyRepositoryPath = vi.fn(async () => {});

    await providerAny.handleWebviewMessage({ type: 'openFile', path: 'src/app.ts', repositoryId: 'repo-1' }, webview);
    await providerAny.handleWebviewMessage({ type: 'revealInExplorer', path: 'src', repositoryId: 'repo-2' }, webview);
    await providerAny.handleWebviewMessage({ type: 'copyPath', path: 'README.md', repositoryId: 'repo-3' }, webview);

    expect(providerAny.fileActions.openRepositoryFile).toHaveBeenCalledWith('src/app.ts', 'repo-1');
    expect(providerAny.fileActions.revealRepositoryFile).toHaveBeenCalledWith('src', 'repo-2');
    expect(providerAny.fileActions.copyRepositoryPath).toHaveBeenCalledWith('README.md', 'repo-3');
    expect(vscodeMocks.showInformationMessage).toHaveBeenCalledWith('Path copied to clipboard');
  });

  it('routes settings mutations through the shared post-mutation flow', async () => {
    const { providerAny, webview } = createProvider();
    providerAny.updateSettings = vi.fn(async () => true);
    providerAny.updateScopedSetting = vi.fn(async () => false);
    providerAny.contextSync.handlePostSettingsMutation = vi.fn(async () => {});

    await providerAny.handleWebviewMessage({
      type: 'updateSettings',
      settings: { overviewDisplayMode: 'count' },
      target: 'global',
    }, webview);
    await providerAny.handleWebviewMessage({
      type: 'updateScopedSetting',
      key: 'excludePatterns',
      value: ['fixtures'],
      target: 'repo',
    }, webview);

    expect(providerAny.updateSettings).toHaveBeenCalledWith({ overviewDisplayMode: 'count' }, 'global');
    expect(providerAny.updateScopedSetting).toHaveBeenCalledWith('excludePatterns', ['fixtures'], 'repo');
    expect(providerAny.contextSync.handlePostSettingsMutation).toHaveBeenNthCalledWith(1, webview, true);
    expect(providerAny.contextSync.handlePostSettingsMutation).toHaveBeenNthCalledWith(2, webview, false);
  });

  it('recovers from invalid messages by surfacing an error and refreshing context', async () => {
    const { providerAny, webview } = createProvider();
    providerAny.contextSync.sendCurrentTargetContext = vi.fn(async () => {});

    await providerAny.handleWebviewMessage({ path: 'missing-type' }, webview);

    expect(vscodeMocks.showErrorMessage).toHaveBeenCalledWith(expect.stringContaining('Repo Stats error:'));
    expect(providerAny.contextSync.sendCurrentTargetContext).toHaveBeenCalledWith(webview);
    expect((providerAny.analysisService as { sendStalenessStatus: ReturnType<typeof vi.fn> }).sendStalenessStatus).toHaveBeenCalled();
  });
});
