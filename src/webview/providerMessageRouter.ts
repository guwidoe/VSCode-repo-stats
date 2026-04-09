import type * as vscode from 'vscode';
import type {
  ExtensionSettings,
  RepoScopableSettingKey,
  RepoScopableSettingValueMap,
  SettingWriteTarget,
  WebviewMessage,
} from '../types/index.js';
import type { AnalysisTargetContext } from './context.js';
import type {
  ProviderFileActionFailureReason,
  ProviderFileActionResult,
} from './providerFileActions.js';

interface ProviderMessageRouterDependencies {
  runAnalysis: (webview: vscode.Webview) => Promise<void>;
  refresh: () => Promise<void>;
  cancelAnalysis: (webview: vscode.Webview) => void;
  runEvolutionAnalysis: (
    webview: vscode.Webview,
    target: AnalysisTargetContext | null,
    forceRefresh: boolean
  ) => Promise<void>;
  cancelEvolutionAnalysis: (webview: vscode.Webview) => void;
  sendStalenessStatus: (
    webview: vscode.Webview,
    target: AnalysisTargetContext | null
  ) => Promise<void>;
  getSelectedTarget: () => Promise<AnalysisTargetContext | null>;
  updateRepositorySelection: (repositoryIds: string[], webview: vscode.Webview) => Promise<void>;
  openRepositoryFile: (path: string, repositoryId?: string) => Promise<ProviderFileActionResult>;
  revealRepositoryFile: (path: string, repositoryId?: string) => Promise<ProviderFileActionResult>;
  copyRepositoryPath: (path: string, repositoryId?: string) => Promise<ProviderFileActionResult>;
  showPathCopiedMessage: () => void;
  showFileActionFailure: (action: 'open' | 'reveal' | 'copy', reason: ProviderFileActionFailureReason) => void;
  sendCurrentTargetContext: (webview: vscode.Webview) => Promise<unknown>;
  updateSettings: (settings: Partial<ExtensionSettings>, target: SettingWriteTarget) => Promise<boolean>;
  updateScopedSetting: <K extends RepoScopableSettingKey>(
    key: K,
    value: RepoScopableSettingValueMap[K],
    target: SettingWriteTarget
  ) => Promise<boolean>;
  resetScopedSettingOverride: (key: RepoScopableSettingKey) => Promise<boolean>;
  handlePostSettingsMutation: (webview: vscode.Webview, shouldPromptReanalysis: boolean) => Promise<void>;
}

export class ProviderMessageRouter {
  constructor(private readonly deps: ProviderMessageRouterDependencies) {}

  async route(message: WebviewMessage, webview: vscode.Webview): Promise<void> {
    switch (message.type) {
      case 'requestAnalysis':
        await this.deps.runAnalysis(webview);
        return;

      case 'requestRefresh':
        await this.deps.refresh();
        return;

      case 'cancelAnalysis':
        this.deps.cancelAnalysis(webview);
        return;

      case 'requestEvolutionAnalysis':
        await this.deps.runEvolutionAnalysis(webview, await this.deps.getSelectedTarget(), false);
        return;

      case 'requestEvolutionRefresh':
        await this.deps.runEvolutionAnalysis(webview, await this.deps.getSelectedTarget(), true);
        return;

      case 'cancelEvolutionAnalysis':
        this.deps.cancelEvolutionAnalysis(webview);
        return;

      case 'checkStaleness':
        await this.deps.sendStalenessStatus(webview, await this.deps.getSelectedTarget());
        return;

      case 'updateRepositorySelection':
        await this.deps.updateRepositorySelection(message.repositoryIds, webview);
        return;

      case 'openFile':
        await this.handleFileActionFailure(
          'open',
          this.deps.openRepositoryFile(message.path, message.repositoryId)
        );
        return;

      case 'revealInExplorer':
        await this.handleFileActionFailure(
          'reveal',
          this.deps.revealRepositoryFile(message.path, message.repositoryId)
        );
        return;

      case 'copyPath': {
        const result = await this.deps.copyRepositoryPath(message.path, message.repositoryId);
        if (result.ok) {
          this.deps.showPathCopiedMessage();
        } else {
          this.deps.showFileActionFailure('copy', result.reason ?? 'unresolved-path');
        }
        return;
      }

      case 'getSettings':
        await this.deps.sendCurrentTargetContext(webview);
        return;

      case 'updateSettings': {
        const shouldPromptReanalysis = await this.deps.updateSettings(
          message.settings,
          message.target ?? 'global'
        );
        await this.deps.handlePostSettingsMutation(webview, shouldPromptReanalysis);
        return;
      }

      case 'updateScopedSetting': {
        const shouldPromptReanalysis = await this.deps.updateScopedSetting(
          message.key,
          message.value,
          message.target
        );
        await this.deps.handlePostSettingsMutation(webview, shouldPromptReanalysis);
        return;
      }

      case 'resetScopedSetting': {
        const shouldPromptReanalysis = await this.deps.resetScopedSettingOverride(message.key);
        await this.deps.handlePostSettingsMutation(webview, shouldPromptReanalysis);
        return;
      }
    }
  }

  private async handleFileActionFailure(
    action: 'open' | 'reveal',
    actionPromise: Promise<ProviderFileActionResult>
  ): Promise<void> {
    const result = await actionPromise;
    if (!result.ok) {
      this.deps.showFileActionFailure(action, result.reason ?? 'unresolved-path');
    }
  }
}
