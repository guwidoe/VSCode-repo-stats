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
  RepoScopableSettingKey,
  RepoScopableSettingValueMap,
  RepoScopedSettings,
  RepositoryOption,
  SettingWriteTarget,
} from '../types/index.js';
import { AnalysisCoordinator } from '../analyzers/coordinator.js';
import { createEvolutionAnalyzer } from '../analyzers/evolutionAnalyzer.js';
import { CacheManager, CacheStorage } from '../cache/cacheManager.js';
import { EvolutionCacheManager } from '../cache/evolutionCacheManager.js';
import { createCoreSettingsHash } from '../cache/coreSettingsHash.js';
import { buildScopedSettingValue } from './scopedSettings.js';
import {
  createEvolutionAnalysisSettingsSnapshot,
  flattenSettingsUpdate,
  settingsAffectCoreAnalysis,
} from '../shared/settings.js';
import {
  buildRepositoryOption,
  selectPreferredRepositoryPath,
} from './repositorySelection.js';

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

interface GitRepositoryHandle {
  rootUri: vscode.Uri;
}

interface GitApi {
  repositories: GitRepositoryHandle[];
}

interface GitExtensionExports {
  getAPI(version: number): GitApi;
}

interface RepositoryContext {
  option: RepositoryOption;
  rootUri: vscode.Uri;
  workspaceFolder: vscode.WorkspaceFolder;
}

interface RepositorySelection {
  repositories: RepositoryContext[];
  selected: RepositoryContext | null;
}

// ============================================================================
// Webview Provider
// ============================================================================

