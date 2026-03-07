/**
 * Git Analyzer - Pure business logic for git operations.
 * This module has NO VSCode dependencies and is fully testable.
 */

import simpleGit, { SimpleGit } from 'simple-git';
import {
  ContributorStats,
  CodeFrequency,
  RepositoryInfo,
  NotAGitRepoError,
  GitNotFoundError,
} from '../types/index.js';
import { createPathPatternMatcher } from './pathMatching.js';

// ============================================================================
// Interfaces for Dependency Injection
// ============================================================================

export interface GitClient {
  isRepo(): Promise<boolean>;
  getRepoInfo(): Promise<RepositoryInfo>;
  getContributorStats(maxCommits: number, excludePatterns?: string[]): Promise<ContributorStats[]>;
  getCodeFrequency(maxCommits: number, excludePatterns?: string[]): Promise<CodeFrequency[]>;
  getFileModificationDates(): Promise<Map<string, string>>;
  getTrackedFiles(): Promise<string[]>;
  getSubmodulePaths(): Promise<string[]>;
  getHeadBlobShas(paths?: string[]): Promise<Map<string, string>>;
  raw(args: string[]): Promise<string>;
}

interface ParsedCommitStat {
  date: string;
  name?: string;
  email?: string;
  additions: number;
  deletions: number;
  hasIncludedChanges: boolean;
  sawAnyFileStats: boolean;
}

// ============================================================================
// Git Analyzer Implementation
// ============================================================================

export class GitAnalyzer implements GitClient {
  private git: SimpleGit;
  private repoPath: string;

  constructor(repoPath: string) {
    this.repoPath = repoPath;
    this.git = simpleGit(repoPath);
  }

  async isRepo(): Promise<boolean> {
    try {
      return await this.git.checkIsRepo();
    } catch {
      return false;
    }
  }

  async getRepoInfo(): Promise<RepositoryInfo> {
    if (!(await this.isRepo())) {
      throw new NotAGitRepoError(this.repoPath);
    }

    try {
      const [branch, headSha, log] = await Promise.all([
        this.git.revparse(['--abbrev-ref', 'HEAD']),
        this.git.revparse(['HEAD']),
        this.git.log(['--oneline']),
      ]);

      const name = this.getRepositoryName();

      return {
        name,
        path: this.repoPath,
        branch: branch.trim(),
        commitCount: log.total,
        headSha: headSha.trim(),
      };
    } catch (error) {
      if (error instanceof Error && error.message.includes('not found')) {
        throw new GitNotFoundError();
      }
      throw error;
    }
  }

  async getContributorStats(
    maxCommits: number,
    excludePatterns: string[] = []
  ): Promise<ContributorStats[]> {
    if (!(await this.isRepo())) {
      throw new NotAGitRepoError(this.repoPath);
    }

    const commits = await this.getParsedCommitStats(maxCommits, true, excludePatterns);
    const contributorMap = new Map<string, ContributorStats>();

    for (const commit of commits) {
      if (!commit.email || !commit.name) {
        continue;
      }

      const key = commit.email.toLowerCase();
      if (!contributorMap.has(key)) {
        contributorMap.set(key, {
          name: commit.name,
          email: commit.email,
          commits: 0,
          linesAdded: 0,
          linesDeleted: 0,
          firstCommit: commit.date,
          lastCommit: commit.date,
          weeklyActivity: [],
        });
      }

      const contributor = contributorMap.get(key)!;
      contributor.commits++;
      contributor.linesAdded += commit.additions;
      contributor.linesDeleted += commit.deletions;

      if (commit.date < contributor.firstCommit) {
        contributor.firstCommit = commit.date;
      }
      if (commit.date > contributor.lastCommit) {
        contributor.lastCommit = commit.date;
      }

      const week = this.getISOWeek(new Date(commit.date));
      let weeklyEntry = contributor.weeklyActivity.find((entry) => entry.week === week);
      if (!weeklyEntry) {
        weeklyEntry = { week, commits: 0, additions: 0, deletions: 0 };
        contributor.weeklyActivity.push(weeklyEntry);
      }

      weeklyEntry.commits++;
      weeklyEntry.additions += commit.additions;
      weeklyEntry.deletions += commit.deletions;
    }

    const contributors = Array.from(contributorMap.values());
    contributors.sort((a, b) => b.commits - a.commits);

    for (const contributor of contributors) {
      contributor.weeklyActivity.sort((a, b) => a.week.localeCompare(b.week));
    }

    return contributors;
  }

