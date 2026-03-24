import * as path from 'path';
import * as vscode from 'vscode';
import type { ExtensionMessage } from '../types/index.js';
import { TargetAnalysisCoordinator } from '../analyzers/target/targetCoordinator.js';
import { createTargetEvolutionAnalyzer } from '../analyzers/target/targetEvolutionAnalyzer.js';
import { CacheManager } from '../cache/cacheManager.js';
import { EvolutionCacheManager } from '../cache/evolutionCacheManager.js';
import { createTargetRevisionHash } from '../cache/targetCacheKeys.js';
import { createCoreSettingsHash } from '../cache/coreSettingsHash.js';
import type { AnalysisTargetContext } from './context.js';
import { AnalysisStateRegistry } from './analysisStateRegistry.js';
import { RepositorySettingsService } from './settingsService.js';
import {
  collectTargetMemberHeads,
  createTargetStateHashes,
} from './targetRevisionState.js';
import { WorkspaceStateStorage } from './workspaceStateStorage.js';

export class RepoAnalysisService {
  private readonly stateRegistry = new AnalysisStateRegistry();

  constructor(
    private readonly workspaceState: vscode.Memento,
    private readonly globalStoragePath: string,
    private readonly settingsService: RepositorySettingsService
  ) {}

  async clearCache(target: AnalysisTargetContext): Promise<void> {
    const storage = new WorkspaceStateStorage(this.workspaceState);
    const cacheManager = new CacheManager(storage, target.target.id);
    const evolutionCacheManager = new EvolutionCacheManager(storage, target.target.id);
    await cacheManager.clear();
    await evolutionCacheManager.clear();
  }

