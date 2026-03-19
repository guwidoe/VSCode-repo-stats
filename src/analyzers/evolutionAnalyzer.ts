/**
 * Evolution Analyzer - On-demand blame-based repository evolution analysis.
 * This module has NO VSCode dependencies and is fully testable.
 */

import * as crypto from 'crypto';
import * as os from 'os';
import * as path from 'path';
import simpleGit from 'simple-git';
import {
  EvolutionResult,
  EvolutionSamplingMode,
  EvolutionSnapshotPoint,
  EvolutionTimeSeriesData,
  ExtensionSettings,
  NotAGitRepoError,
} from '../types/index.js';
import { createEvolutionAnalysisSettingsSnapshot } from '../shared/settings.js';
import { normalizeExtensionForFilter } from './locCounter.js';
import { createPathPatternMatcher } from './pathMatching.js';

export type EvolutionProgressCallback = (phase: string, progress: number) => void;

type DimensionCounts = Record<string, number>;

interface FileHistogram {
  cohort: DimensionCounts;
  author: DimensionCounts;
  ext: DimensionCounts;
  dir: DimensionCounts;
  domain: DimensionCounts;
}

interface SnapshotCommit {
  sha: string;
  timestamp: number;
  commitIndex: number;
  totalCommitCount: number;
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

const UNKNOWN_AUTHOR = 'Unknown';
const UNKNOWN_EMAIL = 'unknown@unknown.local';
const ROOT_DIR = '[root]';
const EMPTY_EXT = '[no-ext]';

export interface EvolutionGitClient {
  checkIsRepo(): Promise<boolean>;
  revparse(args: string[]): Promise<string>;
  raw(args: string[]): Promise<string>;
}

export class EvolutionAnalyzer {
  private readonly git: EvolutionGitClient;
  private readonly repoPath: string;
  private readonly settings: ExtensionSettings;
  private readonly shouldExcludePath: (filePath: string) => boolean;
  private readonly binaryExtensions: Set<string>;
  private expectedBlameMisses = 0;

  constructor(repoPath: string, settings: ExtensionSettings, gitClient?: EvolutionGitClient) {
    this.repoPath = repoPath;
    this.settings = settings;
    this.git = gitClient ?? simpleGit(repoPath);
    this.shouldExcludePath = createPathPatternMatcher(settings.excludePatterns);
    this.binaryExtensions = new Set(
      settings.binaryExtensions
        .map((extension) => normalizeExtensionForFilter(extension))
        .filter((extension): extension is string => extension !== null)
    );
  }

  async analyze(onProgress?: EvolutionProgressCallback): Promise<EvolutionResult> {
    this.expectedBlameMisses = 0;

    const isRepo = await this.git.checkIsRepo();
    if (!isRepo) {
      throw new NotAGitRepoError(this.repoPath);
    }

    onProgress?.('Preparing evolution analysis', 0);

    const [branchRaw, headShaRaw] = await Promise.all([
      this.git.revparse(['--abbrev-ref', 'HEAD']),
      this.git.revparse(['HEAD']),
    ]);

    const branch = branchRaw.trim();
    const headSha = headShaRaw.trim();

    const commits = await this.getSampledCommits(branch, onProgress);

    const snapshotTotals = {
      cohort: [] as DimensionCounts[],
      author: [] as DimensionCounts[],
      ext: [] as DimensionCounts[],
      dir: [] as DimensionCounts[],
      domain: [] as DimensionCounts[],
    };
    const snapshotPoints: EvolutionSnapshotPoint[] = [];

    let previousCommit: SnapshotCommit | null = null;
    const fileHistograms = new Map<string, FileHistogram>();
    const runningTotals = this.createEmptyHistogram();

    for (let i = 0; i < commits.length; i++) {
      const commit = commits[i];
      const progress = 5 + Math.round(((i + 1) / commits.length) * 90);
      onProgress?.(
        `Analyzing snapshot ${i + 1}/${commits.length} (${commit.sha.slice(0, 8)})`,
        progress
      );

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

      previousCommit = commit;
      snapshotPoints.push({
        commitSha: commit.sha,
        commitIndex: commit.commitIndex,
        totalCommitCount: commit.totalCommitCount,
        committedAt: new Date(commit.timestamp * 1000).toISOString(),
        samplingMode: commit.samplingMode,
      });
      snapshotTotals.cohort.push({ ...runningTotals.cohort });
      snapshotTotals.author.push({ ...runningTotals.author });
      snapshotTotals.ext.push({ ...runningTotals.ext });
      snapshotTotals.dir.push({ ...runningTotals.dir });
      snapshotTotals.domain.push({ ...runningTotals.domain });
    }

    onProgress?.('Finalizing evolution data', 98);

    const settingsHash = this.createSettingsHash();

    const result: EvolutionResult = {
      generatedAt: new Date().toISOString(),
      targetId: this.repoPath,
      historyMode: 'singleBranch',
      revisionHash: this.createRevisionHash(branch, headSha),
      settingsHash,
      memberHeads: [
        {
          repositoryId: this.repoPath,
          repositoryName: path.basename(this.repoPath),
          branch,
          headSha,
        },
      ],
      cohorts: this.toSeries(snapshotPoints, snapshotTotals.cohort),
      authors: this.toSeries(snapshotPoints, snapshotTotals.author),
      exts: this.toSeries(snapshotPoints, snapshotTotals.ext),
      dirs: this.toSeries(snapshotPoints, snapshotTotals.dir),
      domains: this.toSeries(snapshotPoints, snapshotTotals.domain),
      diagnostics: {
        expectedBlameMisses: this.expectedBlameMisses,
      },
    };

    onProgress?.('Evolution analysis complete', 100);

    return result;
  }

