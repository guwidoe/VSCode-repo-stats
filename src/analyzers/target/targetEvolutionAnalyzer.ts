import * as crypto from 'crypto';
import { normalizeEvolutionResult } from '../../types/index.js';
import type {
  AnalysisTarget,
  EvolutionResult,
  EvolutionSamplingMode,
  EvolutionSnapshotPoint,
  ExtensionSettings,
} from '../../types/index.js';
import { createEvolutionRevisionHash } from '../../cache/targetCacheKeys.js';
import { createEvolutionAnalysisSettingsSnapshot } from '../../shared/settings.js';
import {
  createEmptyHistogram,
  mergeCounts,
  sampleHistoryEntries,
  toEvolutionSeries,
  type DimensionCounts,
  type EvolutionFileHistogram,
} from '../evolution/shared.js';
import {
  MemberEvolutionRuntime,
  type MemberCommit,
  type MemberHeadInfo,
} from './memberEvolutionRuntime.js';

export interface EvolutionProgressUpdate {
  phase: string;
  progress: number;
  stage: 'preparing' | 'sampling' | 'analyzing' | 'finalizing';
  currentRepositoryLabel?: string;
  currentRepositoryIndex?: number;
  totalRepositories?: number;
  currentSnapshotIndex?: number;
  totalSnapshots?: number;
  etaSeconds?: number;
}

export type EvolutionProgressCallback = (update: EvolutionProgressUpdate) => void;

interface TargetSnapshotEvent {
  repositoryId: string;
  repositoryName: string;
  branch: string;
  sha: string;
  timestamp: number;
  globalIndex: number;
  totalEventCount: number;
  samplingMode: EvolutionSamplingMode;
}

export class TargetEvolutionAnalyzer {
  constructor(
    private readonly target: AnalysisTarget,
    private readonly settings: ExtensionSettings
  ) {}

