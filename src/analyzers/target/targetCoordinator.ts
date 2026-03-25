import * as path from 'path';
import type { AnalysisCallbacks } from '../coordinator.js';
import { createAnalysisCoordinator } from '../coordinator.js';
import { mergeBlameMetrics } from '../merge/mergeBlameMetrics.js';
import { mergeTargetFileTrees } from '../merge/mergeTrees.js';
import {
  buildContributorStatsFromCommitAnalytics,
  buildCodeFrequencyFromCommitAnalytics,
  mergeCommitAnalytics,
} from '../commitAnalytics.js';
import { throwIfCancelled } from '../cancellation.js';
import type {
  AnalysisResult,
  AnalysisTarget,
  BlameFileCacheEntry,
  ExtensionSettings,
  SccInfo,
} from '../../types/index.js';

export interface TargetAnalysisCoordinatorOptions {
  target: AnalysisTarget;
  settings: ExtensionSettings;
  sccStoragePath: string;
  signal?: AbortSignal;
  previousBlameFileCaches?: Record<string, Record<string, BlameFileCacheEntry>>;
  coordinatorFactory?: (
    member: AnalysisTarget['members'][number],
    settings: ExtensionSettings,
    previousBlameFileCache: Record<string, BlameFileCacheEntry>
  ) => TargetMemberCoordinator;
}

interface TargetMemberCoordinator {
  analyze(callbacks?: AnalysisCallbacks): Promise<AnalysisResult>;
  getLatestBlameFileCache(): Record<string, BlameFileCacheEntry>;
  getRepositoryInfo(): Promise<{ branch: string; headSha: string }>;
}

export class TargetAnalysisCoordinator {
  private readonly coordinators = new Map<string, TargetMemberCoordinator>();
  private readonly latestBlameFileCaches: Record<string, Record<string, BlameFileCacheEntry>> = {};

  constructor(private readonly options: TargetAnalysisCoordinatorOptions) {}

  async analyze(callbacks: AnalysisCallbacks = {}): Promise<AnalysisResult> {
    const memberResults: AnalysisResult[] = [];
    const totalMembers = this.options.target.members.length;
    const signal = callbacks.signal ?? this.options.signal;

    if (totalMembers === 1) {
      throwIfCancelled(signal);
      const member = this.options.target.members[0];
      const coordinator = this.createCoordinator(member);
      const memberResult = await coordinator.analyze({
        signal,
        onProgress: (phase, progress) => {
          callbacks.onProgress?.(`${member.displayName}: ${phase}`, progress);
        },
        onCoreReady: (coreResult) => {
          callbacks.onCoreReady?.(this.decorateMemberResult(coreResult, member));
        },
        onBlameUpdate: callbacks.onBlameUpdate,
      });

      this.latestBlameFileCaches[member.id] = coordinator.getLatestBlameFileCache();
      return this.decorateMemberResult(memberResult, member);
    }

    for (let index = 0; index < totalMembers; index += 1) {
      throwIfCancelled(signal);
      const member = this.options.target.members[index];
      const coordinator = this.createCoordinator(member);
      this.coordinators.set(member.id, coordinator);

      const memberResult = await coordinator.analyze({
        signal,
        onProgress: (phase, progress) => {
          const memberWeight = 100 / totalMembers;
          const overallProgress = Math.round((index * memberWeight) + (progress / totalMembers));
          callbacks.onProgress?.(`${member.displayName}: ${phase}`, overallProgress);
        },
      });

      this.latestBlameFileCaches[member.id] = coordinator.getLatestBlameFileCache();
      memberResults.push(this.decorateMemberResult(memberResult, member));
    }

    throwIfCancelled(signal);
    const aggregated = this.aggregateMemberResults(memberResults);
    callbacks.onProgress?.('Analysis complete', 100);
    return aggregated;
  }

  getLatestBlameFileCaches(): Record<string, Record<string, BlameFileCacheEntry>> {
    return this.latestBlameFileCaches;
  }

