import * as crypto from 'crypto';
import * as os from 'os';
import * as path from 'path';
import simpleGit, { type SimpleGit } from 'simple-git';
import type {
  AnalysisTarget,
  EvolutionResult,
  EvolutionSamplingMode,
  EvolutionSnapshotPoint,
  EvolutionTimeSeriesData,
  ExtensionSettings,
} from '../types/index.js';
import { createEvolutionRevisionHash } from '../cache/targetCacheKeys.js';
import { createEvolutionAnalysisSettingsSnapshot } from '../shared/settings.js';
import { normalizeExtensionForFilter } from './locCounter.js';
import { createPathPatternMatcher } from './pathMatching.js';

export type EvolutionProgressCallback = (phase: string, progress: number) => void;

interface MemberEvolutionProgress {
  completedSnapshots: number;
  totalSnapshots: number;
}

type DimensionCounts = Record<string, number>;

interface FileHistogram {
  cohort: DimensionCounts;
  author: DimensionCounts;
  ext: DimensionCounts;
  dir: DimensionCounts;
  domain: DimensionCounts;
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
const ROOT_DIR = '[root]';
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

    const parsedCommits = rawLog
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .map((line) => {
        const [sha, tsRaw] = line.split('|');
        return { sha, timestamp: parseInt(tsRaw, 10) };
      })
      .filter((entry) => Boolean(entry.sha) && Number.isFinite(entry.timestamp));

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
  ): Promise<Map<string, FileHistogram>> {
    const totalsBySha = new Map<string, FileHistogram>();
    if (commits.length === 0) {
      return totalsBySha;
    }

    let previousCommit: MemberCommit | null = null;
    const fileHistograms = new Map<string, FileHistogram>();
    const runningTotals = this.createEmptyHistogram();

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
              this.mergeHistogram(runningTotals, removedHistogram, -1);
              fileHistograms.delete(diff.oldPath);
            }
          }

          if (diff.newPath) {
            if (this.shouldAnalyzeFile(diff.newPath)) {
              changedPaths.push(diff.newPath);
            } else {
              const removedHistogram = fileHistograms.get(diff.newPath);
              if (removedHistogram) {
                this.mergeHistogram(runningTotals, removedHistogram, -1);
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
          this.mergeHistogram(runningTotals, existing, -1);
        }

        fileHistograms.set(filePath, histogram);
        this.mergeHistogram(runningTotals, histogram, 1);
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
  ): Promise<Map<string, FileHistogram>> {
    const result = new Map<string, FileHistogram>();
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
  ): Promise<FileHistogram> {
    const histogram = this.createEmptyHistogram();

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

  private createEmptyHistogram(): FileHistogram {
    return {
      cohort: {},
      author: {},
      ext: {},
      dir: {},
      domain: {},
    };
  }

  private mergeHistogram(target: FileHistogram, source: FileHistogram, sign: 1 | -1): void {
    mergeCounts(target.cohort, source.cohort, sign);
    mergeCounts(target.author, source.author, sign);
    mergeCounts(target.ext, source.ext, sign);
    mergeCounts(target.dir, source.dir, sign);
    mergeCounts(target.domain, source.domain, sign);
  }
}

export class TargetEvolutionAnalyzer {
  constructor(
    private readonly target: AnalysisTarget,
    private readonly settings: ExtensionSettings
  ) {}

  async analyze(onProgress?: EvolutionProgressCallback): Promise<EvolutionResult> {
    onProgress?.('Preparing evolution analysis', 0);

    const runtimes = this.target.members.map((member) => new MemberEvolutionRuntime(member, this.settings));
    const memberHeads = await Promise.all(runtimes.map((runtime) => runtime.getHeadInfo()));
    const commitHistories = await Promise.all(
      runtimes.map(async (runtime, index) => runtime.getCommitHistory(memberHeads[index].branch))
    );

    const mergedEvents = this.mergeEvents(memberHeads, commitHistories);
    const sampledEvents = this.sampleEvents(mergedEvents, onProgress);
    onProgress?.(
      `Selected ${sampledEvents.length} snapshots across ${mergedEvents.length} history events`,
      8
    );

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
    const memberTotalsBySnapshot: FileHistogram[][] = [];

    for (let index = 0; index < memberSelections.length; index += 1) {
      const selection = memberSelections[index];
      const { runtime, selectedCommits, uniqueCommits } = selection;
      const memberOrdinal = `${index + 1}/${memberSelections.length}`;

      if (uniqueCommits.length === 0) {
        onProgress?.(
          `Repo ${memberOrdinal}: ${runtime.member.displayName} has no sampled snapshots to analyze`,
          totalSnapshotWork === 0 ? 90 : 10 + Math.round((completedSnapshotWork / totalSnapshotWork) * 80)
        );
        memberTotalsBySnapshot.push(sampledEvents.map(() => createEmptyHistogram()));
        continue;
      }

      const totalsBySha = await runtime.analyzeCommits(uniqueCommits, ({ completedSnapshots, totalSnapshots }) => {
        const overallProgress = totalSnapshotWork === 0
          ? 90
          : 10 + Math.round(((completedSnapshotWork + completedSnapshots) / totalSnapshotWork) * 80);
        onProgress?.(
          `Repo ${memberOrdinal}: ${runtime.member.displayName} — snapshot ${completedSnapshots}/${totalSnapshots}`,
          overallProgress
        );
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

    onProgress?.('Finalizing evolution data', 95);

    return {
      generatedAt: new Date().toISOString(),
      targetId: this.target.id,
      historyMode: this.target.members.length === 1 ? 'singleBranch' : 'mergedMembers',
      revisionHash: createEvolutionRevisionHash(memberHeads),
      settingsHash: this.createSettingsHash(),
      memberHeads,
      cohorts: this.toSeries(snapshots, snapshotTotals.cohort),
      authors: this.toSeries(snapshots, snapshotTotals.author),
      exts: this.toSeries(snapshots, snapshotTotals.ext),
      dirs: this.toSeries(snapshots, snapshotTotals.dir),
      domains: this.toSeries(snapshots, snapshotTotals.domain),
      diagnostics: {
        expectedBlameMisses: runtimes.reduce((sum, runtime) => sum + runtime.expectedBlameMisses, 0),
      },
    };
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
    onProgress?: EvolutionProgressCallback
  ): TargetSnapshotEvent[] {
    if (allEvents.length === 0) {
      return [];
    }

    const samplingMode = this.settings.evolution.samplingMode;
    const maxSnapshots = Math.max(2, this.settings.evolution.maxSnapshots);

    if (samplingMode === 'auto') {
      onProgress?.('Auto-distributing snapshots', 4);
      return this.downsampleEvents(
        allEvents.map((event) => ({ ...event, samplingMode: 'auto' })),
        maxSnapshots
      );
    }

    if (samplingMode === 'commit') {
      const commitInterval = Math.max(1, this.settings.evolution.snapshotIntervalCommits);
      const sampled: TargetSnapshotEvent[] = [];

      for (let index = 0; index < allEvents.length; index += commitInterval) {
        sampled.push({
          ...allEvents[index],
          samplingMode: 'commit',
        });
      }

      const lastEvent = allEvents[allEvents.length - 1];
      if (sampled[sampled.length - 1]?.sha !== lastEvent.sha) {
        sampled.push({
          ...lastEvent,
          samplingMode: 'commit',
        });
      }

      return sampled.length <= maxSnapshots ? sampled : this.downsampleEvents(sampled, maxSnapshots);
    }

    const intervalSeconds = Math.max(1, this.settings.evolution.snapshotIntervalDays) * 24 * 60 * 60;
    const sampled: TargetSnapshotEvent[] = [{ ...allEvents[0], samplingMode: 'time' }];
    let lastTimestamp = allEvents[0].timestamp;

    for (let index = 1; index < allEvents.length; index += 1) {
      const event = allEvents[index];
      if (event.timestamp >= lastTimestamp + intervalSeconds) {
        sampled.push({
          ...event,
          samplingMode: 'time',
        });
        lastTimestamp = event.timestamp;
      }
    }

    const lastEvent = allEvents[allEvents.length - 1];
    if (sampled[sampled.length - 1]?.sha !== lastEvent.sha) {
      sampled.push({
        ...lastEvent,
        samplingMode: 'time',
      });
    }

    if (sampled.length <= maxSnapshots) {
      return sampled;
    }

    onProgress?.('Downsampling snapshots', 4);
    return this.downsampleEvents(sampled, maxSnapshots);
  }

  private downsampleEvents(events: TargetSnapshotEvent[], maxSnapshots: number): TargetSnapshotEvent[] {
    if (events.length <= maxSnapshots) {
      return events;
    }

    const downsampled: TargetSnapshotEvent[] = [];
    const maxIndex = events.length - 1;
    const step = maxIndex / (maxSnapshots - 1);
    let lastAddedKey = '';

    for (let index = 0; index < maxSnapshots; index += 1) {
      const sourceIndex = Math.round(index * step);
      const event = events[sourceIndex];
      const eventKey = `${event.repositoryId}:${event.sha}`;
      if (event && eventKey !== lastAddedKey) {
        downsampled.push(event);
        lastAddedKey = eventKey;
      }
    }

    const lastEvent = events[events.length - 1];
    if (downsampled[downsampled.length - 1]?.sha !== lastEvent.sha) {
      downsampled.push(lastEvent);
    }

    return downsampled;
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

  private toSeries(
    snapshots: EvolutionSnapshotPoint[],
    countsBySnapshot: DimensionCounts[]
  ): EvolutionTimeSeriesData {
    const labelSet = new Set<string>();
    for (const snapshot of countsBySnapshot) {
      for (const label of Object.keys(snapshot)) {
        labelSet.add(label);
      }
    }

    const labels = Array.from(labelSet).sort((a, b) => a.localeCompare(b));
    const y = labels.map((label) => countsBySnapshot.map((snapshot) => snapshot[label] ?? 0));

    return {
      snapshots,
      ts: snapshots.map((snapshot) => snapshot.committedAt),
      labels,
      y,
    };
  }

  private createSettingsHash(): string {
    const payload = JSON.stringify(createEvolutionAnalysisSettingsSnapshot(this.settings));
    return crypto.createHash('sha1').update(payload).digest('hex').slice(0, 16);
  }
}

function createEmptyHistogram(): FileHistogram {
  return {
    cohort: {},
    author: {},
    ext: {},
    dir: {},
    domain: {},
  };
}

function cloneHistogram(histogram: FileHistogram): FileHistogram {
  return {
    cohort: { ...histogram.cohort },
    author: { ...histogram.author },
    ext: { ...histogram.ext },
    dir: { ...histogram.dir },
    domain: { ...histogram.domain },
  };
}

function incrementCount(target: DimensionCounts, label: string, value: number): void {
  if (!label) {
    return;
  }
  target[label] = (target[label] ?? 0) + value;
}

function mergeCounts(target: DimensionCounts, source: DimensionCounts, sign: 1 | -1): void {
  for (const [label, value] of Object.entries(source)) {
    const next = (target[label] ?? 0) + value * sign;
    if (next <= 0) {
      delete target[label];
    } else {
      target[label] = next;
    }
  }
}

function getTopDirectory(filePath: string): string {
  const normalized = filePath.replace(/\\/g, '/');
  const slashIndex = normalized.indexOf('/');
  if (slashIndex === -1) {
    return ROOT_DIR;
  }
  return normalized.slice(0, slashIndex + 1);
}

function formatCohort(unixSeconds: number, format: string): string {
  const date = new Date(unixSeconds * 1000);
  const year = date.getUTCFullYear();
  const month = `${date.getUTCMonth() + 1}`.padStart(2, '0');
  const day = `${date.getUTCDate()}`.padStart(2, '0');
  const week = `${getUtcWeekNumber(date)}`.padStart(2, '0');

  return format
    .replace(/%Y/g, `${year}`)
    .replace(/%m/g, month)
    .replace(/%d/g, day)
    .replace(/%W/g, week);
}

function getUtcWeekNumber(date: Date): number {
  const working = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNum = working.getUTCDay() || 7;
  working.setUTCDate(working.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(working.getUTCFullYear(), 0, 1));
  return Math.ceil((((working.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

function isExpectedBlameMiss(error: unknown): boolean {
  const message = (error instanceof Error ? error.message : String(error)).toLowerCase();

  return (
    message.includes('no such path') ||
    message.includes('no such file') ||
    message.includes('file not found') ||
    message.includes('no such ref')
  );
}

export function createTargetEvolutionAnalyzer(
  target: AnalysisTarget,
  settings: ExtensionSettings
): TargetEvolutionAnalyzer {
  return new TargetEvolutionAnalyzer(target, settings);
}