  async analyze(onProgress?: EvolutionProgressCallback): Promise<EvolutionResult> {
    const startedAt = Date.now();
    const totalRepositories = this.target.members.length;
    const emitProgress = (update: Omit<EvolutionProgressUpdate, 'etaSeconds'>) => {
      onProgress?.({
        ...update,
        etaSeconds: estimateEtaSeconds(startedAt, update.progress),
      });
    };

    emitProgress({
      phase: 'Preparing evolution analysis',
      progress: 0,
      stage: 'preparing',
      totalRepositories,
    });

    const runtimes = this.target.members.map((member) => new MemberEvolutionRuntime(member, this.settings));
    const memberHeads = await Promise.all(runtimes.map((runtime) => runtime.getHeadInfo()));
    const commitHistories = await Promise.all(
      runtimes.map(async (runtime, index) => runtime.getCommitHistory(memberHeads[index].branch))
    );

    emitProgress({
      phase: `Loaded history for ${totalRepositories} ${totalRepositories === 1 ? 'repository' : 'repositories'}`,
      progress: 3,
      stage: 'preparing',
      totalRepositories,
    });

    const mergedEvents = this.mergeEvents(memberHeads, commitHistories);
    const sampledEvents = this.sampleEvents(mergedEvents, emitProgress, totalRepositories);
    emitProgress({
      phase: `Selected ${sampledEvents.length} snapshots across ${mergedEvents.length} history events`,
      progress: 8,
      stage: 'sampling',
      totalRepositories,
      totalSnapshots: sampledEvents.length,
    });

    const memberSelections = runtimes.map((runtime, index) => {
      const selectedCommits = this.selectMemberCommitsForSnapshots(commitHistories[index], sampledEvents);
      const uniqueCommits = Array.from(
        new Map(
          selectedCommits
            .filter((commit): commit is MemberCommit => commit !== null)
            .map((commit) => [commit.sha, commit])
        ).values()
      );

      return {
        runtime,
        selectedCommits,
        uniqueCommits,
      };
    });

    const totalSnapshotWork = memberSelections.reduce((sum, selection) => sum + selection.uniqueCommits.length, 0);
    let completedSnapshotWork = 0;
    const memberTotalsBySnapshot: EvolutionFileHistogram[][] = [];

    for (let index = 0; index < memberSelections.length; index += 1) {
      const selection = memberSelections[index];
      const { runtime, selectedCommits, uniqueCommits } = selection;

      if (uniqueCommits.length === 0) {
        emitProgress({
          phase: `No sampled snapshots to analyze for ${runtime.member.displayName}`,
          progress: totalSnapshotWork === 0 ? 90 : 10 + Math.round((completedSnapshotWork / totalSnapshotWork) * 80),
          stage: 'analyzing',
          currentRepositoryLabel: runtime.member.displayName,
          currentRepositoryIndex: index + 1,
          totalRepositories: memberSelections.length,
          totalSnapshots: 0,
        });
        memberTotalsBySnapshot.push(sampledEvents.map(() => createEmptyHistogram()));
        continue;
      }

      const totalsBySha = await runtime.analyzeCommits(uniqueCommits, ({ completedSnapshots, totalSnapshots }) => {
        const overallProgress = totalSnapshotWork === 0
          ? 90
          : 10 + Math.round(((completedSnapshotWork + completedSnapshots) / totalSnapshotWork) * 80);
        emitProgress({
          phase: `Analyzing snapshots for ${runtime.member.displayName}`,
          progress: overallProgress,
          stage: 'analyzing',
          currentRepositoryLabel: runtime.member.displayName,
          currentRepositoryIndex: index + 1,
          totalRepositories: memberSelections.length,
          currentSnapshotIndex: completedSnapshots,
          totalSnapshots,
        });
      });

      completedSnapshotWork += uniqueCommits.length;
      memberTotalsBySnapshot.push(
        sampledEvents.map((_, snapshotIndex) => {
          const selectedCommit = selectedCommits[snapshotIndex];
          if (!selectedCommit) {
            return createEmptyHistogram();
          }
          return totalsBySha.get(selectedCommit.sha) ?? createEmptyHistogram();
        })
      );
    }

    const snapshotTotals = {
      cohort: [] as DimensionCounts[],
      author: [] as DimensionCounts[],
      ext: [] as DimensionCounts[],
      dir: [] as DimensionCounts[],
      domain: [] as DimensionCounts[],
    };

    for (let snapshotIndex = 0; snapshotIndex < sampledEvents.length; snapshotIndex += 1) {
      const mergedHistogram = createEmptyHistogram();

      for (const memberSnapshots of memberTotalsBySnapshot) {
        const histogram = memberSnapshots[snapshotIndex];
        mergeCounts(mergedHistogram.cohort, histogram?.cohort ?? {}, 1);
        mergeCounts(mergedHistogram.author, histogram?.author ?? {}, 1);
        mergeCounts(mergedHistogram.ext, histogram?.ext ?? {}, 1);
        mergeCounts(mergedHistogram.dir, histogram?.dir ?? {}, 1);
        mergeCounts(mergedHistogram.domain, histogram?.domain ?? {}, 1);
      }

      snapshotTotals.cohort.push({ ...mergedHistogram.cohort });
      snapshotTotals.author.push({ ...mergedHistogram.author });
      snapshotTotals.ext.push({ ...mergedHistogram.ext });
      snapshotTotals.dir.push({ ...mergedHistogram.dir });
      snapshotTotals.domain.push({ ...mergedHistogram.domain });
    }

    const snapshots: EvolutionSnapshotPoint[] = sampledEvents.map((event) => ({
      commitSha: event.sha,
      commitIndex: event.globalIndex,
      totalCommitCount: event.totalEventCount,
      committedAt: new Date(event.timestamp * 1000).toISOString(),
      samplingMode: event.samplingMode,
    }));

    emitProgress({
      phase: 'Finalizing evolution data',
      progress: 95,
      stage: 'finalizing',
      totalRepositories,
      totalSnapshots: sampledEvents.length,
    });

    return normalizeEvolutionResult({
      generatedAt: new Date().toISOString(),
      targetId: this.target.id,
      historyMode: this.target.members.length === 1 ? 'singleBranch' : 'mergedMembers',
      revisionHash: createEvolutionRevisionHash(memberHeads),
      settingsHash: this.createSettingsHash(),
      memberHeads,
      cohorts: toEvolutionSeries(snapshots, snapshotTotals.cohort),
      authors: toEvolutionSeries(snapshots, snapshotTotals.author),
      extensions: toEvolutionSeries(snapshots, snapshotTotals.ext),
      directories: toEvolutionSeries(snapshots, snapshotTotals.dir),
      domains: toEvolutionSeries(snapshots, snapshotTotals.domain),
      diagnostics: {
        expectedBlameMisses: runtimes.reduce((sum, runtime) => sum + runtime.expectedBlameMisses, 0),
      },
    });
  }