  async getTargetRevision(): Promise<Array<{ repositoryId: string; branch: string; headSha: string }>> {
    const revisions: Array<{ repositoryId: string; branch: string; headSha: string }> = [];

    for (const member of this.options.target.members) {
      throwIfCancelled(this.options.signal);
      const coordinator = this.coordinators.get(member.id) ?? createAnalysisCoordinator(
        member.repoPath,
        this.options.settings,
        this.options.sccStoragePath,
        this.options.previousBlameFileCaches?.[member.id] ?? {}
      );
      const info = await coordinator.getRepositoryInfo();
      revisions.push({
        repositoryId: member.id,
        branch: info.branch,
        headSha: info.headSha,
      });
    }

    return revisions;
  }

  private createCoordinator(member: AnalysisTarget['members'][number]): TargetMemberCoordinator {
    const memberSettings: ExtensionSettings = {
      ...this.options.settings,
      excludePatterns: [
        ...this.options.settings.excludePatterns,
        ...(member.excludePatterns ?? []),
      ],
    };

    const nextCoordinator = this.options.coordinatorFactory?.(
      member,
      memberSettings,
      this.options.previousBlameFileCaches?.[member.id] ?? {}
    ) ?? createAnalysisCoordinator(
      member.repoPath,
      memberSettings,
      this.options.sccStoragePath,
      this.options.previousBlameFileCaches?.[member.id] ?? {}
    );
    this.coordinators.set(member.id, nextCoordinator);
    return nextCoordinator;
  }

  private decorateMemberResult(result: AnalysisResult, member: AnalysisTarget['members'][number]): AnalysisResult {
    const repository = result.repositories[0];
    const logicalRoot = member.pathPrefix || path.basename(member.repoPath);

    return {
      ...result,
      repositories: repository
        ? [
            {
              ...repository,
              id: member.id,
              role: member.role,
              logicalRoot,
              pathPrefix: member.pathPrefix,
            },
          ]
        : [],
    };
  }

  private aggregateMemberResults(memberResults: AnalysisResult[]): AnalysisResult {
    const commitAnalytics = mergeCommitAnalytics(memberResults.map((result) => result.commitAnalytics));
    const repositories = memberResults.flatMap((result) => result.repositories);
    const limitedRepositories = repositories
      .filter((_, index) => memberResults[index]?.limitReached)
      .map((repository, index) => ({
        repositoryId: repository.id,
        repositoryName: repository.name,
        analyzedCommitCount: memberResults[index]?.analyzedCommitCount ?? 0,
        commitCount: repository.commitCount,
      }));

    return {
      target: {
        id: this.options.target.id,
        kind: this.options.target.kind,
        label: this.options.target.label,
        memberCount: this.options.target.members.length,
      },
      repositories,
      contributors: buildContributorStatsFromCommitAnalytics(commitAnalytics),
      codeFrequency: buildCodeFrequencyFromCommitAnalytics(commitAnalytics),
      commitAnalytics,
      fileTree: mergeTargetFileTrees(
        memberResults.map((result, index) => ({
          member: this.options.target.members[index],
          tree: result.fileTree,
        }))
      ),
      analyzedAt: new Date().toISOString(),
      analyzedCommitCount: memberResults.reduce((sum, result) => sum + result.analyzedCommitCount, 0),
      maxCommitsLimit: this.options.settings.maxCommitsToAnalyze,
      limitReached: memberResults.some((result) => result.limitReached),
      sccInfo: this.mergeSccInfo(memberResults.map((result) => result.sccInfo)),
      blameMetrics: mergeBlameMetrics(memberResults.map((result) => result.blameMetrics)),
      diagnostics: limitedRepositories.length > 0
        ? { repositoriesLimited: limitedRepositories }
        : undefined,
    };
  }

  private mergeSccInfo(sccInfos: SccInfo[]): SccInfo {
    const version = sccInfos[0]?.version ?? '';
    const sources = new Set(sccInfos.map((info) => info.source));
    return {
      version,
      source: sources.size === 1 ? (sccInfos[0]?.source ?? 'none') : 'mixed',
    };
  }
}
