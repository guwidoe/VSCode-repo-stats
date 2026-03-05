/**
 * Webview Provider - Manages the webview panel lifecycle.
 * This is the VSCode integration layer - thin wrapper around core logic.
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';
import simpleGit from 'simple-git';
import {
  ExtensionMessage,
  WebviewMessage,
  ExtensionSettings,
  NotAGitRepoError,
} from '../types/index.js';
import { AnalysisCoordinator } from '../analyzers/coordinator.js';
import { createEvolutionAnalyzer } from '../analyzers/evolutionAnalyzer.js';
import { CacheManager, CacheStorage } from '../cache/cacheManager.js';
import { EvolutionCacheManager } from '../cache/evolutionCacheManager.js';

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
  private lastCoreHeadSha: string | null = null;
  private lastEvolutionHeadSha: string | null = null;
  private lastEvolutionSettingsHash: string | null = null;

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
      const evolutionCacheManager = new EvolutionCacheManager(storage, repoPath);
      cacheManager.clear();
      evolutionCacheManager.clear();
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

      case 'requestEvolutionAnalysis':
        await this.runEvolutionAnalysis(webview, false);
        break;

      case 'requestEvolutionRefresh':
        await this.runEvolutionAnalysis(webview, true);
        break;

      case 'checkStaleness':
        await this.sendStalenessStatus(webview);
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
        const shouldPromptReanalysis = await this.updateSettings(message.settings);
        const settings = this.getSettings();
        this.sendMessage(webview, { type: 'settingsLoaded', settings });

        if (shouldPromptReanalysis) {
          await this.promptReanalysisForFileScopeSetting(webview);
        }
        break;
      }
    }
  }

  private async updateSettings(settings: Partial<ExtensionSettings>): Promise<boolean> {
    const config = vscode.workspace.getConfiguration('repoStats');
    let shouldPromptReanalysis = false;

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
    if (settings.includeSubmodules !== undefined) {
      const currentValue = this.getRequiredConfigValue<boolean>(config, 'includeSubmodules');
      await config.update('includeSubmodules', settings.includeSubmodules, vscode.ConfigurationTarget.Global);
      if (currentValue !== settings.includeSubmodules) {
        shouldPromptReanalysis = true;
      }
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
    if (settings.evolution !== undefined) {
      await config.update('evolution.autoRun', settings.evolution.autoRun, vscode.ConfigurationTarget.Global);
      await config.update('evolution.snapshotIntervalDays', settings.evolution.snapshotIntervalDays, vscode.ConfigurationTarget.Global);
      await config.update('evolution.maxSnapshots', settings.evolution.maxSnapshots, vscode.ConfigurationTarget.Global);
      await config.update('evolution.maxSeries', settings.evolution.maxSeries, vscode.ConfigurationTarget.Global);
      await config.update('evolution.cohortFormat', settings.evolution.cohortFormat, vscode.ConfigurationTarget.Global);
    }

    return shouldPromptReanalysis;
  }

  private async promptReanalysisForFileScopeSetting(webview: vscode.Webview): Promise<void> {
    const action = await vscode.window.showInformationMessage(
      'Include Git Submodules in File Analysis changed. Re-analyze to update Overview, Files, and Treemap.',
      'Re-analyze now'
    );

    if (action === 'Re-analyze now') {
      await this.runAnalysis(webview);
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

    try {
      const settings = this.getSettings();
      const storage = new WorkspaceStateStorage(this.workspaceState);
      const cacheManager = new CacheManager(storage, repoPath);
      const previousBlameFileCache = cacheManager.getBlameFileCache();
      const sccStoragePath = path.join(this.globalStoragePath, 'scc');
      const coordinator = new AnalysisCoordinator(
        repoPath,
        settings,
        sccStoragePath,
        undefined,
        undefined,
        previousBlameFileCache
      );

      // Check if we have a valid cache
      const repoInfo = await coordinator.getRepositoryInfo();
      const cached = cacheManager.getIfValid(repoInfo.headSha);

      if (cached) {
        // Update with fresh repo info
        cached.repository = repoInfo;
        this.lastCoreHeadSha = cached.repository.headSha;
        this.sendMessage(webview, {
          type: 'analysisComplete',
          data: cached,
        });
        await this.sendStalenessStatus(webview);
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
      cacheManager.save(result, coordinator.getLatestBlameFileCache());

      this.lastCoreHeadSha = result.repository.headSha;
      this.sendMessage(webview, {
        type: 'analysisComplete',
        data: result,
      });
      await this.sendStalenessStatus(webview);
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

  private async runEvolutionAnalysis(webview: vscode.Webview, forceRefresh: boolean): Promise<void> {
    const repoPath = this.getWorkspacePath();

    if (!repoPath) {
      this.sendMessage(webview, {
        type: 'evolutionError',
        error: 'No workspace folder is open. Please open a folder containing a Git repository.',
      });
      return;
    }

    try {
      const settings = this.getSettings();
      const storage = new WorkspaceStateStorage(this.workspaceState);
      const evolutionCacheManager = new EvolutionCacheManager(storage, repoPath);
      const coordinator = new AnalysisCoordinator(repoPath, settings, path.join(this.globalStoragePath, 'scc'));

      const repoInfo = await coordinator.getRepositoryInfo();
      const settingsHash = createEvolutionSettingsHash(settings);
      const validCached = evolutionCacheManager.getIfValid(
        repoInfo.headSha,
        repoInfo.branch,
        settingsHash
      );

      if (validCached && !forceRefresh) {
        this.lastEvolutionHeadSha = validCached.headSha;
        this.lastEvolutionSettingsHash = validCached.settingsHash;
        this.sendMessage(webview, {
          type: 'evolutionComplete',
          data: validCached,
        });
        await this.sendStalenessStatus(webview);
        return;
      }

      if (!forceRefresh) {
        const latestCached = evolutionCacheManager.getLatest();
        if (latestCached) {
          this.lastEvolutionHeadSha = latestCached.headSha;
          this.lastEvolutionSettingsHash = latestCached.settingsHash;
          this.sendMessage(webview, {
            type: 'evolutionComplete',
            data: latestCached,
          });

          if (
            latestCached.headSha !== repoInfo.headSha ||
            latestCached.branch !== repoInfo.branch ||
            latestCached.settingsHash !== settingsHash
          ) {
            this.sendMessage(webview, {
              type: 'evolutionStale',
              reason: 'Repository HEAD or Evolution settings changed since the last run.',
            });
          }

          await this.sendStalenessStatus(webview);

          if (!settings.evolution.autoRun) {
            return;
          }
        } else if (!settings.evolution.autoRun) {
          return;
        }
      }

      this.sendMessage(webview, { type: 'evolutionStarted' });

      const analyzer = createEvolutionAnalyzer(repoPath, settings);
      const result = await analyzer.analyze((phase, progress) => {
        this.sendMessage(webview, {
          type: 'evolutionProgress',
          phase,
          progress,
        });
      });

      evolutionCacheManager.save(result, repoPath);

      this.lastEvolutionHeadSha = result.headSha;
      this.lastEvolutionSettingsHash = result.settingsHash;
      this.sendMessage(webview, {
        type: 'evolutionComplete',
        data: result,
      });
      await this.sendStalenessStatus(webview);
    } catch (error) {
      let errorMessage = 'An unexpected error occurred during evolution analysis.';

      if (error instanceof NotAGitRepoError) {
        errorMessage = 'This folder is not a Git repository. Please open a folder containing a Git repository.';
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }

      this.sendMessage(webview, {
        type: 'evolutionError',
        error: errorMessage,
      });
    }
  }

  private async sendStalenessStatus(webview: vscode.Webview): Promise<void> {
    const repoPath = this.getWorkspacePath();
    if (!repoPath) {
      this.sendMessage(webview, {
        type: 'stalenessStatus',
        coreStale: false,
        evolutionStale: false,
      });
      return;
    }

    try {
      const git = simpleGit(repoPath);
      const currentHeadSha = (await git.revparse(['HEAD'])).trim();
      const currentSettingsHash = createEvolutionSettingsHash(this.getSettings());

      const coreStale = this.lastCoreHeadSha !== null && this.lastCoreHeadSha !== currentHeadSha;

      const evolutionStaleByHead = this.lastEvolutionHeadSha !== null && this.lastEvolutionHeadSha !== currentHeadSha;
      const evolutionStaleBySettings =
        this.lastEvolutionSettingsHash !== null &&
        this.lastEvolutionSettingsHash !== currentSettingsHash;

      this.sendMessage(webview, {
        type: 'stalenessStatus',
        coreStale,
        evolutionStale: evolutionStaleByHead || evolutionStaleBySettings,
      });
    } catch (error) {
      console.error('[RepoStats] Failed to compute staleness status:', error);
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

  private getRequiredConfigValue<T>(config: vscode.WorkspaceConfiguration, key: string): T {
    const value = config.get<T>(key);
    if (value === undefined) {
      throw new Error(
        `Missing required configuration value: repoStats.${key}. ` +
        'Check package.json contributes.configuration defaults and user/workspace settings.'
      );
    }
    return value;
  }

  private getSettings(): ExtensionSettings {
    const config = vscode.workspace.getConfiguration('repoStats');

    return {
      excludePatterns: this.getRequiredConfigValue<string[]>(config, 'excludePatterns'),
      maxCommitsToAnalyze: this.getRequiredConfigValue<number>(config, 'maxCommitsToAnalyze'),
      defaultColorMode: this.getRequiredConfigValue<'language' | 'age' | 'complexity' | 'density'>(config, 'defaultColorMode'),
      generatedPatterns: this.getRequiredConfigValue<string[]>(config, 'generatedPatterns'),
      binaryExtensions: this.getRequiredConfigValue<string[]>(config, 'binaryExtensions'),
      locExcludedExtensions: this.getRequiredConfigValue<string[]>(config, 'locExcludedExtensions'),
      includeSubmodules: this.getRequiredConfigValue<boolean>(config, 'includeSubmodules'),
      showEmptyTimePeriods: this.getRequiredConfigValue<boolean>(config, 'showEmptyTimePeriods'),
      defaultGranularityMode: this.getRequiredConfigValue<'auto' | 'weekly' | 'monthly'>(config, 'defaultGranularityMode'),
      autoGranularityThreshold: this.getRequiredConfigValue<number>(config, 'autoGranularityThreshold'),
      overviewDisplayMode: this.getRequiredConfigValue<'percent' | 'count'>(config, 'overviewDisplayMode'),
      tooltipSettings: this.getRequiredConfigValue<ExtensionSettings['tooltipSettings']>(config, 'tooltipSettings'),
      evolution: {
        autoRun: this.getRequiredConfigValue<boolean>(config, 'evolution.autoRun'),
        snapshotIntervalDays: this.getRequiredConfigValue<number>(config, 'evolution.snapshotIntervalDays'),
        maxSnapshots: this.getRequiredConfigValue<number>(config, 'evolution.maxSnapshots'),
        maxSeries: this.getRequiredConfigValue<number>(config, 'evolution.maxSeries'),
        cohortFormat: this.getRequiredConfigValue<string>(config, 'evolution.cohortFormat'),
      },
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

function createEvolutionSettingsHash(settings: ExtensionSettings): string {
  const payload = JSON.stringify({
    excludePatterns: settings.excludePatterns,
    binaryExtensions: settings.binaryExtensions,
    evolution: settings.evolution,
  });
  return crypto.createHash('sha1').update(payload).digest('hex').slice(0, 16);
}

function getNonce(): string {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