  private mergeEvents(
    memberHeads: MemberHeadInfo[],
    commitHistories: MemberCommit[][]
  ): TargetSnapshotEvent[] {
    const events = commitHistories.flatMap((commits, memberIndex) =>
      commits.map((commit) => ({
        repositoryId: memberHeads[memberIndex].repositoryId,
        repositoryName: memberHeads[memberIndex].repositoryName,
        branch: memberHeads[memberIndex].branch,
        sha: commit.sha,
        timestamp: commit.timestamp,
        globalIndex: -1,
        totalEventCount: 0,
        samplingMode: 'time' as const,
      }))
    );

    events.sort((a, b) =>
      a.timestamp - b.timestamp ||
      a.repositoryId.localeCompare(b.repositoryId) ||
      a.sha.localeCompare(b.sha)
    );

    for (let index = 0; index < events.length; index += 1) {
      events[index].globalIndex = index;
      events[index].totalEventCount = events.length;
    }

    for (const commits of commitHistories) {
      for (const commit of commits) {
        const globalIndex = events.findIndex(
          (event) => event.sha === commit.sha && event.timestamp === commit.timestamp
        );
        commit.globalIndex = globalIndex;
      }
    }

    return events;
  }

  private sampleEvents(
    allEvents: TargetSnapshotEvent[],
    onProgress: EvolutionProgressCallback | undefined,
    totalRepositories: number
  ): TargetSnapshotEvent[] {
    return sampleHistoryEntries(allEvents, {
      samplingMode: this.settings.evolution.samplingMode,
      maxSnapshots: this.settings.evolution.maxSnapshots,
      intervalDays: this.settings.evolution.snapshotIntervalDays,
      mark: (event, samplingMode) => ({
        ...event,
        samplingMode,
      }),
      getEntryKey: (event) => `${event.repositoryId}:${event.sha}`,
      onAutoDistribute: () => {
        onProgress?.({
          phase: 'Auto-distributing snapshots',
          progress: 4,
          stage: 'sampling',
          totalRepositories,
        });
      },
      onDownsample: (selectedCount) => {
        onProgress?.({
          phase: 'Downsampling snapshots',
          progress: 4,
          stage: 'sampling',
          totalRepositories,
          totalSnapshots: selectedCount,
        });
      },
    });
  }

  private selectMemberCommitsForSnapshots(
    memberCommits: MemberCommit[],
    sampledEvents: TargetSnapshotEvent[]
  ): Array<MemberCommit | null> {
    const selected: Array<MemberCommit | null> = [];
    let memberIndex = -1;

    for (const event of sampledEvents) {
      while (
        memberIndex + 1 < memberCommits.length &&
        memberCommits[memberIndex + 1].globalIndex <= event.globalIndex
      ) {
        memberIndex += 1;
      }

      selected.push(memberIndex >= 0 ? memberCommits[memberIndex] : null);
    }

    return selected;
  }

  private createSettingsHash(): string {
    const payload = JSON.stringify(createEvolutionAnalysisSettingsSnapshot(this.settings));
    return crypto.createHash('sha1').update(payload).digest('hex').slice(0, 16);
  }
}

function estimateEtaSeconds(startedAt: number, progress: number): number | undefined {
  if (progress <= 0 || progress >= 100) {
    return undefined;
  }

  const elapsedSeconds = Math.max(1, Math.round((Date.now() - startedAt) / 1000));
  const remainingProgress = 100 - progress;
  return Math.max(1, Math.round((elapsedSeconds / progress) * remainingProgress));
}

export function createTargetEvolutionAnalyzer(
  target: AnalysisTarget,
  settings: ExtensionSettings
): TargetEvolutionAnalyzer {
  return new TargetEvolutionAnalyzer(target, settings);
}
