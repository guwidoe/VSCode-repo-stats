/**
 * Webview Provider - Manages the webview panel lifecycle.
 * This is the VSCode integration layer - thin wrapper around core logic.
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import {
  ExtensionMessage,
  WebviewMessage,
  ExtensionSettings,
  NotAGitRepoError,
} from '../types/index.js';
import { AnalysisCoordinator } from '../analyzers/coordinator.js';
import { CacheManager, CacheStorage } from '../cache/cacheManager.js';

// ============================================================================
// VSCode Workspace State Storage Adapter
// ============================================================================

class WorkspaceStateStorage implements CacheStorage {
  constructor(private state: vscode.Memento) {}

  get<T>(key: string): T | undefined {
    return this.state.get<T>(key);
  }

  set<T>(key: string, value: T): void {
    this.state.update(key, value);
  }
}

// ============================================================================
// Webview Provider
// ============================================================================

export class RepoStatsProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'repoStats.dashboardView';

  private panel: vscode.WebviewPanel | undefined;
  private extensionUri: vscode.Uri;
  private workspaceState: vscode.Memento;
  private globalStoragePath: string;

  constructor(
    extensionUri: vscode.Uri,
    workspaceState: vscode.Memento,
    globalStoragePath: string
  ) {
    this.extensionUri = extensionUri;
    this.workspaceState = workspaceState;
    this.globalStoragePath = globalStoragePath;
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

  /**
   * Show the dashboard in a new webview panel.
   */
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

    // Handle messages from the webview
    this.panel.webview.onDidReceiveMessage(
      (message: WebviewMessage) => this.handleWebviewMessage(message, this.panel!.webview),
      undefined,
      []
    );

    // Clean up when panel is closed
    this.panel.onDidDispose(() => {
      this.panel = undefined;
    });

    // Send settings after a brief delay to ensure webview is ready
    // Also send again after analysis in case the first one was missed
    const settings = this.getSettings();
    setTimeout(() => {
      if (this.panel) {
        console.log('[RepoStats] Sending initial settings:', settings);
        this.sendMessage(this.panel.webview, { type: 'settingsLoaded', settings });
      }
    }, 100);

    // Start analysis automatically
    await this.runAnalysis(this.panel.webview);

    // Send settings again after analysis completes (webview should definitely be ready now)
    this.sendMessage(this.panel.webview, { type: 'settingsLoaded', settings });
  }

  /**
   * Refresh the analysis (clears cache).
   */
  async refresh(): Promise<void> {
    if (!this.panel) {
      await this.showDashboard();
      return;
    }

    const repoPath = this.getWorkspacePath();
    if (repoPath) {
      const storage = new WorkspaceStateStorage(this.workspaceState);
      const cacheManager = new CacheManager(storage, repoPath);
      cacheManager.clear();
    }

    await this.runAnalysis(this.panel.webview);
  }

  private async handleWebviewMessage(message: WebviewMessage, webview: vscode.Webview): Promise<void> {
    console.log('[RepoStats] Received message from webview:', message.type);
    switch (message.type) {
      case 'requestAnalysis':
        await this.runAnalysis(webview);
        break;

      case 'requestRefresh':
        await this.refresh();
        break;

      case 'openFile': {
        const repoPath = this.getWorkspacePath();
        if (repoPath) {
          const filePath = path.join(repoPath, message.path);
          const uri = vscode.Uri.file(filePath);
          await vscode.window.showTextDocument(uri);
        }
        break;
      }

      case 'revealInExplorer': {
        const repoPath = this.getWorkspacePath();
        if (repoPath) {
          const filePath = path.join(repoPath, message.path);
          const uri = vscode.Uri.file(filePath);
          await vscode.commands.executeCommand('revealInExplorer', uri);
        }
        break;
      }

      case 'copyPath': {
        await vscode.env.clipboard.writeText(message.path);
        vscode.window.showInformationMessage('Path copied to clipboard');
        break;
      }

      case 'getSettings': {
        console.log('[RepoStats] Handling getSettings request');
        const settings = this.getSettings();
        console.log('[RepoStats] Sending settings:', settings);
        this.sendMessage(webview, { type: 'settingsLoaded', settings });
        break;
      }

      case 'updateSettings': {
        await this.updateSettings(message.settings);
        const settings = this.getSettings();
        this.sendMessage(webview, { type: 'settingsLoaded', settings });
        break;
      }
    }
  }

  private async updateSettings(settings: Partial<ExtensionSettings>): Promise<void> {
    const config = vscode.workspace.getConfiguration('repoStats');

    if (settings.excludePatterns !== undefined) {
      await config.update('excludePatterns', settings.excludePatterns, vscode.ConfigurationTarget.Global);
    }
    if (settings.maxCommitsToAnalyze !== undefined) {
      await config.update('maxCommitsToAnalyze', settings.maxCommitsToAnalyze, vscode.ConfigurationTarget.Global);
    }
    if (settings.defaultColorMode !== undefined) {
      await config.update('defaultColorMode', settings.defaultColorMode, vscode.ConfigurationTarget.Global);
    }
    if (settings.generatedPatterns !== undefined) {
      await config.update('generatedPatterns', settings.generatedPatterns, vscode.ConfigurationTarget.Global);
    }
    if (settings.binaryExtensions !== undefined) {
      await config.update('binaryExtensions', settings.binaryExtensions, vscode.ConfigurationTarget.Global);
    }
    if (settings.locExcludedExtensions !== undefined) {
      await config.update('locExcludedExtensions', settings.locExcludedExtensions, vscode.ConfigurationTarget.Global);
    }
    if (settings.showEmptyTimePeriods !== undefined) {
      await config.update('showEmptyTimePeriods', settings.showEmptyTimePeriods, vscode.ConfigurationTarget.Global);
    }
    if (settings.defaultGranularityMode !== undefined) {
      await config.update('defaultGranularityMode', settings.defaultGranularityMode, vscode.ConfigurationTarget.Global);
    }
    if (settings.autoGranularityThreshold !== undefined) {
      await config.update('autoGranularityThreshold', settings.autoGranularityThreshold, vscode.ConfigurationTarget.Global);
    }
    if (settings.overviewDisplayMode !== undefined) {
      await config.update('overviewDisplayMode', settings.overviewDisplayMode, vscode.ConfigurationTarget.Global);
    }
    if (settings.tooltipSettings !== undefined) {
      await config.update('tooltipSettings', settings.tooltipSettings, vscode.ConfigurationTarget.Global);
    }
  }

  private async runAnalysis(webview: vscode.Webview): Promise<void> {
    const repoPath = this.getWorkspacePath();

    if (!repoPath) {
      this.sendMessage(webview, {
        type: 'analysisError',
        error: 'No workspace folder is open. Please open a folder containing a Git repository.',
      });
      return;
    }

    const settings = this.getSettings();
    const storage = new WorkspaceStateStorage(this.workspaceState);
    const cacheManager = new CacheManager(storage, repoPath);
    const sccStoragePath = path.join(this.globalStoragePath, 'scc');
    const coordinator = new AnalysisCoordinator(repoPath, settings, sccStoragePath);

    try {
      // Check if we have a valid cache
      const repoInfo = await coordinator.getRepositoryInfo();
      const cached = cacheManager.getIfValid(repoInfo.headSha);

      if (cached) {
        // Update with fresh repo info
        cached.repository = repoInfo;
        this.sendMessage(webview, {
          type: 'analysisComplete',
          data: cached,
        });
        return;
      }

      // Run full analysis
      this.sendMessage(webview, { type: 'analysisStarted' });

      const result = await coordinator.analyze((phase, progress) => {
        this.sendMessage(webview, {
          type: 'analysisProgress',
          phase,
          progress,
        });
      });

      // Save to cache
      cacheManager.save(result);

      this.sendMessage(webview, {
        type: 'analysisComplete',
        data: result,
      });
    } catch (error) {
      let errorMessage = 'An unexpected error occurred during analysis.';

      if (error instanceof NotAGitRepoError) {
        errorMessage = 'This folder is not a Git repository. Please open a folder containing a Git repository.';
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }

      this.sendMessage(webview, {
        type: 'analysisError',
        error: errorMessage,
      });
    }
  }

  private sendMessage(webview: vscode.Webview, message: ExtensionMessage): void {
    webview.postMessage(message);
  }

  private getWorkspacePath(): string | undefined {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      return undefined;
    }
    return workspaceFolders[0].uri.fsPath;
  }

  private getSettings(): ExtensionSettings {
    const config = vscode.workspace.getConfiguration('repoStats');
    return {
      excludePatterns: config.get<string[]>('excludePatterns', []),
      maxCommitsToAnalyze: config.get<number>('maxCommitsToAnalyze', 10000),
      defaultColorMode: config.get<'language' | 'age' | 'complexity' | 'density'>('defaultColorMode', 'language'),
      generatedPatterns: config.get<string[]>('generatedPatterns', [
        '**/generated/**',
        '**/gen/**',
        '**/__generated__/**',
        '**/dist/**',
        '**/build/**',
        '**/*.generated.*',
        '**/*.g.ts',
        '**/*.g.js',
        '**/*.g.dart',
        '**/*.min.js',
        '**/*.min.css',
        '**/package-lock.json',
        '**/yarn.lock',
        '**/*-lock.*',
      ]),
      binaryExtensions: config.get<string[]>('binaryExtensions', [
        '.png', '.jpg', '.jpeg', '.gif', '.ico', '.webp', '.bmp', '.tiff', '.tif',
        '.psd', '.ai', '.eps', '.raw', '.cr2', '.nef', '.heic', '.avif', '.arw', '.dng', '.raf',
        '.mp4', '.webm', '.mov', '.avi', '.mkv', '.flv', '.wmv', '.m4v', '.mpeg', '.mpg',
        '.mp3', '.wav', '.ogg', '.flac', '.aac', '.wma', '.m4a', '.opus',
        '.ttf', '.otf', '.woff', '.woff2', '.eot',
        '.zip', '.tar', '.gz', '.rar', '.7z', '.bz2', '.xz', '.tgz',
        '.pyc', '.pyo', '.class', '.o', '.so', '.dll', '.exe', '.bin', '.wasm', '.a', '.lib', '.obj',
        '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
        '.sqlite', '.db', '.mdb',
        '.vhdx', '.vmdk', '.iso', '.dmg', '.deb', '.rpm', '.icns',
      ]),
      locExcludedExtensions: config.get<string[]>('locExcludedExtensions', []),
      showEmptyTimePeriods: config.get<boolean>('showEmptyTimePeriods', true),
      defaultGranularityMode: config.get<'auto' | 'weekly' | 'monthly'>('defaultGranularityMode', 'auto'),
      autoGranularityThreshold: config.get<number>('autoGranularityThreshold', 20),
      overviewDisplayMode: config.get<'percent' | 'count'>('overviewDisplayMode', 'percent'),
      tooltipSettings: config.get('tooltipSettings', {
        showLinesOfCode: true,
        showFileSize: true,
        showLanguage: true,
        showLastModified: true,
        showComplexity: false,
        showCommentLines: false,
        showCommentRatio: false,
        showBlankLines: false,
        showCodeDensity: false,
        showFileCount: true,
      }),
    };
  }

  private getWebviewContent(webview: vscode.Webview): string {
    const distPath = vscode.Uri.joinPath(this.extensionUri, 'webview-ui', 'dist');

    // Check if the dist folder exists (webview is built)
    const distFsPath = distPath.fsPath;
    const indexPath = path.join(distFsPath, 'index.html');

    if (!fs.existsSync(indexPath)) {
      // Return a placeholder if webview hasn't been built
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

    // Read the built index.html and rewrite asset paths
    let html = fs.readFileSync(indexPath, 'utf-8');

    // Get the webview URI for the dist folder
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(distPath, 'assets', 'index.js')
    );
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(distPath, 'assets', 'index.css')
    );

    // Replace asset paths with webview URIs
    // Vite outputs absolute paths like /assets/index.js with crossorigin attribute
    html = html.replace(
      /<link rel="stylesheet" crossorigin href="[./]*assets\/index\.css">/g,
      `<link rel="stylesheet" href="${styleUri}">`
    );
    html = html.replace(
      /<script type="module" crossorigin src="[./]*assets\/index\.js"><\/script>/g,
      `<script type="module" src="${scriptUri}"></script>`
    );

    // Add CSP meta tag for security
    const nonce = getNonce();
    const csp = `
      default-src 'none';
      style-src ${webview.cspSource} 'unsafe-inline';
      script-src 'nonce-${nonce}' ${webview.cspSource};
      img-src ${webview.cspSource} data:;
      font-src ${webview.cspSource};
    `.replace(/\s+/g, ' ').trim();

    // Insert CSP and nonce
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

// ============================================================================
// Utility Functions
// ============================================================================

function getNonce(): string {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
