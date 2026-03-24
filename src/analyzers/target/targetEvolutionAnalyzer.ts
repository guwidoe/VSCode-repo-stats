import * as crypto from 'crypto';
import * as os from 'os';
import * as path from 'path';
import simpleGit, { type SimpleGit } from 'simple-git';
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
  cloneHistogram,
  createEmptyHistogram,
  formatCohort,
  getTopDirectory,
  incrementCount,
  isExpectedBlameMiss,
  mergeCounts,
  mergeHistogram,
  parseHistoryLog,
  sampleHistoryEntries,
  toEvolutionSeries,
  type DimensionCounts,
  type EvolutionFileHistogram,
} from '../evolution/shared.js';
import { normalizeExtensionForFilter } from '../locCounter.js';
import { createPathPatternMatcher } from '../pathMatching.js';

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

interface MemberEvolutionProgress {
  completedSnapshots: number;
  totalSnapshots: number;
}

interface MemberCommit {
  sha: string;
  timestamp: number;
  commitIndex: number;
  totalCommitCount: number;
  branch: string;
  globalIndex: number;
}

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

interface DiffStatusEntry {
  oldPath?: string;
  newPath?: string;
}

interface BlameHunkMeta {
  lines: number;
  author: string;
  email: string;
  authorTime: number;
  applied: boolean;
}

interface MemberHeadInfo {
  repositoryId: string;
  repositoryName: string;
  branch: string;
  headSha: string;
}

const UNKNOWN_AUTHOR = 'Unknown';
const UNKNOWN_EMAIL = 'unknown@unknown.local';
const EMPTY_EXT = '[no-ext]';

class MemberEvolutionRuntime {
  readonly git: SimpleGit;
  readonly shouldExcludePath: (filePath: string) => boolean;
  readonly binaryExtensions: Set<string>;
  readonly directoryBucketPrefix: string | null;
  expectedBlameMisses = 0;

  constructor(
    readonly member: AnalysisTarget['members'][number],
    readonly settings: ExtensionSettings
  ) {
    this.git = simpleGit(member.repoPath);
    this.shouldExcludePath = createPathPatternMatcher([
      ...settings.excludePatterns,
      ...(member.excludePatterns ?? []),
    ]);
    this.binaryExtensions = new Set(
      settings.binaryExtensions
        .map((extension) => normalizeExtensionForFilter(extension))
        .filter((extension): extension is string => extension !== null)
    );
    this.directoryBucketPrefix = member.pathPrefix ? `${member.pathPrefix}/` : null;
  }

  async getHeadInfo(): Promise<MemberHeadInfo> {
    const [branchRaw, headShaRaw] = await Promise.all([
      this.git.revparse(['--abbrev-ref', 'HEAD']),
      this.git.revparse(['HEAD']),
    ]);

    return {
      repositoryId: this.member.id,
      repositoryName: this.member.displayName,
      branch: branchRaw.trim(),
      headSha: headShaRaw.trim(),
    };
  }

  async getCommitHistory(branch: string): Promise<MemberCommit[]> {
    const rawLog = await this.git.raw([
      'log',
      '--first-parent',
      '--reverse',
      '--format=%H|%ct',
      branch,
    ]);

    const parsedCommits = parseHistoryLog(rawLog);

    const totalCommitCount = parsedCommits.length;

    return parsedCommits.map((commit, index) => ({
      ...commit,
      commitIndex: index,
      totalCommitCount,
      branch,
      globalIndex: -1,
    }));
  }

  async analyzeCommits(
    commits: MemberCommit[],
    onProgress?: (progress: MemberEvolutionProgress) => void
  ): Promise<Map<string, EvolutionFileHistogram>> {
    const totalsBySha = new Map<string, EvolutionFileHistogram>();
    if (commits.length === 0) {
      return totalsBySha;
    }

    let previousCommit: MemberCommit | null = null;
    const fileHistograms = new Map<string, EvolutionFileHistogram>();
    const runningTotals = createEmptyHistogram();

    for (let commitIndex = 0; commitIndex < commits.length; commitIndex += 1) {
      const commit = commits[commitIndex];
      const changedPaths: string[] = [];

      if (!previousCommit) {
        const initialPaths = await this.getTrackedPathsAtCommit(commit.sha);
        for (const filePath of initialPaths) {
          changedPaths.push(filePath);
        }
      } else {
        const diffEntries = await this.getDiffStatusBetweenCommits(previousCommit.sha, commit.sha);

        for (const diff of diffEntries) {
          if (diff.oldPath && diff.oldPath !== diff.newPath) {
            const removedHistogram = fileHistograms.get(diff.oldPath);
            if (removedHistogram) {
              mergeHistogram(runningTotals, removedHistogram, -1);
              fileHistograms.delete(diff.oldPath);
            }
          }

          if (diff.newPath) {
            if (this.shouldAnalyzeFile(diff.newPath)) {
              changedPaths.push(diff.newPath);
            } else {
              const removedHistogram = fileHistograms.get(diff.newPath);
              if (removedHistogram) {
                mergeHistogram(runningTotals, removedHistogram, -1);
                fileHistograms.delete(diff.newPath);
              }
            }
          }
        }
      }

      const maxFilesPerSnapshot = 500;
      const deduplicatedChangedPaths = Array.from(new Set(changedPaths));
      const selectedChangedPaths = deduplicatedChangedPaths.slice(0, maxFilesPerSnapshot);
      const updatedHistograms = await this.computeHistogramsForFiles(
        selectedChangedPaths,
        commit.sha,
        commit.timestamp
      );

      for (const [filePath, histogram] of updatedHistograms) {
        const existing = fileHistograms.get(filePath);
        if (existing) {
          mergeHistogram(runningTotals, existing, -1);
        }

        fileHistograms.set(filePath, histogram);
        mergeHistogram(runningTotals, histogram, 1);
      }

      totalsBySha.set(commit.sha, cloneHistogram(runningTotals));
      previousCommit = commit;
      onProgress?.({
        completedSnapshots: commitIndex + 1,
        totalSnapshots: commits.length,
      });
    }

    return totalsBySha;
  }

