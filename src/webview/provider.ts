import * as vscode from 'vscode';
import {
  ExtensionMessage,
  RepoScopableSettingKey,
  RepoScopableSettingValueMap,
  SettingWriteTarget,
} from '../types/index.js';
import { RepoAnalysisService } from './analysisService.js';
import { AnalysisTargetService } from './analysisTargetService.js';
import { BookmarkedRepositoryManager } from './bookmarkedRepositoryManager.js';
import { parseWebviewMessage } from './messageValidation.js';
import { ProviderContextSync } from './providerContextSync.js';
import { ProviderFileActions } from './providerFileActions.js';
import { ProviderMessageRouter } from './providerMessageRouter.js';
import {
  buildRepositorySelectionQuickPickItems,
  createRepositorySelectionMessage,
} from './repositorySelectionPrompt.js';
import { RepositoryService } from './repositoryService.js';
import { RepositorySettingsService } from './settingsService.js';
import { getRepoStatsWebviewHtml } from './webviewHtml.js';

export class RepoStatsProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'repoStats.dashboardView';

  private panel: vscode.WebviewPanel | undefined;
  private readonly repositoryService: RepositoryService;
  private readonly analysisTargetService: AnalysisTargetService;
  private readonly settingsService: RepositorySettingsService;
  private readonly analysisService: RepoAnalysisService;
  private readonly messageRouter: ProviderMessageRouter;
  private readonly contextSync: ProviderContextSync;
  private readonly fileActions: ProviderFileActions;
  private readonly bookmarkedRepositoryManager: BookmarkedRepositoryManager;

  constructor(
    private readonly extensionUri: vscode.Uri,
    workspaceState: vscode.Memento,
    globalStoragePath: string
  ) {
    this.repositoryService = new RepositoryService(workspaceState);
    this.analysisTargetService = new AnalysisTargetService(workspaceState, this.repositoryService);
    this.settingsService = new RepositorySettingsService();
    this.analysisService = new RepoAnalysisService(
      workspaceState,
      globalStoragePath,
      this.settingsService
    );
    this.bookmarkedRepositoryManager = new BookmarkedRepositoryManager();
    this.fileActions = new ProviderFileActions({
      getSelectedTarget: () => this.analysisTargetService.getSelectedTarget(),
    });
    this.contextSync = new ProviderContextSync({
      resolveSelection: (repositoryIds, options) => this.analysisTargetService.resolveSelection(repositoryIds, options),
      getSelectedTarget: () => this.analysisTargetService.getSelectedTarget(),
      getSettings: (repository) => this.settingsService.getSettings(repository),
      getRepoScopedSettings: (repository) => this.settingsService.getRepoScopedSettings(repository),
      canUseRepoScope: (repository) => this.settingsService.canUseRepoScope(repository),
      sendStalenessStatus: (webview, target) => this.analysisService.sendStalenessStatus(webview, target),
      runAnalysis: (webview, target) => this.analysisService.runAnalysis(webview, target),
      promptReanalysis: (webview) => this.promptReanalysisForFileScopeSetting(webview),
    });
    this.messageRouter = new ProviderMessageRouter({
      runAnalysis: (webview) => this.runAnalysis(webview),
      refresh: () => this.refresh(),
      runEvolutionAnalysis: (webview, target, forceRefresh) =>
        this.analysisService.runEvolutionAnalysis(webview, target, forceRefresh),
      sendStalenessStatus: (webview, target) => this.analysisService.sendStalenessStatus(webview, target),
      getSelectedTarget: () => this.analysisTargetService.getSelectedTarget(),
      updateRepositorySelection: (repositoryIds, webview) => this.contextSync.updateRepositorySelection(repositoryIds, webview),
      openRepositoryFile: (relativePath, repositoryId) => this.fileActions.openRepositoryFile(relativePath, repositoryId),
      revealRepositoryFile: (relativePath, repositoryId) => this.fileActions.revealRepositoryFile(relativePath, repositoryId),
      copyRepositoryPath: (logicalPath, repositoryId) => this.fileActions.copyRepositoryPath(logicalPath, repositoryId),
      showPathCopiedMessage: () => {
        vscode.window.showInformationMessage('Path copied to clipboard');
      },
      sendCurrentTargetContext: (webview) => this.contextSync.sendCurrentTargetContext(webview),
      updateSettings: (settings, target) => this.updateSettings(settings, target),
      updateScopedSetting: (key, value, target) => this.updateScopedSetting(key, value, target),
      resetScopedSettingOverride: (key) => this.resetScopedSettingOverride(key),
      handlePostSettingsMutation: (webview, shouldPromptReanalysis) =>
        this.contextSync.handlePostSettingsMutation(webview, shouldPromptReanalysis),
    });
  }

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): void {
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.extensionUri],
    };

    webviewView.webview.html = this.getWebviewContent(webviewView.webview);
  }

  async showDashboard(): Promise<void> {
    if (this.panel) {
      this.panel.reveal(vscode.ViewColumn.One);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      'repoStatsDashboard',
      'Repo Stats',
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.joinPath(this.extensionUri, 'webview-ui', 'dist'),
        ],
      }
    );

    this.panel = panel;
    panel.webview.html = this.getWebviewContent(panel.webview);
    panel.webview.onDidReceiveMessage(
      (message: unknown) => this.handleWebviewMessage(message, panel.webview),
      undefined,
      []
    );
    panel.onDidDispose(() => {
      if (this.panel === panel) {
        this.panel = undefined;
      }
    });

    void this.initializePanel(panel);
  }

  async refresh(): Promise<void> {
    if (!this.panel) {
      await this.showDashboard();
      return;
    }

    const selection = await this.analysisTargetService.resolveSelection();
    if (selection.selectedTarget) {
      await this.analysisService.clearCache(selection.selectedTarget);
    }

    await this.analysisService.runAnalysis(this.panel.webview, selection.selectedTarget);
  }

  public async promptRepositorySelection(): Promise<void> {
    const selection = await this.analysisTargetService.resolveSelection();
    if (selection.repositories.length === 0) {
      const message = selection.repositoryDiscoveryWarnings.length > 0
        ? createRepositorySelectionMessage(selection.repositoryDiscoveryWarnings)
        : 'No Git repositories were found in the workspace or bookmarked list.';
      vscode.window.showWarningMessage(message);
      return;
    }

    const picked = await vscode.window.showQuickPick(
      buildRepositorySelectionQuickPickItems(selection),
      {
        canPickMany: true,
        title: 'Select Repositories',
        placeHolder: 'Choose the repositories to include in Repo Stats analysis',
      }
    );

    if (!picked) {
      return;
    }

    const repositoryIds = picked.map((item) => item.repositoryId);
    await this.analysisTargetService.persistSelectedRepositoryIds(repositoryIds);

    if (!this.panel) {
      await this.showDashboard();
      return;
    }

    await this.contextSync.updateRepositorySelection(repositoryIds, this.panel.webview);
  }

  public async addRepository(): Promise<void> {
    const addedRepositoryPath = await this.bookmarkedRepositoryManager.promptAndAddRepository();
    if (!addedRepositoryPath) {
      return;
    }

    if (!this.panel) {
      return;
    }

    const currentSelection = await this.analysisTargetService.resolveSelection();
    const selection = await this.analysisTargetService.resolveSelection(currentSelection.selectedRepositoryIds);
    await this.contextSync.sendCurrentTargetContext(this.panel.webview, selection);
    await this.analysisService.sendStalenessStatus(this.panel.webview, selection.selectedTarget);

    if (!currentSelection.selectedTarget && selection.selectedTarget) {
      await this.analysisService.runAnalysis(this.panel.webview, selection.selectedTarget);
    }
  }

  private async initializePanel(panel: vscode.WebviewPanel): Promise<void> {
    try {
      await delay(100);

      if (this.panel !== panel) {
        return;
      }

      await this.contextSync.sendCurrentTargetContext(panel.webview);
      await this.runAnalysis(panel.webview);
      await this.contextSync.sendCurrentTargetContext(panel.webview);
    } catch (error) {
      console.error('[RepoStats] Failed to initialize dashboard panel:', error);

      if (this.panel !== panel) {
        return;
      }

      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      vscode.window.showErrorMessage(`Repo Stats failed to initialize: ${errorMessage}`);
      this.sendMessage(panel.webview, {
        type: 'analysisError',
        error: errorMessage,
      });

      try {
        await this.contextSync.sendCurrentTargetContext(panel.webview);
      } catch (contextError) {
        console.error('[RepoStats] Failed to recover target context after initialization error:', contextError);
      }
    }
  }

  private async handleWebviewMessage(
    rawMessage: unknown,
    webview: vscode.Webview
  ): Promise<void> {
    try {
      const message = parseWebviewMessage(rawMessage);
      await this.messageRouter.route(message, webview);
    } catch (error) {
      console.error('[RepoStats] Failed to handle webview message:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      vscode.window.showErrorMessage(`Repo Stats error: ${errorMessage}`);
      await this.contextSync.sendCurrentTargetContext(webview);
      await this.analysisService.sendStalenessStatus(
        webview,
        await this.analysisTargetService.getSelectedTarget()
      );
    }
  }

  private async runAnalysis(webview: vscode.Webview): Promise<void> {
    const selection = await this.analysisTargetService.resolveSelection(undefined, { persist: false });
    if (!selection.selectedTarget && selection.repositoryDiscoveryWarnings.length > 0) {
      await this.contextSync.sendCurrentTargetContext(webview, selection);
      this.sendMessage(webview, {
        type: 'analysisError',
        error: createRepositorySelectionMessage(selection.repositoryDiscoveryWarnings),
      });
      return;
    }

    await this.analysisService.runAnalysis(webview, selection.selectedTarget);
  }

  private async updateSettings(
    settings: Parameters<RepositorySettingsService['updateSettings']>[1],
    target: SettingWriteTarget
  ): Promise<boolean> {
    const analysisTarget = await this.analysisTargetService.getSelectedTarget();
    if (!analysisTarget) {
      return false;
    }

    return this.settingsService.updateSettings(analysisTarget.settingsRepository, settings, target);
  }

  private async updateScopedSetting<K extends RepoScopableSettingKey>(
    key: K,
    value: RepoScopableSettingValueMap[K],
    target: SettingWriteTarget
  ): Promise<boolean> {
    const analysisTarget = await this.analysisTargetService.getSelectedTarget();
    if (!analysisTarget) {
      return false;
    }

    return this.settingsService.updateScopedSetting(analysisTarget.settingsRepository, key, value, target);
  }

  private async resetScopedSettingOverride(
    key: RepoScopableSettingKey
  ): Promise<boolean> {
    const analysisTarget = await this.analysisTargetService.getSelectedTarget();
    if (!analysisTarget) {
      return false;
    }

    return this.settingsService.resetScopedSettingOverride(analysisTarget.settingsRepository, key);
  }

  private async promptReanalysisForFileScopeSetting(webview: vscode.Webview): Promise<void> {
    const action = await vscode.window.showInformationMessage(
      'Analysis settings changed. Re-analyze to update target-based views.',
      'Re-analyze now'
    );

    if (action === 'Re-analyze now') {
      await this.runAnalysis(webview);
    }
  }

  private sendMessage(webview: vscode.Webview, message: ExtensionMessage): void {
    webview.postMessage(message);
  }

  private getWebviewContent(webview: vscode.Webview): string {
    return getRepoStatsWebviewHtml(webview, this.extensionUri);
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
