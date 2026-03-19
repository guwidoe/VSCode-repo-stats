import * as crypto from 'crypto';
import * as path from 'path';
import * as vscode from 'vscode';
import simpleGit from 'simple-git';
import type { ExtensionMessage, ExtensionSettings } from '../types/index.js';
import { TargetAnalysisCoordinator } from '../analyzers/targetCoordinator.js';
import { createTargetEvolutionAnalyzer } from '../analyzers/targetEvolutionAnalyzer.js';
import { CacheManager } from '../cache/cacheManager.js';
import { EvolutionCacheManager } from '../cache/evolutionCacheManager.js';
import { createEvolutionRevisionHash, createTargetRevisionHash } from '../cache/targetCacheKeys.js';
import { createCoreSettingsHash } from '../cache/coreSettingsHash.js';
import { createEvolutionAnalysisSettingsSnapshot } from '../shared/settings.js';
import type { AnalysisTargetContext } from './context.js';
import { RepositorySettingsService } from './settingsService.js';
import { WorkspaceStateStorage } from './workspaceStateStorage.js';

interface AnalysisStateSnapshot {
  revisionHash: string;
  settingsHash: string;
}

export class RepoAnalysisService {
  private readonly lastCoreStateByTarget = new Map<string, AnalysisStateSnapshot>();
  private readonly lastEvolutionStateByTarget = new Map<string, AnalysisStateSnapshot>();

  constructor(
    private readonly workspaceState: vscode.Memento,
    private readonly globalStoragePath: string,
    private readonly settingsService: RepositorySettingsService
  ) {}

  clearCache(target: AnalysisTargetContext): void {
    const storage = new WorkspaceStateStorage(this.workspaceState);
    const cacheManager = new CacheManager(storage, target.target.id);
    const evolutionCacheManager = new EvolutionCacheManager(storage, target.target.id);
    cacheManager.clear();
    evolutionCacheManager.clear();
  }

  async runAnalysis(webview: vscode.Webview, target?: AnalysisTargetContext): Promise<void> {
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
        this.lastCoreStateByTarget.set(target.target.id, {
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
          this.lastCoreStateByTarget.set(target.target.id, {
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

      cacheManager.save(
        result,
        revisionHash,
        coordinator.getLatestBlameFileCaches(),
        settingsHash
      );

      this.lastCoreStateByTarget.set(target.target.id, {
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
    target: AnalysisTargetContext | undefined,
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
      const memberHeads = await Promise.all(target.target.members.map(async (member) => {
        const git = simpleGit(member.repoPath);
        const [branchRaw, headShaRaw] = await Promise.all([
          git.revparse(['--abbrev-ref', 'HEAD']),
          git.revparse(['HEAD']),
        ]);
        return {
          repositoryId: member.id,
          repositoryName: member.displayName,
          branch: branchRaw.trim(),
          headSha: headShaRaw.trim(),
        };
      }));
      const currentRevisionHash = createEvolutionRevisionHash(memberHeads);
      const settingsHash = createEvolutionSettingsHash(settings);
      const validCached = evolutionCacheManager.getIfValid(currentRevisionHash, settingsHash);

      if (validCached && !forceRefresh) {
        this.lastEvolutionStateByTarget.set(target.target.id, {
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
          this.lastEvolutionStateByTarget.set(target.target.id, {
            revisionHash: latestCached.revisionHash,
            settingsHash: latestCached.settingsHash,
          });
          this.sendMessage(webview, {
            type: 'evolutionComplete',
            data: latestCached,
          });

          if (
            latestCached.revisionHash !== currentRevisionHash ||
            latestCached.settingsHash !== settingsHash
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
      const result = await analyzer.analyze((phase, progress) => {
        this.sendMessage(webview, {
          type: 'evolutionProgress',
          phase,
          progress,
        });
      });

      evolutionCacheManager.save(result);

      this.lastEvolutionStateByTarget.set(target.target.id, {
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
    target?: AnalysisTargetContext
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
      const revisions = await Promise.all(target.target.members.map(async (member) => {
        const git = simpleGit(member.repoPath);
        const [branchRaw, headShaRaw] = await Promise.all([
          git.revparse(['--abbrev-ref', 'HEAD']),
          git.revparse(['HEAD']),
        ]);
        return {
          repositoryId: member.id,
          branch: branchRaw.trim(),
          headSha: headShaRaw.trim(),
        };
      }));
      const settings = this.settingsService.getSettings(target.settingsRepository);
      const currentCoreRevisionHash = createTargetRevisionHash(target.target, revisions);
      const currentCoreSettingsHash = createCoreSettingsHash(settings);
      const currentEvolutionRevisionHash = createEvolutionRevisionHash(
        revisions.map((revision, index) => ({
          repositoryId: revision.repositoryId,
          repositoryName: target.target.members[index]?.displayName ?? revision.repositoryId,
          branch: revision.branch,
          headSha: revision.headSha,
        }))
      );
      const currentEvolutionSettingsHash = createEvolutionSettingsHash(settings);
      const lastCoreState = this.lastCoreStateByTarget.get(target.target.id);
      const lastEvolutionState = this.lastEvolutionStateByTarget.get(target.target.id);

      const coreStaleByRevision =
        lastCoreState !== undefined && lastCoreState.revisionHash !== currentCoreRevisionHash;
      const coreStaleBySettings =
        lastCoreState !== undefined && lastCoreState.settingsHash !== currentCoreSettingsHash;

      const evolutionStaleByRevision =
        lastEvolutionState !== undefined && lastEvolutionState.revisionHash !== currentEvolutionRevisionHash;
      const evolutionStaleBySettings =
        lastEvolutionState !== undefined && lastEvolutionState.settingsHash !== currentEvolutionSettingsHash;

      this.sendMessage(webview, {
        type: 'stalenessStatus',
        coreStale: coreStaleByRevision || coreStaleBySettings,
        evolutionStale: evolutionStaleByRevision || evolutionStaleBySettings,
      });
    } catch (error) {
      console.error('[RepoStats] Failed to compute staleness status:', error);
    }
  }

  private sendMessage(webview: vscode.Webview, message: ExtensionMessage): void {
    webview.postMessage(message);
  }

  private formatErrorMessage(
    error: unknown,
    label: string,
    scope: 'analysis' | 'evolution analysis'
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

function createEvolutionSettingsHash(settings: ExtensionSettings): string {
  const payload = JSON.stringify(createEvolutionAnalysisSettingsSnapshot(settings));
  return crypto.createHash('sha1').update(payload).digest('hex').slice(0, 16);
}
