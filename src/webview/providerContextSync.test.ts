import { describe, expect, it, vi } from 'vitest';
import { ProviderContextSync } from './providerContextSync.js';
import type { AnalysisTargetSelection } from './context.js';

function createSelection(): AnalysisTargetSelection {
  return {
    repositories: [
      {
        option: {
          name: 'repo-a',
          path: '/workspace/repo-a',
          source: 'workspace',
        },
        rootUri: { fsPath: '/workspace/repo-a' } as never,
      },
    ],
    selectedRepositoryIds: ['/workspace/repo-a'],
    selectedTarget: {
      option: {
        id: 'target-1',
        kind: 'repository',
        label: 'repo-a',
        memberCount: 1,
        settingsScope: 'repo',
      },
      target: {
        id: 'target-1',
        kind: 'repository',
        label: 'repo-a',
        members: [],
        settingsScope: 'repo',
      },
    },
    selectedTargetOption: {
      id: 'target-1',
      kind: 'repository',
      label: 'repo-a',
      memberCount: 1,
      settingsScope: 'repo',
    },
    repositoryDiscoveryWarnings: [],
  };
}

describe('ProviderContextSync', () => {
  it('publishes repository selection and settings payloads together', async () => {
    const selection = createSelection();
    const webview = { postMessage: vi.fn() };
    const sync = new ProviderContextSync({
      resolveSelection: vi.fn(async () => selection),
      getSelectedTarget: vi.fn(async () => selection.selectedTarget),
      getSettings: vi.fn(() => ({ overviewDisplayMode: 'percent' } as never)),
      getRepoScopedSettings: vi.fn(() => ({ excludePatterns: [] } as never)),
      canUseRepoScope: vi.fn(() => true),
      sendStalenessStatus: vi.fn(async () => {}),
      runAnalysis: vi.fn(async () => {}),
      promptReanalysis: vi.fn(async () => {}),
    });

    await sync.sendCurrentTargetContext(webview as never);

    expect(webview.postMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ type: 'repositorySelectionLoaded' }));
    expect(webview.postMessage).toHaveBeenNthCalledWith(2, expect.objectContaining({ type: 'settingsLoaded' }));
  });

  it('updates repository selection by republishing context, staleness, and analysis', async () => {
    const selection = createSelection();
    const webview = { postMessage: vi.fn() };
    const sendStalenessStatus = vi.fn(async () => {});
    const runAnalysis = vi.fn(async () => {});
    const sync = new ProviderContextSync({
      resolveSelection: vi.fn(async () => selection),
      getSelectedTarget: vi.fn(async () => selection.selectedTarget),
      getSettings: vi.fn(() => ({} as never)),
      getRepoScopedSettings: vi.fn(() => ({} as never)),
      canUseRepoScope: vi.fn(() => false),
      sendStalenessStatus,
      runAnalysis,
      promptReanalysis: vi.fn(async () => {}),
    });

    await sync.updateRepositorySelection(['/workspace/repo-a'], webview as never);

    expect(sendStalenessStatus).toHaveBeenCalledWith(webview, selection.selectedTarget);
    expect(runAnalysis).toHaveBeenCalledWith(webview, selection.selectedTarget);
  });

  it('prompts reanalysis only when requested after settings mutation', async () => {
    const selection = createSelection();
    const promptReanalysis = vi.fn(async () => {});
    const sync = new ProviderContextSync({
      resolveSelection: vi.fn(async () => selection),
      getSelectedTarget: vi.fn(async () => selection.selectedTarget),
      getSettings: vi.fn(() => ({} as never)),
      getRepoScopedSettings: vi.fn(() => ({} as never)),
      canUseRepoScope: vi.fn(() => false),
      sendStalenessStatus: vi.fn(async () => {}),
      runAnalysis: vi.fn(async () => {}),
      promptReanalysis,
    });

    await sync.handlePostSettingsMutation({ postMessage: vi.fn() } as never, true);
    await sync.handlePostSettingsMutation({ postMessage: vi.fn() } as never, false);

    expect(promptReanalysis).toHaveBeenCalledTimes(1);
  });
});