  async getCodeFrequency(
    maxCommits: number,
    excludePatterns: string[] = []
  ): Promise<CodeFrequency[]> {
    if (!(await this.isRepo())) {
      throw new NotAGitRepoError(this.repoPath);
    }

    const commits = await this.getParsedCommitStats(maxCommits, false, excludePatterns);
    const weeklyMap = new Map<string, CodeFrequency>();

    for (const commit of commits) {
      const week = this.getISOWeek(new Date(commit.date));
      if (!weeklyMap.has(week)) {
        weeklyMap.set(week, {
          week,
          additions: 0,
          deletions: 0,
          netChange: 0,
        });
      }

      const entry = weeklyMap.get(week)!;
      entry.additions += commit.additions;
      entry.deletions += commit.deletions;
      entry.netChange = entry.additions - entry.deletions;
    }

    const frequency = Array.from(weeklyMap.values());
    frequency.sort((a, b) => a.week.localeCompare(b.week));

    return frequency;
  }

  /**
   * Get the last modification date from git history for all tracked files.
   * Returns a Map of relative file path -> ISO date string of last commit.
   */
  async getFileModificationDates(): Promise<Map<string, string>> {
    if (!(await this.isRepo())) {
      throw new NotAGitRepoError(this.repoPath);
    }

    const fileModDates = new Map<string, string>();

    // Get the last commit date for each file using git log with name-only
    // Format: date\n\nfile1\nfile2\n\ndate\n\nfile3\n...
    const rawLog = await this.git.raw([
      'log',
      '--all',
      '--format=%aI',
      '--name-only',
    ]);

    const lines = rawLog.split('\n');
    let currentDate: string | null = null;

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) {
        continue;
      }