  private async getTrackedPathsAtCommit(commitSha: string): Promise<string[]> {
    const output = await this.git.raw(['ls-tree', '-r', '--name-only', commitSha]);
    return output
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .filter((line) => this.shouldAnalyzeFile(line));
  }

  private async getDiffStatusBetweenCommits(previousSha: string, currentSha: string): Promise<DiffStatusEntry[]> {
    const output = await this.git.raw([
      'diff-tree',
      '--no-commit-id',
      '--name-status',
      '-r',
      previousSha,
      currentSha,
    ]);

    const entries: DiffStatusEntry[] = [];

    for (const line of output.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed) {
        continue;
      }

      const parts = trimmed.split('\t');
      if (parts.length < 2) {
        continue;
      }

      const status = parts[0];

      if (status.startsWith('R') || status.startsWith('C')) {
        if (parts.length >= 3) {
          entries.push({ oldPath: parts[1], newPath: parts[2] });
        }
        continue;
      }

      if (status === 'D') {
        entries.push({ oldPath: parts[1] });
        continue;
      }

      entries.push({ oldPath: parts[1], newPath: parts[1] });
    }

    return entries;
  }

  private shouldAnalyzeFile(filePath: string): boolean {
    const normalizedPath = filePath.replace(/\\/g, '/');

    const ext = path.extname(normalizedPath).toLowerCase();
    if (ext && this.binaryExtensions.has(ext)) {
      return false;
    }

    if (this.shouldExcludePath(normalizedPath)) {
      return false;
    }

    return true;
  }

  private async computeHistogramsForFiles(
    paths: string[],
    commitSha: string,
    defaultTimestamp: number
  ): Promise<Map<string, EvolutionFileHistogram>> {
    const result = new Map<string, EvolutionFileHistogram>();
    const cpuCount = os.cpus().length;
    const concurrency = Math.max(2, Math.min(12, cpuCount));
    let index = 0;

    const workers = Array.from({ length: Math.min(concurrency, paths.length) }, async () => {
      while (index < paths.length) {
        const currentIndex = index;
        index += 1;

        const filePath = paths[currentIndex];
        const histogram = await this.computeFileHistogram(filePath, commitSha, defaultTimestamp);
        result.set(filePath, histogram);
      }
    });

    await Promise.all(workers);
    return result;
  }

  private async computeFileHistogram(
    filePath: string,
    commitSha: string,
    defaultTimestamp: number
  ): Promise<EvolutionFileHistogram> {
    const histogram = createEmptyHistogram();

    let blameOutput = '';
    try {
      blameOutput = await this.git.raw([
        'blame',
        commitSha,
        '--line-porcelain',
        '--',
        filePath,
      ]);
    } catch (error) {
      if (isExpectedBlameMiss(error)) {
        this.expectedBlameMisses += 1;
        return histogram;
      }

      const detail = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to run git blame for ${filePath} at ${commitSha}: ${detail}`);
    }

    const ext = path.extname(filePath) || EMPTY_EXT;
    const topDir = this.directoryBucketPrefix ?? getTopDirectory(filePath);

    let current: BlameHunkMeta | null = null;

    const applyCurrent = () => {
      if (!current || current.applied) {
        return;
      }

      const author = current.author || UNKNOWN_AUTHOR;
      const email = current.email || UNKNOWN_EMAIL;
      const domain = email.includes('@') ? email.split('@').pop() || 'unknown.local' : 'unknown.local';
      const timestamp = current.authorTime > 0 ? current.authorTime : defaultTimestamp;
      const cohort = formatCohort(timestamp, this.settings.evolution.cohortFormat);
      const lines = current.lines;

      incrementCount(histogram.cohort, cohort, lines);
      incrementCount(histogram.author, author, lines);
      incrementCount(histogram.ext, ext, lines);
      incrementCount(histogram.dir, topDir, lines);
      incrementCount(histogram.domain, domain, lines);

      current.applied = true;
    };

    for (const line of blameOutput.split('\n')) {
      const headerMatch = line.match(/^([0-9a-f]{40})\s+\d+\s+\d+\s+(\d+)$/);
      if (headerMatch) {
        applyCurrent();
        current = {
          lines: parseInt(headerMatch[2], 10),
          author: UNKNOWN_AUTHOR,
          email: UNKNOWN_EMAIL,
          authorTime: defaultTimestamp,
          applied: false,
        };
        continue;
      }

      if (!current) {
        continue;
      }

      if (line.startsWith('author ')) {
        current.author = line.slice(7).trim() || UNKNOWN_AUTHOR;
        continue;
      }

      if (line.startsWith('author-mail ')) {
        const rawEmail = line.slice(12).trim();
        current.email = rawEmail.replace(/^</, '').replace(/>$/, '') || UNKNOWN_EMAIL;
        continue;
      }

      if (line.startsWith('author-time ')) {
        const ts = parseInt(line.slice(12).trim(), 10);
        if (Number.isFinite(ts)) {
          current.authorTime = ts;
        }
        continue;
      }

      if (line.startsWith('\t')) {
        applyCurrent();
      }
    }

    applyCurrent();
    return histogram;
  }

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
      commitInterval: this.settings.evolution.snapshotIntervalCommits,
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
