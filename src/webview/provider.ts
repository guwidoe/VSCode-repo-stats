/**
 * Webview Provider - Manages the webview panel lifecycle.
 * This is the VSCode integration layer - thin wrapper around core logic.
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import {
  ExtensionMessage,
  RepoScopableSettingKey,
  RepoScopableSettingValueMap,
  SettingWriteTarget,
  WebviewMessage,
} from '../types/index.js';
import type { RepositorySelection } from './context.js';
import { RepoAnalysisService } from './analysisService.js';
import { RepositoryService } from './repositoryService.js';
import { RepositorySettingsService } from './settingsService.js';

export class RepoStatsProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'repoStats.dashboardView';

  private panel: vscode.WebviewPanel | undefined;
  private readonly repositoryService: RepositoryService;
  private readonly settingsService: RepositorySettingsService;
  private readonly analysisService: RepoAnalysisService;

  constructor(
    private readonly extensionUri: vscode.Uri,
    workspaceState: vscode.Memento,
    globalStoragePath: string
  ) {
    this.repositoryService = new RepositoryService(workspaceState);
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

    this.panel = vscode.window.createWebviewPanel(
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

    this.panel.webview.html = this.getWebviewContent(this.panel.webview);
    this.panel.webview.onDidReceiveMessage(
      (message: WebviewMessage) => this.handleWebviewMessage(message, this.panel!.webview),
      undefined,
      []
    );
    this.panel.onDidDispose(() => {
      this.panel = undefined;
    });

    setTimeout(() => {
      if (this.panel) {
        console.log('[RepoStats] Sending initial repository context');
        void this.sendCurrentRepositoryContext(this.panel.webview);
      }
    }, 100);

    await this.runAnalysis(this.panel.webview);
    await this.sendCurrentRepositoryContext(this.panel.webview);
  }

  async refresh(): Promise<void> {
    if (!this.panel) {
      await this.showDashboard();
      return;
    }

    const selection = await this.repositoryService.resolveSelection();
    if (selection.selected) {
      this.analysisService.clearCache(selection.selected);
    }

    await this.analysisService.runAnalysis(this.panel.webview, selection.selected ?? undefined);
  }

  public async promptRepositorySelection(): Promise<void> {
    const selection = await this.repositoryService.resolveSelection();
    if (selection.repositories.length === 0) {
      vscode.window.showInformationMessage('No Git repositories were found in the current workspace.');
      return;
    }

    const picked = await vscode.window.showQuickPick(
      selection.repositories.map((repository) => ({
        label: repository.option.name,
        description:
          repository.option.relativePath === '.'
            ? repository.option.workspaceFolderName
            : `${repository.option.workspaceFolderName}/${repository.option.relativePath}`,
        detail: repository.option.path,
        repository,
      })),
      {
        title: 'Select Repository',
        placeHolder: 'Choose the repository to analyze in Repo Stats',
      }
    );

    if (!picked) {
      return;
    }

    await this.repositoryService.persistSelectedRepoPath(picked.repository.option.path);

    if (!this.panel) {
      await this.showDashboard();
      return;
    }

    await this.selectRepository(picked.repository.option.path, this.panel.webview);
  }

  private async handleWebviewMessage(
    message: WebviewMessage,
    webview: vscode.Webview
  ): Promise<void> {
    console.log('[RepoStats] Received message from webview:', message.type);

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
          await this.repositoryService.getSelectedRepository(),
          false
        );
        break;

      case 'requestEvolutionRefresh':
        await this.analysisService.runEvolutionAnalysis(
          webview,
          await this.repositoryService.getSelectedRepository(),
          true
        );
        break;

      case 'checkStaleness':
        await this.analysisService.sendStalenessStatus(
          webview,
          await this.repositoryService.getSelectedRepository()
        );
        break;

      case 'selectRepository':
        await this.selectRepository(message.repoPath, webview);
        break;

      case 'openFile':
        await this.openRepositoryFile(message.path);
        break;

      case 'revealInExplorer':
        await this.revealRepositoryFile(message.path);
        break;

      case 'copyPath':
        await vscode.env.clipboard.writeText(message.path);
        vscode.window.showInformationMessage('Path copied to clipboard');
        break;

      case 'getSettings':
        console.log('[RepoStats] Handling getSettings request');
        await this.sendCurrentRepositoryContext(webview);
        break;

      case 'updateSettings': {
        const shouldPromptReanalysis = await this.updateSettings(
          message.settings,
          message.target ?? 'global'
        );
        await this.sendCurrentRepositoryContext(webview);
        await this.analysisService.sendStalenessStatus(
          webview,
          await this.repositoryService.getSelectedRepository()
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
        await this.sendCurrentRepositoryContext(webview);
        await this.analysisService.sendStalenessStatus(
          webview,
          await this.repositoryService.getSelectedRepository()
        );

        if (shouldPromptReanalysis) {
          await this.promptReanalysisForFileScopeSetting(webview);
        }
        break;
      }

      case 'resetScopedSetting': {
        const shouldPromptReanalysis = await this.resetScopedSettingOverride(message.key);
        await this.sendCurrentRepositoryContext(webview);
        await this.analysisService.sendStalenessStatus(
          webview,
          await this.repositoryService.getSelectedRepository()
        );

        if (shouldPromptReanalysis) {
          await this.promptReanalysisForFileScopeSetting(webview);
        }
        break;
      }
    }
  }

  private async runAnalysis(webview: vscode.Webview): Promise<void> {
    await this.analysisService.runAnalysis(
      webview,
      await this.repositoryService.getSelectedRepository()
    );
  }

  private async selectRepository(repoPath: string, webview: vscode.Webview): Promise<void> {
    const selection = await this.repositoryService.resolveSelection(repoPath);
    await this.sendCurrentRepositoryContext(webview, selection);
    await this.analysisService.sendStalenessStatus(webview, selection.selected ?? undefined);
    await this.analysisService.runAnalysis(webview, selection.selected ?? undefined);
  }

  private async sendCurrentRepositoryContext(
    webview: vscode.Webview,
    selection?: RepositorySelection
  ): Promise<RepositorySelection> {
    const resolved = selection ?? await this.repositoryService.resolveSelection();

    this.sendMessage(webview, {
      type: 'repositorySelectionLoaded',
      repositories: resolved.repositories.map((repository) => repository.option),
      selectedRepoPath: resolved.selected?.option.path ?? null,
    });

    if (resolved.selected) {
      this.sendMessage(webview, {
        type: 'settingsLoaded',
        settings: this.settingsService.getSettings(resolved.selected),
        scopedSettings: this.settingsService.getRepoScopedSettings(resolved.selected),
      });
    }

    return resolved;
  }

  private async updateSettings(
    settings: Parameters<RepositorySettingsService['updateSettings']>[1],
    target: SettingWriteTarget
  ): Promise<boolean> {
    const repository = await this.repositoryService.getSelectedRepository();
    if (!repository) {
      return false;
    }

    return this.settingsService.updateSettings(repository, settings, target);
  }

  private async updateScopedSetting<K extends RepoScopableSettingKey>(
    key: K,
    value: RepoScopableSettingValueMap[K],
    target: SettingWriteTarget
  ): Promise<boolean> {
    const repository = await this.repositoryService.getSelectedRepository();
    if (!repository) {
      return false;
    }

    return this.settingsService.updateScopedSetting(repository, key, value, target);
  }

  private async resetScopedSettingOverride(
    key: RepoScopableSettingKey
  ): Promise<boolean> {
    const repository = await this.repositoryService.getSelectedRepository();
    if (!repository) {
      return false;
    }

    return this.settingsService.resetScopedSettingOverride(repository, key);
  }

  private async promptReanalysisForFileScopeSetting(webview: vscode.Webview): Promise<void> {
    const action = await vscode.window.showInformationMessage(
      'Analysis settings changed. Re-analyze to update repository-based views.',
      'Re-analyze now'
    );

    if (action === 'Re-analyze now') {
      await this.runAnalysis(webview);
    }
  }

  private async openRepositoryFile(relativePath: string): Promise<void> {
    const repository = await this.repositoryService.getSelectedRepository();
    if (!repository) {
      return;
    }

    const filePath = path.join(repository.rootUri.fsPath, relativePath);
    await vscode.window.showTextDocument(vscode.Uri.file(filePath));
  }

  private async revealRepositoryFile(relativePath: string): Promise<void> {
    const repository = await this.repositoryService.getSelectedRepository();
    if (!repository) {
      return;
    }

    const filePath = path.join(repository.rootUri.fsPath, relativePath);
    await vscode.commands.executeCommand('revealInExplorer', vscode.Uri.file(filePath));
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
