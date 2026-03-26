import * as os from 'os';
import * as path from 'path';
import simpleGit, { type SimpleGit } from 'simple-git';
import { AnalyzerExecutionError, type AnalysisTarget, type ExtensionSettings } from '../../types/index.js';
import {
  cloneHistogram,
  createEmptyHistogram,
  formatCohort,
  getTopDirectory,
  incrementCount,
  isExpectedBlameMiss,
  mergeHistogram,
  parseHistoryLog,
  type EvolutionFileHistogram,
} from '../evolution/shared.js';
import { parseBlameStream } from '../blameStream.js';
import { throwIfCancelled } from '../cancellation.js';
import { normalizeExtensionForFilter } from '../locCounter.js';
import { createPathPatternMatcher } from '../pathMatching.js';

interface DiffStatusEntry {
  oldPath?: string;
  newPath?: string;
}

export interface MemberEvolutionProgress {
  completedSnapshots: number;
  totalSnapshots: number;
}

export interface MemberCommit {
  sha: string;
  timestamp: number;
  commitIndex: number;
  totalCommitCount: number;
  branch: string;
  globalIndex: number;
}

export interface MemberHeadInfo {
  repositoryId: string;
  repositoryName: string;
  branch: string;
  headSha: string;
}

const UNKNOWN_AUTHOR = 'Unknown';
const UNKNOWN_EMAIL = 'unknown@unknown.local';
const EMPTY_EXT = '[no-ext]';

export class MemberEvolutionRuntime {
  readonly git: SimpleGit;
  readonly shouldExcludePath: (filePath: string) => boolean;
  readonly binaryExtensions: Set<string>;
  readonly directoryBucketPrefix: string | null;
  expectedBlameMisses = 0;

  constructor(
    readonly member: AnalysisTarget['members'][number],
    readonly settings: ExtensionSettings,
    private readonly signal?: AbortSignal
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
    throwIfCancelled(this.signal);

    const [branchRaw, headShaRaw] = await Promise.all([
      this.git.revparse(['--abbrev-ref', 'HEAD']),
      this.git.revparse(['HEAD']),
    ]);

    throwIfCancelled(this.signal);

    return {
      repositoryId: this.member.id,
      repositoryName: this.member.displayName,
      branch: branchRaw.trim(),
      headSha: headShaRaw.trim(),
    };
  }

  async getCommitHistory(branch: string): Promise<MemberCommit[]> {
    throwIfCancelled(this.signal);

    const rawLog = await this.git.raw([
      'log',
      '--first-parent',
      '--reverse',
      '--format=%H|%ct',
      branch,
    ]);

    throwIfCancelled(this.signal);

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
    throwIfCancelled(this.signal);

    const totalsBySha = new Map<string, EvolutionFileHistogram>();
    if (commits.length === 0) {
      return totalsBySha;
    }

    let previousCommit: MemberCommit | null = null;
    const fileHistograms = new Map<string, EvolutionFileHistogram>();
    const runningTotals = createEmptyHistogram();

    for (let commitIndex = 0; commitIndex < commits.length; commitIndex += 1) {
      throwIfCancelled(this.signal);

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

      const selectedChangedPaths = Array.from(new Set(changedPaths)).slice(0, 500);
      const updatedHistograms = await this.computeHistogramsForFiles(
        selectedChangedPaths,
        commit.sha,
        commit.timestamp
      );

      throwIfCancelled(this.signal);

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

    return !this.shouldExcludePath(normalizedPath);
  }

  private async computeHistogramsForFiles(
    paths: string[],
    commitSha: string,
    defaultTimestamp: number
  ): Promise<Map<string, EvolutionFileHistogram>> {
    throwIfCancelled(this.signal);

    const result = new Map<string, EvolutionFileHistogram>();
    const concurrency = Math.max(2, Math.min(12, os.cpus().length));
    let index = 0;

    const workers = Array.from({ length: Math.min(concurrency, paths.length) }, async () => {
      while (index < paths.length) {
        throwIfCancelled(this.signal);

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
    throwIfCancelled(this.signal);

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
      throwIfCancelled(this.signal);
    } catch (error) {
      if (isExpectedBlameMiss(error)) {
        this.expectedBlameMisses += 1;
        return histogram;
      }

      const detail = error instanceof Error ? error.message : String(error);
      throw new AnalyzerExecutionError(
        `Failed to run git blame for ${filePath} at ${commitSha}: ${detail}`,
        'EVOLUTION_BLAME_FAILED',
        { cause: error }
      );
    }

    const ext = path.extname(filePath) || EMPTY_EXT;
    const topDir = this.directoryBucketPrefix ?? getTopDirectory(filePath);
    const hunks = parseBlameStream(blameOutput, {
      defaultAuthor: UNKNOWN_AUTHOR,
      defaultEmail: UNKNOWN_EMAIL,
      defaultAuthorTime: defaultTimestamp,
    });

    for (const hunk of hunks) {
      const author = hunk.author;
      const email = hunk.email;
      const domain = email.includes('@') ? email.split('@').pop() || 'unknown.local' : 'unknown.local';
      const timestamp = hunk.authorTime;
      const cohort = formatCohort(timestamp, this.settings.evolution.cohortFormat);
      const lines = hunk.lines;

      incrementCount(histogram.cohort, cohort, lines);
      incrementCount(histogram.author, author, lines);
      incrementCount(histogram.ext, ext, lines);
      incrementCount(histogram.dir, topDir, lines);
      incrementCount(histogram.domain, domain, lines);
    }
    return histogram;
  }
}