  private async getSampledCommits(
    branch: string,
    onProgress?: EvolutionProgressCallback
  ): Promise<SnapshotCommit[]> {
    onProgress?.('Collecting commit history', 2);

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
    const allCommits = parsedCommits.map((commit, index) => ({
      ...commit,
      commitIndex: index,
      totalCommitCount,
      samplingMode: 'time' as const,
    }));

    if (allCommits.length === 0) {
      return [];
    }

    const samplingMode = this.settings.evolution.samplingMode;
    const maxSnapshots = Math.max(2, this.settings.evolution.maxSnapshots);

    if (samplingMode === 'auto') {
      onProgress?.('Auto-distributing snapshots', 4);
      return this.downsampleSnapshots(
        allCommits.map((commit) => ({ ...commit, samplingMode: 'auto' })),
        maxSnapshots
      );
    }

    if (samplingMode === 'commit') {
      const commitInterval = Math.max(1, this.settings.evolution.snapshotIntervalCommits);
      const commitSampled: SnapshotCommit[] = [];

      for (let i = 0; i < allCommits.length; i += commitInterval) {
        commitSampled.push({
          ...allCommits[i],
          samplingMode: 'commit',
        });
      }

      const lastCommit = allCommits[allCommits.length - 1];
      if (commitSampled[commitSampled.length - 1]?.sha !== lastCommit.sha) {
        commitSampled.push({
          ...lastCommit,
          samplingMode: 'commit',
        });
      }

      return commitSampled.length <= maxSnapshots
        ? commitSampled
        : this.downsampleSnapshots(commitSampled, maxSnapshots);
    }

    const intervalSeconds = Math.max(1, this.settings.evolution.snapshotIntervalDays) * 24 * 60 * 60;
    const intervalSampled: SnapshotCommit[] = [];

    intervalSampled.push({
      ...allCommits[0],
      samplingMode: 'time',
    });
    let lastTimestamp = allCommits[0].timestamp;

    for (let i = 1; i < allCommits.length; i++) {
      const commit = allCommits[i];
      if (commit.timestamp >= lastTimestamp + intervalSeconds) {
        intervalSampled.push({
          ...commit,
          samplingMode: 'time',
        });
        lastTimestamp = commit.timestamp;
      }
    }

    const lastCommit = allCommits[allCommits.length - 1];
    if (intervalSampled[intervalSampled.length - 1].sha !== lastCommit.sha) {
      intervalSampled.push({
        ...lastCommit,
        samplingMode: 'time',
      });
    }

    if (intervalSampled.length <= maxSnapshots) {
      return intervalSampled;
    }

    onProgress?.('Downsampling snapshots', 4);
    return this.downsampleSnapshots(intervalSampled, maxSnapshots);
  }

  private downsampleSnapshots(
    snapshots: SnapshotCommit[],
    maxSnapshots: number
  ): SnapshotCommit[] {
    if (snapshots.length <= maxSnapshots) {
      return snapshots;
    }

    const downsampled: SnapshotCommit[] = [];
    const maxIndex = snapshots.length - 1;
    const step = maxIndex / (maxSnapshots - 1);
    let lastAddedSha = '';

    for (let i = 0; i < maxSnapshots; i++) {
      const index = Math.round(i * step);
      const commit = snapshots[index];
      if (commit && commit.sha !== lastAddedSha) {
        downsampled.push(commit);
        lastAddedSha = commit.sha;
      }
    }

    const lastCommit = snapshots[snapshots.length - 1];
    if (downsampled[downsampled.length - 1]?.sha !== lastCommit.sha) {
      downsampled.push(lastCommit);
    }

    return downsampled;
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
    const topDir = getTopDirectory(filePath);

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

  private createRevisionHash(branch: string, headSha: string): string {
    const payload = JSON.stringify({ branch, headSha, repoPath: this.repoPath });
    return crypto.createHash('sha1').update(payload).digest('hex').slice(0, 16);
  }
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

export function createEvolutionAnalyzer(
  repoPath: string,
  settings: ExtensionSettings,
  gitClient?: EvolutionGitClient
): EvolutionAnalyzer {
  return new EvolutionAnalyzer(repoPath, settings, gitClient);
}