      // Check if this is a date line (ISO format)
      if (trimmed.match(/^\d{4}-\d{2}-\d{2}T/)) {
        currentDate = trimmed;
      } else if (currentDate) {
        // This is a file path - only set if not already set (we want most recent)
        if (!fileModDates.has(trimmed)) {
          fileModDates.set(trimmed, currentDate);
        }
      }
    }

    return fileModDates;
  }

  /**
   * Get all tracked files in the repository.
   * Returns an array of relative file paths.
   */
  async getTrackedFiles(): Promise<string[]> {
    if (!(await this.isRepo())) {
      throw new NotAGitRepoError(this.repoPath);
    }

    const output = await this.git.raw(['ls-files']);
    return output
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);
  }

  /**
   * Get paths to all git submodules in the repository.
   * Returns an array of relative paths to submodule directories.
   */
  async getSubmodulePaths(): Promise<string[]> {
    if (!(await this.isRepo())) {
      throw new NotAGitRepoError(this.repoPath);
    }

    // git submodule status returns lines like:
    // " abc123 path/to/submodule (v1.0.0)"
    // or "-abc123 path/to/submodule" (not initialized)
    // or "+abc123 path/to/submodule" (different commit)
    const output = await this.git.raw(['submodule', 'status', '--recursive']);
    const paths: string[] = [];

    for (const line of output.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed) {
        continue;
      }

      // Extract path from submodule status line
      // Format: [+-]<sha> <path> [(<description>)]
      const match = trimmed.match(/^[+-]?\s*[a-f0-9]+\s+(\S+)/);
      if (match) {
        paths.push(match[1]);
      }
    }

    return paths;
  }

  async getHeadBlobShas(paths?: string[]): Promise<Map<string, string>> {
    if (!(await this.isRepo())) {
      throw new NotAGitRepoError(this.repoPath);
    }

    const filterSet = paths && paths.length > 0 ? new Set(paths) : null;
    const result = new Map<string, string>();

    try {
      const output = await this.git.raw(['ls-tree', '-r', '--full-tree', 'HEAD']);

      for (const line of output.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed) {
          continue;
        }

        const tabIndex = trimmed.indexOf('\t');
        if (tabIndex === -1) {
          continue;
        }

        const metadata = trimmed.slice(0, tabIndex);
        const filePath = trimmed.slice(tabIndex + 1);
        if (!filePath) {
          continue;
        }

        if (filterSet && !filterSet.has(filePath)) {
          continue;
        }

        const parts = metadata.split(/\s+/);
        // Format: <mode> <type> <sha>
        if (parts.length < 3 || parts[1] !== 'blob') {
          continue;
        }

        result.set(filePath, parts[2]);
      }
    } catch (error) {
      console.error('Failed to get HEAD blob SHAs:', error);
    }

    return result;
  }

  async raw(args: string[]): Promise<string> {
    // Performance-critical code paths (e.g. blame loops) call this frequently.
    // Repo validity is checked once at analyzer entry points, so avoid repeated checks here.
    return this.git.raw(args);
  }

  private async getParsedCommitStats(
    maxCommits: number,
    includeAuthorFields: boolean,
    excludePatterns: string[]
  ): Promise<ParsedCommitStat[]> {
    const shouldExcludePath = createPathPatternMatcher(excludePatterns);
    const format = includeAuthorFields
      ? '__COMMIT__|%an|%ae|%aI'
      : '__COMMIT__|%aI';
    const rawLog = await this.git.raw([
      'log',
      '--all',
      `--max-count=${maxCommits}`,
      '--no-renames',
      `--format=${format}`,
      '--numstat',
    ]);

    const commits: ParsedCommitStat[] = [];
    let current: ParsedCommitStat | null = null;

    const pushCurrent = () => {
      if (!current) {
        return;
      }

      if (current.hasIncludedChanges || !current.sawAnyFileStats) {
        commits.push(current);
      }
    };

    for (const line of rawLog.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed) {
        continue;
      }

      if (trimmed.startsWith('__COMMIT__|')) {
        pushCurrent();
        current = this.createParsedCommit(trimmed, includeAuthorFields);
        continue;
      }

      if (!current) {
        continue;
      }

      const fileStat = this.parseNumstatLine(line);
      if (!fileStat) {
        continue;
      }

      current.sawAnyFileStats = true;
      if (shouldExcludePath(fileStat.filePath)) {
        continue;
      }

      current.hasIncludedChanges = true;
      current.additions += fileStat.additions;
      current.deletions += fileStat.deletions;
    }

    pushCurrent();
    return commits;
  }

  private createParsedCommit(line: string, includeAuthorFields: boolean): ParsedCommitStat {
    const parts = line.split('|');
    if (includeAuthorFields) {
      return {
        name: parts[1],
        email: parts[2],
        date: parts[3],
        additions: 0,
        deletions: 0,
        hasIncludedChanges: false,
        sawAnyFileStats: false,
      };
    }

    return {
      date: parts[1],
      additions: 0,
      deletions: 0,
      hasIncludedChanges: false,
      sawAnyFileStats: false,
    };
  }

  private parseNumstatLine(
    line: string
  ): { additions: number; deletions: number; filePath: string } | null {
    const parts = line.split('\t');
    if (parts.length < 3) {
      return null;
    }

    const filePath = parts[parts.length - 1].trim();
    if (!filePath) {
      return null;
    }

    const additions = parts[0] === '-' ? 0 : parseInt(parts[0], 10);
    const deletions = parts[1] === '-' ? 0 : parseInt(parts[1], 10);

    if (!Number.isFinite(additions) || !Number.isFinite(deletions)) {
      return null;
    }

    return { additions, deletions, filePath };
  }

  private getRepositoryName(): string {
    const name = this.repoPath.split('/').pop()?.trim() ?? '';
    if (!name) {
      throw new Error(`Cannot derive repository name from path: "${this.repoPath}"`);
    }

    return name;
  }

  private getISOWeek(date: Date): string {
    // Get the ISO week number
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNum = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
    return `${d.getUTCFullYear()}-W${weekNum.toString().padStart(2, '0')}`;
  }
}

// ============================================================================
// Factory Function for Dependency Injection
// ============================================================================

export function createGitAnalyzer(repoPath: string): GitClient {
  return new GitAnalyzer(repoPath);
}