  async runAnalysis(webview: vscode.Webview, target: AnalysisTargetContext | null): Promise<void> {
    if (!target) {
      this.sendMessage(webview, {
        type: 'analysisError',
        error: 'No Git repositories were found in the current workspace.',
      });
      return;
    }

    try {
      const settings = this.settingsService.getSettings(target.settingsRepository);
      const settingsHash = createCoreSettingsHash(settings);
      const storage = new WorkspaceStateStorage(this.workspaceState);
      const cacheManager = new CacheManager(storage, target.target.id);
      const previousBlameFileCaches = cacheManager.getBlameFileCaches();
      const coordinator = new TargetAnalysisCoordinator({
        target: target.target,
        settings,
        sccStoragePath: path.join(this.globalStoragePath, 'scc'),
        previousBlameFileCaches,
      });
      const revisions = await coordinator.getTargetRevision();
      const revisionHash = createTargetRevisionHash(target.target, revisions);
      const cached = cacheManager.getIfValid(revisionHash, settingsHash);

      if (cached) {
        this.stateRegistry.setCoreState(target.target.id, {
          revisionHash,
          settingsHash,
        });
        this.sendMessage(webview, {
          type: 'analysisComplete',
          data: cached,
        });
        await this.sendStalenessStatus(webview, target);
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
          this.stateRegistry.setCoreState(target.target.id, {
            revisionHash,
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

      await cacheManager.save(
        result,
        revisionHash,
        coordinator.getLatestBlameFileCaches(),
        settingsHash
      );

      this.stateRegistry.setCoreState(target.target.id, {
        revisionHash,
        settingsHash,
      });
      this.sendMessage(webview, {
        type: 'analysisComplete',
        data: result,
      });
      await this.sendStalenessStatus(webview, target);
    } catch (error) {
      this.sendMessage(webview, {
        type: 'analysisError',
        error: this.formatErrorMessage(error, target.target.label, 'analysis'),
      });
    }
  }

  async runEvolutionAnalysis(
    webview: vscode.Webview,
    target: AnalysisTargetContext | null,
    forceRefresh: boolean
  ): Promise<void> {
    if (!target) {
      this.sendMessage(webview, {
        type: 'evolutionError',
        error: 'No Git repositories were found in the current workspace.',
      });
      return;
    }

    try {
      const settings = this.settingsService.getSettings(target.settingsRepository);
      const storage = new WorkspaceStateStorage(this.workspaceState);
      const evolutionCacheManager = new EvolutionCacheManager(storage, target.target.id);
      const memberHeads = await collectTargetMemberHeads(target.target);
      const hashes = createTargetStateHashes(target.target, settings, memberHeads);
      const validCached = evolutionCacheManager.getIfValid(
        hashes.evolutionRevisionHash,
        hashes.evolutionSettingsHash
      );

      if (validCached && !forceRefresh) {
        this.stateRegistry.setEvolutionState(target.target.id, {
          revisionHash: validCached.revisionHash,
          settingsHash: validCached.settingsHash,
        });
        this.sendMessage(webview, {
          type: 'evolutionComplete',
          data: validCached,
        });
        await this.sendStalenessStatus(webview, target);
        return;
      }

      if (!forceRefresh) {
        const latestCached = evolutionCacheManager.getLatest();
        if (latestCached) {
          this.stateRegistry.setEvolutionState(target.target.id, {
            revisionHash: latestCached.revisionHash,
            settingsHash: latestCached.settingsHash,
          });
          this.sendMessage(webview, {
            type: 'evolutionComplete',
            data: latestCached,
          });

          if (
            latestCached.revisionHash !== hashes.evolutionRevisionHash ||
            latestCached.settingsHash !== hashes.evolutionSettingsHash
          ) {
            this.sendMessage(webview, {
              type: 'evolutionStale',
              reason: 'Target revision or Evolution settings changed since the last run.',
            });
          }

          await this.sendStalenessStatus(webview, target);

          if (!settings.evolution.autoRun) {
            return;
          }
        } else if (!settings.evolution.autoRun) {
          return;
        }
      }

      this.sendMessage(webview, { type: 'evolutionStarted' });

      const analyzer = createTargetEvolutionAnalyzer(target.target, settings);
      const result = await analyzer.analyze((update) => {
        this.sendMessage(webview, {
          type: 'evolutionProgress',
          ...update,
        });
      });

      await evolutionCacheManager.save(result);

      this.stateRegistry.setEvolutionState(target.target.id, {
        revisionHash: result.revisionHash,
        settingsHash: result.settingsHash,
      });
      this.sendMessage(webview, {
        type: 'evolutionComplete',
        data: result,
      });
      await this.sendStalenessStatus(webview, target);
    } catch (error) {
      this.sendMessage(webview, {
        type: 'evolutionError',
        error: this.formatErrorMessage(error, target.target.label, 'evolution analysis'),
      });
    }
  }

  async sendStalenessStatus(
    webview: vscode.Webview,
    target: AnalysisTargetContext | null
  ): Promise<void> {
    if (!target) {
      this.sendMessage(webview, {
        type: 'stalenessStatus',
        coreStale: false,
        evolutionStale: false,
      });
      return;
    }

    try {
      const settings = this.settingsService.getSettings(target.settingsRepository);
      const memberHeads = await collectTargetMemberHeads(target.target);
      const hashes = createTargetStateHashes(target.target, settings, memberHeads);
      const lastCoreState = this.stateRegistry.getCoreState(target.target.id);
      const lastEvolutionState = this.stateRegistry.getEvolutionState(target.target.id);

      const coreStaleByRevision =
        lastCoreState !== undefined && lastCoreState.revisionHash !== hashes.coreRevisionHash;
      const coreStaleBySettings =
        lastCoreState !== undefined && lastCoreState.settingsHash !== hashes.coreSettingsHash;

      const evolutionStaleByRevision =
        lastEvolutionState !== undefined && lastEvolutionState.revisionHash !== hashes.evolutionRevisionHash;
      const evolutionStaleBySettings =
        lastEvolutionState !== undefined && lastEvolutionState.settingsHash !== hashes.evolutionSettingsHash;

      this.sendMessage(webview, {
        type: 'stalenessStatus',
        coreStale: coreStaleByRevision || coreStaleBySettings,
        evolutionStale: evolutionStaleByRevision || evolutionStaleBySettings,
      });
    } catch (error) {
      console.error('[RepoStats] Failed to compute staleness status:', error);
      this.sendMessage(webview, {
        type: 'analysisError',
        error: this.formatErrorMessage(error, target.target.label, 'staleness check'),
      });
    }
  }

  private sendMessage(webview: vscode.Webview, message: ExtensionMessage): void {
    webview.postMessage(message);
  }

  private formatErrorMessage(
    error: unknown,
    label: string,
    scope: 'analysis' | 'evolution analysis' | 'staleness check'
  ): string {
    let errorMessage = `An unexpected error occurred during ${scope}.`;

    if (error instanceof Error && error.name === 'NotAGitRepoError') {
      errorMessage = `"${label}" is not a Git repository.`;
    } else if (error instanceof Error) {
      errorMessage = error.message;
    }

    return errorMessage;
  }
}
