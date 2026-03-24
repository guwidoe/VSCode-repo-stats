import type * as vscode from 'vscode';
import type { ExtensionMessage } from '../types/index.js';
import type { AnalysisTargetSelection } from './context.js';
import type { RepositorySettingsService } from './settingsService.js';

interface ProviderContextSyncDependencies {
  resolveSelection: (repositoryIds?: string[], options?: { persist?: boolean }) => Promise<AnalysisTargetSelection>;
  getSelectedTarget: () => Promise<AnalysisTargetSelection['selectedTarget']>;
  getSettings: RepositorySettingsService['getSettings'];
  getRepoScopedSettings: RepositorySettingsService['getRepoScopedSettings'];
  canUseRepoScope: RepositorySettingsService['canUseRepoScope'];
  sendStalenessStatus: (
    webview: vscode.Webview,
    target: AnalysisTargetSelection['selectedTarget']
  ) => Promise<void>;
  runAnalysis: (webview: vscode.Webview, target: AnalysisTargetSelection['selectedTarget']) => Promise<void>;
  promptReanalysis: (webview: vscode.Webview) => Promise<void>;
}

export class ProviderContextSync {
  constructor(private readonly deps: ProviderContextSyncDependencies) {}

  async sendCurrentTargetContext(
    webview: vscode.Webview,
    selection?: AnalysisTargetSelection
  ): Promise<AnalysisTargetSelection> {
    const resolved = selection ?? await this.deps.resolveSelection();

    this.sendMessage(webview, {
      type: 'repositorySelectionLoaded',
      repositories: resolved.repositories.map((repository) => repository.option),
      selectedRepositoryIds: resolved.selectedRepositoryIds,
      selectedTarget: resolved.selectedTargetOption,
    });

    this.sendMessage(webview, {
      type: 'settingsLoaded',
      settings: this.deps.getSettings(resolved.selectedTarget?.settingsRepository),
      scopedSettings: this.deps.getRepoScopedSettings(resolved.selectedTarget?.settingsRepository),
      repoScopeAvailable: this.deps.canUseRepoScope(resolved.selectedTarget?.settingsRepository),
    });

    return resolved;
  }

  async updateRepositorySelection(repositoryIds: string[], webview: vscode.Webview): Promise<void> {
    const selection = await this.deps.resolveSelection(repositoryIds);
    await this.sendCurrentTargetContext(webview, selection);
    await this.deps.sendStalenessStatus(webview, selection.selectedTarget);
    await this.deps.runAnalysis(webview, selection.selectedTarget);
  }

  async handlePostSettingsMutation(
    webview: vscode.Webview,
    shouldPromptReanalysis: boolean
  ): Promise<void> {
    const selectedTarget = await this.deps.getSelectedTarget();
    await this.sendCurrentTargetContext(webview);
    await this.deps.sendStalenessStatus(webview, selectedTarget);

    if (shouldPromptReanalysis) {
      await this.deps.promptReanalysis(webview);
    }
  }

  private sendMessage(webview: vscode.Webview, message: ExtensionMessage): void {
    webview.postMessage(message);
  }
}
