import * as crypto from 'crypto';
import * as path from 'path';
import * as vscode from 'vscode';
import simpleGit from 'simple-git';
import type { ExtensionMessage, ExtensionSettings } from '../types/index.js';
import { AnalysisCoordinator } from '../analyzers/coordinator.js';
import { createEvolutionAnalyzer } from '../analyzers/evolutionAnalyzer.js';
import { CacheManager } from '../cache/cacheManager.js';
import { EvolutionCacheManager } from '../cache/evolutionCacheManager.js';
import { createCoreSettingsHash } from '../cache/coreSettingsHash.js';
import { createEvolutionAnalysisSettingsSnapshot } from '../shared/settings.js';
import type { RepositoryContext } from './context.js';
import { RepositorySettingsService } from './settingsService.js';
import { WorkspaceStateStorage } from './workspaceStateStorage.js';

interface AnalysisStateSnapshot {
  headSha: string;
  settingsHash: string;
}

export class RepoAnalysisService {
  private readonly lastCoreStateByRepo = new Map<string, AnalysisStateSnapshot>();
  private readonly lastEvolutionStateByRepo = new Map<string, AnalysisStateSnapshot>();

  constructor(
    private readonly workspaceState: vscode.Memento,
    private readonly globalStoragePath: string,
    private readonly settingsService: RepositorySettingsService
  ) {}

  clearCache(repository: RepositoryContext): void {
    const storage = new WorkspaceStateStorage(this.workspaceState);
    const cacheManager = new CacheManager(storage, repository.rootUri.fsPath);
    const evolutionCacheManager = new EvolutionCacheManager(storage, repository.rootUri.fsPath);
    cacheManager.clear();
    evolutionCacheManager.clear();
  }

  async runAnalysis(webview: vscode.Webview, repository?: RepositoryContext): Promise<void> {
    if (!repository) {
      this.sendMessage(webview, {
        type: 'analysisError',
        error: 'No Git repositories were found in the current workspace.',
      });
      return;
    }

    const repoPath = repository.rootUri.fsPath;

    try {
      const settings = this.settingsService.getSettings(repository);
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

      const repoInfo = await coordinator.getRepositoryInfo();
      const cached = cacheManager.getIfValid(repoInfo.headSha, settingsHash);

      if (cached) {
        cached.repository = repoInfo;
        this.lastCoreStateByRepo.set(repoPath, {
          headSha: cached.repository.headSha,
          settingsHash,
        });
        this.sendMessage(webview, {
          type: 'analysisComplete',
          data: cached,
        });
        await this.sendStalenessStatus(webview, repository);
        return;
      }

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

      cacheManager.save(result, coordinator.getLatestBlameFileCache(), settingsHash);

      this.lastCoreStateByRepo.set(repoPath, {
        headSha: result.repository.headSha,
        settingsHash,
      });
      this.sendMessage(webview, {
        type: 'analysisComplete',
        data: result,
      });
      await this.sendStalenessStatus(webview, repository);
    } catch (error) {
      this.sendMessage(webview, {
        type: 'analysisError',
        error: this.formatErrorMessage(error, repoPath, 'analysis'),
      });
    }
  }

  async runEvolutionAnalysis(
    webview: vscode.Webview,
    repository: RepositoryContext | undefined,
    forceRefresh: boolean
  ): Promise<void> {
    if (!repository) {
      this.sendMessage(webview, {
        type: 'evolutionError',
        error: 'No Git repositories were found in the current workspace.',
      });
      return;
    }

    const repoPath = repository.rootUri.fsPath;

    try {
      const settings = this.settingsService.getSettings(repository);
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
        await this.sendStalenessStatus(webview, repository);
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

          await this.sendStalenessStatus(webview, repository);

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
      await this.sendStalenessStatus(webview, repository);
    } catch (error) {
      this.sendMessage(webview, {
        type: 'evolutionError',
        error: this.formatErrorMessage(error, repoPath, 'evolution analysis'),
      });
    }
  }

  async sendStalenessStatus(
    webview: vscode.Webview,
    repository?: RepositoryContext
  ): Promise<void> {
    if (!repository) {
      this.sendMessage(webview, {
        type: 'stalenessStatus',
        coreStale: false,
        evolutionStale: false,
      });
      return;
    }

    const repoPath = repository.rootUri.fsPath;

    try {
      const git = simpleGit(repoPath);
      const currentHeadSha = (await git.revparse(['HEAD'])).trim();
      const settings = this.settingsService.getSettings(repository);
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

  private formatErrorMessage(error: unknown, repoPath: string, scope: 'analysis' | 'evolution analysis'): string {
    let errorMessage = `An unexpected error occurred during ${scope}.`;

    if (error instanceof Error && error.name === 'NotAGitRepoError') {
      errorMessage = `"${repoPath}" is not a Git repository.`;
    } else if (error instanceof Error) {
      errorMessage = error.message;
    }

    return errorMessage;
  }
}

function createEvolutionSettingsHash(settings: ExtensionSettings): string {
  const payload = JSON.stringify(createEvolutionAnalysisSettingsSnapshot(settings));
  return crypto.createHash('sha1').update(payload).digest('hex').slice(0, 16);
}
