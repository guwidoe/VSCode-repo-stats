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
import { computeStalenessStatus } from './stalenessStatus.js';
import { WorkspaceStateStorage } from './workspaceStateStorage.js';
import {
  AnalysisRunLifecycle,
  type AnalysisRunScope,
  type AnalysisRunToken,
} from './analysisRunLifecycle.js';

export class RepoAnalysisService {
  private readonly stateRegistry = new AnalysisStateRegistry();

  private readonly runLifecycle = new AnalysisRunLifecycle();

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

    const run = this.runLifecycle.start('core');

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
        signal: run.signal,
        previousBlameFileCaches,
      });
      const revisions = await coordinator.getTargetRevision();
      const revisionHash = createTargetRevisionHash(target.target, revisions);
      const cached = cacheManager.getIfValid(revisionHash, settingsHash);

      if (cached) {
        if (!this.isRunCurrent(run)) {
          return;
        }

        this.stateRegistry.setCoreState(target.target.id, {
          revisionHash,
          settingsHash,
        });
        this.sendMessageIfCurrent(run, webview, {
          type: 'analysisComplete',
          data: cached,
        });
        await this.sendStalenessStatus(webview, target, run);
        return;
      }

      this.sendMessageIfCurrent(run, webview, { type: 'analysisStarted' });

      const result = await coordinator.analyze({
        onProgress: (phase, progress) => {
          this.sendMessageIfCurrent(run, webview, {
            type: 'analysisProgress',
            phase,
            progress,
          });
        },
        onCoreReady: (coreResult) => {
          if (!this.isRunCurrent(run)) {
            return;
          }

          this.stateRegistry.setCoreState(target.target.id, {
            revisionHash,
            settingsHash,
          });
          this.sendMessageIfCurrent(run, webview, {
            type: 'analysisComplete',
            data: coreResult,
          });
        },
        onBlameUpdate: (blameMetrics) => {
          this.sendMessageIfCurrent(run, webview, {
            type: 'incrementalUpdate',
            data: { blameMetrics },
          });
        },
      });

      if (!this.isRunCurrent(run)) {
        return;
      }

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
      this.sendMessageIfCurrent(run, webview, {
        type: 'analysisComplete',
        data: result,
      });
      await this.sendStalenessStatus(webview, target, run);
    } catch (error) {
      if (!this.isRunCurrent(run)) {
        return;
      }

      this.sendMessageIfCurrent(run, webview, {
        type: 'analysisError',
        error: this.formatErrorMessage(error, target.target.label, 'analysis'),
      });
    } finally {
      this.runLifecycle.finish(run);
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

    const run = this.runLifecycle.start('evolution');

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
        if (!this.isRunCurrent(run)) {
          return;
        }

        this.stateRegistry.setEvolutionState(target.target.id, {
          revisionHash: validCached.revisionHash,
          settingsHash: validCached.settingsHash,
        });
        this.sendMessageIfCurrent(run, webview, {
          type: 'evolutionComplete',
          data: validCached,
        });
        await this.sendStalenessStatus(webview, target, run);
        return;
      }

      if (!forceRefresh) {
        const latestCached = evolutionCacheManager.getLatest();
        if (latestCached) {
          if (!this.isRunCurrent(run)) {
            return;
          }

          this.stateRegistry.setEvolutionState(target.target.id, {
            revisionHash: latestCached.revisionHash,
            settingsHash: latestCached.settingsHash,
          });
          this.sendMessageIfCurrent(run, webview, {
            type: 'evolutionComplete',
            data: latestCached,
          });

          if (
            latestCached.revisionHash !== hashes.evolutionRevisionHash ||
            latestCached.settingsHash !== hashes.evolutionSettingsHash
          ) {
            this.sendMessageIfCurrent(run, webview, {
              type: 'evolutionStale',
              reason: 'Target revision or Evolution settings changed since the last run.',
            });
          }

          await this.sendStalenessStatus(webview, target, run);

          if (!settings.evolution.autoRun) {
            return;
          }
        } else if (!settings.evolution.autoRun) {
          return;
        }
      }

      this.sendMessageIfCurrent(run, webview, { type: 'evolutionStarted' });

      const analyzer = createTargetEvolutionAnalyzer(target.target, settings, run.signal);
      const result = await analyzer.analyze((update) => {
        this.sendMessageIfCurrent(run, webview, {
          type: 'evolutionProgress',
          ...update,
        });
      });

      if (!this.isRunCurrent(run)) {
        return;
      }

      await evolutionCacheManager.save(result);

      this.stateRegistry.setEvolutionState(target.target.id, {
        revisionHash: result.revisionHash,
        settingsHash: result.settingsHash,
      });
      this.sendMessageIfCurrent(run, webview, {
        type: 'evolutionComplete',
        data: result,
      });
      await this.sendStalenessStatus(webview, target, run);
    } catch (error) {
      if (!this.isRunCurrent(run)) {
        return;
      }

      this.sendMessageIfCurrent(run, webview, {
        type: 'evolutionError',
        error: this.formatErrorMessage(error, target.target.label, 'evolution analysis'),
      });
    } finally {
      this.runLifecycle.finish(run);
    }
  }

  async sendStalenessStatus(
    webview: vscode.Webview,
    target: AnalysisTargetContext | null,
    run?: AnalysisRunToken
  ): Promise<void> {
    if (run && !this.isRunCurrent(run)) {
      return;
    }

    if (!target) {
      this.sendMessageIfCurrent(run, webview, {
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
      const status = computeStalenessStatus({
        current: hashes,
        lastCoreState,
        lastEvolutionState,
      });

      this.sendMessageIfCurrent(run, webview, {
        type: 'stalenessStatus',
        coreStale: status.coreStale,
        evolutionStale: status.evolutionStale,
      });
    } catch (error) {
      console.error('[RepoStats] Failed to compute staleness status:', error);
      this.sendMessageIfCurrent(run, webview, {
        type: 'analysisError',
        error: this.formatErrorMessage(error, target.target.label, 'staleness check'),
      });
    }
  }

  cancelRun(scope: AnalysisRunScope): boolean {
    return this.runLifecycle.cancel(scope, 'user');
  }

  private sendMessage(webview: vscode.Webview, message: ExtensionMessage): void {
    webview.postMessage(message);
  }

  private sendMessageIfCurrent(
    run: AnalysisRunToken | undefined,
    webview: vscode.Webview,
    message: ExtensionMessage
  ): void {
    if (run && !this.isRunCurrent(run)) {
      return;
    }

    this.sendMessage(webview, message);
  }

  private isRunCurrent(run: AnalysisRunToken): boolean {
    return this.runLifecycle.isCurrent(run);
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
