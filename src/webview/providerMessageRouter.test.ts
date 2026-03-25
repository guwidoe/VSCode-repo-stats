import { describe, expect, it, vi } from 'vitest';
import type { AnalysisTargetContext } from './context';
import { ProviderMessageRouter } from './providerMessageRouter';

function createDependencies(selectedTarget: AnalysisTargetContext | null = null) {
  return {
    runAnalysis: vi.fn(async () => {}),
    refresh: vi.fn(async () => {}),
    cancelAnalysis: vi.fn(),
    runEvolutionAnalysis: vi.fn(async () => {}),
    cancelEvolutionAnalysis: vi.fn(),
    sendStalenessStatus: vi.fn(async () => {}),
    getSelectedTarget: vi.fn(async () => selectedTarget),
    updateRepositorySelection: vi.fn(async () => {}),
    openRepositoryFile: vi.fn(async () => {}),
    revealRepositoryFile: vi.fn(async () => {}),
    copyRepositoryPath: vi.fn(async () => {}),
    showPathCopiedMessage: vi.fn(),
    sendCurrentTargetContext: vi.fn(async () => {}),
    updateSettings: vi.fn(async () => false),
    updateScopedSetting: vi.fn(async () => false),
    resetScopedSettingOverride: vi.fn(async () => false),
    handlePostSettingsMutation: vi.fn(async () => {}),
  };
}

describe('ProviderMessageRouter', () => {
  it('routes refresh and cancel messages for core analysis', async () => {
    const deps = createDependencies();
    const router = new ProviderMessageRouter(deps);
    const webview = {};

    await router.route({ type: 'requestRefresh' }, webview as never);
    await router.route({ type: 'cancelAnalysis' }, webview as never);

    expect(deps.refresh).toHaveBeenCalledTimes(1);
    expect(deps.cancelAnalysis).toHaveBeenCalledWith(webview);
  });

  it('routes refresh and cancel messages for evolution analysis', async () => {
    const selectedTarget = { target: { id: 'workspace' } } as AnalysisTargetContext;
    const deps = createDependencies(selectedTarget);
    const router = new ProviderMessageRouter(deps);
    const webview = {};

    await router.route({ type: 'requestEvolutionRefresh' }, webview as never);
    await router.route({ type: 'cancelEvolutionAnalysis' }, webview as never);

    expect(deps.getSelectedTarget).toHaveBeenCalledTimes(1);
    expect(deps.runEvolutionAnalysis).toHaveBeenCalledWith(webview, selectedTarget, true);
    expect(deps.cancelEvolutionAnalysis).toHaveBeenCalledWith(webview);
  });
});
