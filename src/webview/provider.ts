/**
 * Webview Provider - Manages the webview panel lifecycle.
 * This is the VSCode integration layer - thin wrapper around core logic.
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import simpleGit from 'simple-git';
import {
  ExtensionMessage,
  RepoScopableSettingKey,
  RepoScopableSettingValueMap,
  SettingWriteTarget,
  WebviewMessage,
} from '../types/index.js';
import type { AnalysisTargetSelection } from './context.js';
import { RepoAnalysisService } from './analysisService.js';
import { AnalysisTargetService } from './analysisTargetService.js';
import { RepositoryService } from './repositoryService.js';
import { RepositorySettingsService } from './settingsService.js';

export class RepoStatsProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'repoStats.dashboardView';

  private panel: vscode.WebviewPanel | undefined;
  private readonly repositoryService: RepositoryService;
  private readonly analysisTargetService: AnalysisTargetService;
  private readonly settingsService: RepositorySettingsService;
  private readonly analysisService: RepoAnalysisService;

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
      (message: WebviewMessage) => this.handleWebviewMessage(message, panel.webview),
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
      this.analysisService.clearCache(selection.selectedTarget);
    }

    await this.analysisService.runAnalysis(this.panel.webview, selection.selectedTarget ?? undefined);
  }

  public async promptRepositorySelection(): Promise<void> {
    const selection = await this.analysisTargetService.resolveSelection();
    if (selection.repositories.length === 0) {
      vscode.window.showInformationMessage('No Git repositories were found in the workspace or bookmarked list.');
      return;
    }

    const selectedIds = new Set(selection.selectedRepositoryIds);
    const picked = await vscode.window.showQuickPick(
      selection.repositories.map((repository) => ({
        label: repository.option.name,
        description: repository.option.workspaceFolderName
          ? `${repository.option.workspaceFolderName} • ${repository.option.relativePath ?? '.'}`
          : 'Bookmarked repository',
        detail: repository.rootUri.fsPath,
        picked: selectedIds.has(repository.option.path),
        repositoryId: repository.option.path,
      })),
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

    await this.updateRepositorySelection(repositoryIds, this.panel.webview);
  }

  public async addRepository(): Promise<void> {
    const pickedUris = await vscode.window.showOpenDialog({
      canSelectFiles: false,
      canSelectFolders: true,
      canSelectMany: false,
      openLabel: 'Add Repository',
      title: 'Select a Git repository to bookmark',
    });

    const pickedUri = pickedUris?.[0];
    if (!pickedUri) {
      return;
    }

    const git = simpleGit(pickedUri.fsPath);
    const isGitRepo = await git.checkIsRepo();
    if (!isGitRepo) {
      vscode.window.showErrorMessage(`Selected folder is not a Git repository: ${pickedUri.fsPath}`);
      return;
    }

    const repositoryRootPath = (await git.revparse(['--show-toplevel'])).trim();
    if (repositoryRootPath.length === 0) {
      vscode.window.showErrorMessage(`Could not determine the Git repository root for: ${pickedUri.fsPath}`);
      return;
    }

    const bookmarkedRepositories = this.getConfiguredBookmarkedRepositories();
    if (bookmarkedRepositories.includes(repositoryRootPath)) {
      vscode.window.showInformationMessage(`Repository already bookmarked: ${repositoryRootPath}`);
      return;
    }

    await vscode.workspace
      .getConfiguration('repoStats')
      .update('bookmarkedRepositories', [...bookmarkedRepositories, repositoryRootPath], vscode.ConfigurationTarget.Global);

    vscode.window.showInformationMessage(`Added bookmarked repository: ${repositoryRootPath}`);

    if (!this.panel) {
      return;
    }

    const currentSelection = await this.analysisTargetService.resolveSelection();
    const selection = await this.analysisTargetService.resolveSelection(currentSelection.selectedRepositoryIds);
    await this.sendCurrentTargetContext(this.panel.webview, selection);
    await this.analysisService.sendStalenessStatus(this.panel.webview, selection.selectedTarget ?? undefined);

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

      console.log('[RepoStats] Initializing dashboard panel');
      await this.sendCurrentTargetContext(panel.webview);
      await this.runAnalysis(panel.webview);
      await this.sendCurrentTargetContext(panel.webview);
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
        await this.sendCurrentTargetContext(panel.webview);
      } catch (contextError) {
        console.error('[RepoStats] Failed to recover target context after initialization error:', contextError);
      }
    }
  }

  private async handleWebviewMessage(
    message: WebviewMessage,
    webview: vscode.Webview
  ): Promise<void> {
    console.log('[RepoStats] Received message from webview:', message.type);

    try {
      switch (message.type) {
        case 'requestAnalysis':
          await this.runAnalysis(webview);
          break;

        case 'requestRefresh':
          await this.refresh();
          break;

        case 'requestEvolutionAnalysis':
          await this.analysisService.runEvolutionAnalysis(
            webview,
            await this.analysisTargetService.getSelectedTarget(),
            false
          );
          break;

        case 'requestEvolutionRefresh':
          await this.analysisService.runEvolutionAnalysis(
            webview,
            await this.analysisTargetService.getSelectedTarget(),
            true
          );
          break;

        case 'checkStaleness':
          await this.analysisService.sendStalenessStatus(
            webview,
            await this.analysisTargetService.getSelectedTarget()
          );
          break;

        case 'updateRepositorySelection':
          await this.updateRepositorySelection(message.repositoryIds, webview);
          break;

        case 'openFile':
          await this.openRepositoryFile(message.path, message.repositoryId);
          break;

        case 'revealInExplorer':
          await this.revealRepositoryFile(message.path, message.repositoryId);
          break;

        case 'copyPath':
          await vscode.env.clipboard.writeText(message.path);
          vscode.window.showInformationMessage('Path copied to clipboard');
          break;

        case 'getSettings':
          console.log('[RepoStats] Handling getSettings request');
          await this.sendCurrentTargetContext(webview);
          break;

        case 'updateSettings': {
          const shouldPromptReanalysis = await this.updateSettings(
            message.settings,
            message.target ?? 'global'
          );
          await this.sendCurrentTargetContext(webview);
          await this.analysisService.sendStalenessStatus(
            webview,
            await this.analysisTargetService.getSelectedTarget()
          );

          if (shouldPromptReanalysis) {
            await this.promptReanalysisForFileScopeSetting(webview);
          }
          break;
        }

        case 'updateScopedSetting': {
          const shouldPromptReanalysis = await this.updateScopedSetting(
            message.key,
            message.value,
            message.target
          );
          await this.sendCurrentTargetContext(webview);
          await this.analysisService.sendStalenessStatus(
            webview,
            await this.analysisTargetService.getSelectedTarget()
          );

          if (shouldPromptReanalysis) {
            await this.promptReanalysisForFileScopeSetting(webview);
          }
          break;
        }

        case 'resetScopedSetting': {
          const shouldPromptReanalysis = await this.resetScopedSettingOverride(message.key);
          await this.sendCurrentTargetContext(webview);
          await this.analysisService.sendStalenessStatus(
            webview,
            await this.analysisTargetService.getSelectedTarget()
          );

          if (shouldPromptReanalysis) {
            await this.promptReanalysisForFileScopeSetting(webview);
          }
          break;
        }
      }
    } catch (error) {
      console.error('[RepoStats] Failed to handle webview message:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      vscode.window.showErrorMessage(`Repo Stats error: ${errorMessage}`);
      await this.sendCurrentTargetContext(webview);
      await this.analysisService.sendStalenessStatus(
        webview,
        await this.analysisTargetService.getSelectedTarget()
      );
    }
  }

  private getConfiguredBookmarkedRepositories(): string[] {
    const configured = vscode.workspace
      .getConfiguration('repoStats')
      .get<unknown>('bookmarkedRepositories');

    if (!Array.isArray(configured)) {
      return [];
    }

    return configured.filter((value): value is string => typeof value === 'string' && value.trim().length > 0);
  }

  private async runAnalysis(webview: vscode.Webview): Promise<void> {
    await this.analysisService.runAnalysis(
      webview,
      await this.analysisTargetService.getSelectedTarget()
    );
  }

  private async updateRepositorySelection(
    repositoryIds: string[],
    webview: vscode.Webview
  ): Promise<void> {
    const selection = await this.analysisTargetService.resolveSelection(repositoryIds);
    await this.sendCurrentTargetContext(webview, selection);
    await this.analysisService.sendStalenessStatus(webview, selection.selectedTarget ?? undefined);
    await this.analysisService.runAnalysis(webview, selection.selectedTarget ?? undefined);
  }

  private async sendCurrentTargetContext(
    webview: vscode.Webview,
    selection?: AnalysisTargetSelection
  ): Promise<AnalysisTargetSelection> {
    const resolved = selection ?? await this.analysisTargetService.resolveSelection();

    this.sendMessage(webview, {
      type: 'repositorySelectionLoaded',
      repositories: resolved.repositories.map((repository) => repository.option),
      selectedRepositoryIds: resolved.selectedRepositoryIds,
      selectedTarget: resolved.selectedTargetOption,
    });

    this.sendMessage(webview, {
      type: 'settingsLoaded',
      settings: this.settingsService.getSettings(resolved.selectedTarget?.settingsRepository),
      scopedSettings: this.settingsService.getRepoScopedSettings(resolved.selectedTarget?.settingsRepository),
      repoScopeAvailable: this.settingsService.canUseRepoScope(resolved.selectedTarget?.settingsRepository),
    });

    return resolved;
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

  private async openRepositoryFile(relativePath: string, repositoryId?: string): Promise<void> {
    const filePath = await this.resolveTargetFilePath(relativePath, repositoryId);
    if (!filePath) {
      return;
    }

    await vscode.window.showTextDocument(vscode.Uri.file(filePath));
  }

  private async revealRepositoryFile(relativePath: string, repositoryId?: string): Promise<void> {
    const filePath = await this.resolveTargetFilePath(relativePath, repositoryId);
    if (!filePath) {
      return;
    }

    await vscode.commands.executeCommand('revealInExplorer', vscode.Uri.file(filePath));
  }

  private async resolveTargetFilePath(
    logicalPath: string,
    repositoryId?: string
  ): Promise<string | undefined> {
    const analysisTarget = await this.analysisTargetService.getSelectedTarget();
    if (!analysisTarget) {
      return undefined;
    }

    const matchingMember = repositoryId
      ? analysisTarget.target.members.find((member) => member.id === repositoryId)
      : [...analysisTarget.target.members]
        .sort((a, b) => b.pathPrefix.length - a.pathPrefix.length)
        .find((member) => {
          if (!member.pathPrefix) {
            return true;
          }

          return logicalPath === member.pathPrefix || logicalPath.startsWith(`${member.pathPrefix}/`);
        });

    if (!matchingMember) {
      return undefined;
    }

    const relativePath = matchingMember.pathPrefix && logicalPath.startsWith(`${matchingMember.pathPrefix}/`)
      ? logicalPath.slice(matchingMember.pathPrefix.length + 1)
      : matchingMember.pathPrefix === logicalPath
        ? ''
        : logicalPath;

    return path.join(matchingMember.repoPath, relativePath);
  }

  private sendMessage(webview: vscode.Webview, message: ExtensionMessage): void {
    webview.postMessage(message);
  }

  private getWebviewContent(webview: vscode.Webview): string {
    const distPath = vscode.Uri.joinPath(this.extensionUri, 'webview-ui', 'dist');
    const distFsPath = distPath.fsPath;
    const indexPath = path.join(distFsPath, 'index.html');

    if (!fs.existsSync(indexPath)) {
      return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Repo Stats</title>
  <style>
    body {
      font-family: var(--vscode-font-family);
      padding: 20px;
      color: var(--vscode-foreground);
      background: var(--vscode-editor-background);
    }
    .error {
      color: var(--vscode-errorForeground);
    }
  </style>
</head>
<body>
  <h1>Repo Stats</h1>
  <p class="error">The webview UI has not been built yet. Run <code>npm run compile:webview</code> to build it.</p>
</body>
</html>`;
    }

    let html = fs.readFileSync(indexPath, 'utf-8');

    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(distPath, 'assets', 'index.js')
    );
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(distPath, 'assets', 'index.css')
    );

    html = html.replace(
      /<link rel="stylesheet" crossorigin href="[./]*assets\/index\.css">/g,
      `<link rel="stylesheet" href="${styleUri}">`
    );
    html = html.replace(
      /<script type="module" crossorigin src="[./]*assets\/index\.js"><\/script>/g,
      `<script type="module" src="${scriptUri}"></script>`
    );

    const nonce = getNonce();
    const csp = `
      default-src 'none';
      style-src ${webview.cspSource} 'unsafe-inline';
      script-src 'nonce-${nonce}' ${webview.cspSource};
      img-src ${webview.cspSource} data:;
      font-src ${webview.cspSource};
    `.replace(/\s+/g, ' ').trim();

    html = html.replace(
      '<head>',
      `<head>\n    <meta http-equiv="Content-Security-Policy" content="${csp}">`
    );
    html = html.replace(
      /<script/g,
      `<script nonce="${nonce}"`
    );

    return html;
  }
}

function getNonce(): string {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