export class RepoStatsProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'repoStats.dashboardView';

  private static readonly selectedRepoPathStateKey = 'repoStats.selectedRepoPath';

  private panel: vscode.WebviewPanel | undefined;
  private extensionUri: vscode.Uri;
  private workspaceState: vscode.Memento;
  private globalStoragePath: string;
  private lastCoreStateByRepo = new Map<string, { headSha: string; settingsHash: string }>();
  private lastEvolutionStateByRepo = new Map<string, { headSha: string; settingsHash: string }>();

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

    // Send repository context after a brief delay to ensure webview is ready.
    setTimeout(() => {
      if (this.panel) {
        console.log('[RepoStats] Sending initial repository context');
        void this.sendCurrentRepositoryContext(this.panel.webview);
      }
    }, 100);

    // Start analysis automatically
    await this.runAnalysis(this.panel.webview);

    // Send context again after analysis completes (webview should definitely be ready now)
    await this.sendCurrentRepositoryContext(this.panel.webview);
  }

  /**
   * Refresh the analysis (clears cache).
   */
  async refresh(): Promise<void> {
    if (!this.panel) {
      await this.showDashboard();
      return;
    }

    const selection = await this.resolveRepositorySelection();
    if (selection.selected) {
      const storage = new WorkspaceStateStorage(this.workspaceState);
      const cacheManager = new CacheManager(storage, selection.selected.rootUri.fsPath);
      const evolutionCacheManager = new EvolutionCacheManager(storage, selection.selected.rootUri.fsPath);
      cacheManager.clear();
      evolutionCacheManager.clear();
    }

    await this.runAnalysis(this.panel.webview, selection.selected ?? undefined);
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

      case 'selectRepository': {
        await this.selectRepository(message.repoPath, webview);
        break;
      }

      case 'openFile': {
        const repository = await this.getSelectedRepository();
        if (repository) {
          const filePath = path.join(repository.rootUri.fsPath, message.path);
          const uri = vscode.Uri.file(filePath);
          await vscode.window.showTextDocument(uri);
        }
        break;
      }

      case 'revealInExplorer': {
        const repository = await this.getSelectedRepository();
        if (repository) {
          const filePath = path.join(repository.rootUri.fsPath, message.path);
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
        await this.sendCurrentRepositoryContext(webview);
        break;
      }

      case 'updateSettings': {
        const shouldPromptReanalysis = await this.updateSettings(
          message.settings,
          message.target ?? 'global'
        );
        await this.sendCurrentRepositoryContext(webview);
        await this.sendStalenessStatus(webview);

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
        await this.sendStalenessStatus(webview);

        if (shouldPromptReanalysis) {
          await this.promptReanalysisForFileScopeSetting(webview);
        }
        break;
      }

      case 'resetScopedSetting': {
        const shouldPromptReanalysis = await this.resetScopedSettingOverride(message.key);
        await this.sendCurrentRepositoryContext(webview);
        await this.sendStalenessStatus(webview);

        if (shouldPromptReanalysis) {
          await this.promptReanalysisForFileScopeSetting(webview);
        }
        break;
      }
    }
  }

  public async promptRepositorySelection(): Promise<void> {
    const selection = await this.resolveRepositorySelection();
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

    await this.persistSelectedRepoPath(picked.repository.option.path);

    if (!this.panel) {
      await this.showDashboard();
      return;
    }

    await this.selectRepository(picked.repository.option.path, this.panel.webview);
  }

  private async selectRepository(repoPath: string, webview: vscode.Webview): Promise<void> {
    const selection = await this.resolveRepositorySelection(repoPath);
    await this.sendCurrentRepositoryContext(webview, selection);
    await this.sendStalenessStatus(webview, selection.selected ?? undefined);
    await this.runAnalysis(webview, selection.selected ?? undefined);
  }

  private async sendCurrentRepositoryContext(
    webview: vscode.Webview,
    selection?: RepositorySelection
  ): Promise<RepositorySelection> {
    const resolved = selection ?? await this.resolveRepositorySelection();

    this.sendMessage(webview, {
      type: 'repositorySelectionLoaded',
      repositories: resolved.repositories.map((repository) => repository.option),
      selectedRepoPath: resolved.selected?.option.path ?? null,
    });

    if (resolved.selected) {
      this.sendMessage(webview, {
        type: 'settingsLoaded',
        settings: this.getSettings(resolved.selected),
        scopedSettings: this.getRepoScopedSettings(resolved.selected),
      });
    }

    return resolved;
  }

  private async getSelectedRepository(): Promise<RepositoryContext | undefined> {
    const selection = await this.resolveRepositorySelection();
    return selection.selected ?? undefined;
  }

  private async resolveRepositorySelection(preferredRepoPath?: string): Promise<RepositorySelection> {
    const repositories = await this.listAvailableRepositories();
    const persistedRepoPath = preferredRepoPath ?? this.workspaceState.get<string>(RepoStatsProvider.selectedRepoPathStateKey);
    const selectedRepoPath = selectPreferredRepositoryPath(
      repositories.map((repository) => repository.option),
      persistedRepoPath
    );

    await this.persistSelectedRepoPath(selectedRepoPath);

    return {
      repositories,
      selected: repositories.find((repository) => repository.option.path === selectedRepoPath) ?? null,
    };
  }

  private async persistSelectedRepoPath(repoPath: string | null): Promise<void> {
    await this.workspaceState.update(RepoStatsProvider.selectedRepoPathStateKey, repoPath ?? undefined);
  }

  private async listAvailableRepositories(): Promise<RepositoryContext[]> {
    const workspaceFolders = vscode.workspace.workspaceFolders ?? [];
    if (workspaceFolders.length === 0) {
      return [];
    }

    const repositoryRoots = await this.getRepositoryRootUris(workspaceFolders);

    return repositoryRoots
      .map((rootUri) => {
        const workspaceFolder = vscode.workspace.getWorkspaceFolder(rootUri);
        if (!workspaceFolder) {
          return null;
        }

        return {
          option: buildRepositoryOption({
            repoPath: rootUri.fsPath,
            workspaceFolderPath: workspaceFolder.uri.fsPath,
            workspaceFolderName: workspaceFolder.name,
          }),
          rootUri,
          workspaceFolder,
        } satisfies RepositoryContext;
      })
      .filter((repository): repository is RepositoryContext => repository !== null)
      .sort((a, b) =>
        a.option.workspaceFolderName.localeCompare(b.option.workspaceFolderName) ||
        a.option.relativePath.localeCompare(b.option.relativePath) ||
        a.option.name.localeCompare(b.option.name)
      );
  }

  private async getRepositoryRootUris(workspaceFolders: readonly vscode.WorkspaceFolder[]): Promise<vscode.Uri[]> {
    const seen = new Set<string>();
    const repositories: vscode.Uri[] = [];

    const gitExtension = vscode.extensions.getExtension<GitExtensionExports>('vscode.git');
    if (gitExtension) {
      const gitApi = (gitExtension.isActive ? gitExtension.exports : await gitExtension.activate()) as GitExtensionExports;
      try {
        for (const repository of gitApi.getAPI(1).repositories) {
          const workspaceFolder = vscode.workspace.getWorkspaceFolder(repository.rootUri);
          if (!workspaceFolder || seen.has(repository.rootUri.fsPath)) {
            continue;
          }
          seen.add(repository.rootUri.fsPath);
          repositories.push(repository.rootUri);
        }
      } catch (error) {
        console.warn('[RepoStats] Failed to read repositories from Git extension:', error);
      }
    }

    if (repositories.length > 0) {
      return repositories;
    }

    for (const workspaceFolder of workspaceFolders) {
      const git = simpleGit(workspaceFolder.uri.fsPath);
      if (await git.checkIsRepo()) {
        if (!seen.has(workspaceFolder.uri.fsPath)) {
          seen.add(workspaceFolder.uri.fsPath);
          repositories.push(workspaceFolder.uri);
        }
      }
    }

    return repositories;
  }

  private async updateSettings(
    settings: Partial<ExtensionSettings>,
    target: SettingWriteTarget
  ): Promise<boolean> {
    const repository = await this.getSelectedRepository();
    if (!repository) {
      return false;
    }

    const config = this.getConfig(repository);
    const configTarget = this.toConfigurationTarget(target);
    const previousSettings = this.getSettings(repository);

    for (const update of flattenSettingsUpdate(settings)) {
      await config.update(update.key, update.value, configTarget);
    }

    return settingsAffectCoreAnalysis(previousSettings, this.getSettings(repository));
  }

  private async updateScopedSetting<K extends RepoScopableSettingKey>(
    key: K,
    value: RepoScopableSettingValueMap[K],
    target: SettingWriteTarget
  ): Promise<boolean> {
    const repository = await this.getSelectedRepository();
    if (!repository) {
      return false;
    }

    const config = this.getConfig(repository);
    const previousSettings = this.getSettings(repository);
    await config.update(key, value, this.toConfigurationTarget(target));
    return settingsAffectCoreAnalysis(previousSettings, this.getSettings(repository));
  }

  private async resetScopedSettingOverride(key: RepoScopableSettingKey): Promise<boolean> {
    const repository = await this.getSelectedRepository();
    if (!repository) {
      return false;
    }

    const config = this.getConfig(repository);
    const previousSettings = this.getSettings(repository);
    await config.update(key, undefined, vscode.ConfigurationTarget.WorkspaceFolder);
    return settingsAffectCoreAnalysis(previousSettings, this.getSettings(repository));
  }

  private toConfigurationTarget(target: SettingWriteTarget): vscode.ConfigurationTarget {
    return target === 'repo'
      ? vscode.ConfigurationTarget.WorkspaceFolder
      : vscode.ConfigurationTarget.Global;
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

  private async runAnalysis(
    webview: vscode.Webview,
    repository?: RepositoryContext
  ): Promise<void> {
    const selectedRepository = repository ?? await this.getSelectedRepository();

    if (!selectedRepository) {
      this.sendMessage(webview, {
        type: 'analysisError',
        error: 'No Git repositories were found in the current workspace.',
      });
      return;
    }

    const repoPath = selectedRepository.rootUri.fsPath;

    try {
      const settings = this.getSettings(selectedRepository);
      const settingsHash = createCoreSettingsHash(settings);
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
      const cached = cacheManager.getIfValid(repoInfo.headSha, settingsHash);

      if (cached) {
        // Update with fresh repo info
        cached.repository = repoInfo;
        this.lastCoreStateByRepo.set(repoPath, {
          headSha: cached.repository.headSha,
          settingsHash,
        });
        this.sendMessage(webview, {
          type: 'analysisComplete',
          data: cached,
        });
        await this.sendStalenessStatus(webview, selectedRepository);
        return;
      }

      // Run full analysis
      this.sendMessage(webview, { type: 'analysisStarted' });

      const result = await coordinator.analyze({
        onProgress: (phase, progress) => {
          this.sendMessage(webview, {
            type: 'analysisProgress',
            phase,
            progress,
          });
        },
        onCoreReady: (coreResult) => {
          this.lastCoreStateByRepo.set(repoPath, {
            headSha: coreResult.repository.headSha,
            settingsHash,
          });
          this.sendMessage(webview, {
            type: 'analysisComplete',
            data: coreResult,
          });
        },
        onBlameUpdate: (blameMetrics) => {
          this.sendMessage(webview, {
            type: 'incrementalUpdate',
            data: { blameMetrics },
          });
        },
      });

      // Save to cache
      cacheManager.save(result, coordinator.getLatestBlameFileCache(), settingsHash);

      this.lastCoreStateByRepo.set(repoPath, {
        headSha: result.repository.headSha,
        settingsHash,
      });
      this.sendMessage(webview, {
        type: 'analysisComplete',
        data: result,
      });
      await this.sendStalenessStatus(webview, selectedRepository);
    } catch (error) {
      let errorMessage = 'An unexpected error occurred during analysis.';

      if (error instanceof NotAGitRepoError) {
        errorMessage = `"${repoPath}" is not a Git repository.`;
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
    const selectedRepository = await this.getSelectedRepository();

    if (!selectedRepository) {
      this.sendMessage(webview, {
        type: 'evolutionError',
        error: 'No Git repositories were found in the current workspace.',
      });
      return;
    }

    const repoPath = selectedRepository.rootUri.fsPath;

    try {
      const settings = this.getSettings(selectedRepository);
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
        this.lastEvolutionStateByRepo.set(repoPath, {
          headSha: validCached.headSha,
          settingsHash: validCached.settingsHash,
        });
        this.sendMessage(webview, {
          type: 'evolutionComplete',
          data: validCached,
        });
        await this.sendStalenessStatus(webview, selectedRepository);
        return;
      }

      if (!forceRefresh) {
        const latestCached = evolutionCacheManager.getLatest();
        if (latestCached) {
          this.lastEvolutionStateByRepo.set(repoPath, {
            headSha: latestCached.headSha,
            settingsHash: latestCached.settingsHash,
          });
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

          await this.sendStalenessStatus(webview, selectedRepository);

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

      this.lastEvolutionStateByRepo.set(repoPath, {
        headSha: result.headSha,
        settingsHash: result.settingsHash,
      });
      this.sendMessage(webview, {
        type: 'evolutionComplete',
        data: result,
      });
      await this.sendStalenessStatus(webview, selectedRepository);
    } catch (error) {
      let errorMessage = 'An unexpected error occurred during evolution analysis.';

      if (error instanceof NotAGitRepoError) {
        errorMessage = `"${repoPath}" is not a Git repository.`;
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }

      this.sendMessage(webview, {
        type: 'evolutionError',
        error: errorMessage,
      });
    }
  }

  private async sendStalenessStatus(
    webview: vscode.Webview,
    repository?: RepositoryContext
  ): Promise<void> {
    const selectedRepository = repository ?? await this.getSelectedRepository();
    if (!selectedRepository) {
      this.sendMessage(webview, {
        type: 'stalenessStatus',
        coreStale: false,
        evolutionStale: false,
      });
      return;
    }

    const repoPath = selectedRepository.rootUri.fsPath;

    try {
      const git = simpleGit(repoPath);
      const currentHeadSha = (await git.revparse(['HEAD'])).trim();
      const settings = this.getSettings(selectedRepository);
      const currentCoreSettingsHash = createCoreSettingsHash(settings);
      const currentEvolutionSettingsHash = createEvolutionSettingsHash(settings);
      const lastCoreState = this.lastCoreStateByRepo.get(repoPath);
      const lastEvolutionState = this.lastEvolutionStateByRepo.get(repoPath);

      const coreStaleByHead = lastCoreState !== undefined && lastCoreState.headSha !== currentHeadSha;
      const coreStaleBySettings =
        lastCoreState !== undefined &&
        lastCoreState.settingsHash !== currentCoreSettingsHash;

      const evolutionStaleByHead =
        lastEvolutionState !== undefined && lastEvolutionState.headSha !== currentHeadSha;
      const evolutionStaleBySettings =
        lastEvolutionState !== undefined &&
        lastEvolutionState.settingsHash !== currentEvolutionSettingsHash;

      this.sendMessage(webview, {
        type: 'stalenessStatus',
        coreStale: coreStaleByHead || coreStaleBySettings,
        evolutionStale: evolutionStaleByHead || evolutionStaleBySettings,
      });
    } catch (error) {
      console.error('[RepoStats] Failed to compute staleness status:', error);
    }
  }

  private sendMessage(webview: vscode.Webview, message: ExtensionMessage): void {
    webview.postMessage(message);
  }

  private getConfig(repository: RepositoryContext): vscode.WorkspaceConfiguration {
    return vscode.workspace.getConfiguration('repoStats', repository.workspaceFolder.uri);
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

  private getScopedSettingValue<K extends RepoScopableSettingKey>(
    config: vscode.WorkspaceConfiguration,
    key: K
  ): RepoScopedSettings[K] {
    const inspect = config.inspect<RepoScopableSettingValueMap[K]>(key);
    if (!inspect) {
      throw new Error(
        `Missing inspect data for configuration value: repoStats.${key}. ` +
        'Check package.json contributes.configuration registration.'
      );
    }

    return buildScopedSettingValue(inspect) as unknown as RepoScopedSettings[K];
  }

  private getRepoScopedSettings(repository: RepositoryContext): RepoScopedSettings {
    const config = this.getConfig(repository);

    return {
      excludePatterns: this.getScopedSettingValue(config, 'excludePatterns'),
      generatedPatterns: this.getScopedSettingValue(config, 'generatedPatterns'),
      binaryExtensions: this.getScopedSettingValue(config, 'binaryExtensions'),
      locExcludedExtensions: this.getScopedSettingValue(config, 'locExcludedExtensions'),
      includeSubmodules: this.getScopedSettingValue(config, 'includeSubmodules'),
      maxCommitsToAnalyze: this.getScopedSettingValue(config, 'maxCommitsToAnalyze'),
      'evolution.snapshotIntervalDays': this.getScopedSettingValue(config, 'evolution.snapshotIntervalDays'),
      'evolution.maxSnapshots': this.getScopedSettingValue(config, 'evolution.maxSnapshots'),
      'evolution.maxSeries': this.getScopedSettingValue(config, 'evolution.maxSeries'),
      'evolution.cohortFormat': this.getScopedSettingValue(config, 'evolution.cohortFormat'),
    };
  }

  private getSettings(repository: RepositoryContext): ExtensionSettings {
    const config = this.getConfig(repository);

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
  const payload = JSON.stringify(createEvolutionAnalysisSettingsSnapshot(settings));
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
