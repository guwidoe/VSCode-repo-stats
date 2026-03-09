/**
 * Git Analyzer - Pure business logic for git operations.
 * This module has NO VSCode dependencies and is fully testable.
 */

import simpleGit, { SimpleGit } from 'simple-git';
import {
  CommitAnalytics,
  ContributorStats,
  CodeFrequency,
  RepositoryInfo,
  NotAGitRepoError,
  GitNotFoundError,
} from '../types/index.js';
import {
  buildCodeFrequencyFromCommitAnalytics,
  buildCommitAnalytics,
  buildContributorStatsFromCommitAnalytics,
  parseCommitHistoryLog,
} from './commitAnalytics.js';

// ============================================================================
// Interfaces for Dependency Injection
// ============================================================================

export interface GitClient {
  isRepo(): Promise<boolean>;
  getRepoInfo(): Promise<RepositoryInfo>;
  getCommitAnalytics(maxCommits: number, excludePatterns?: string[]): Promise<CommitAnalytics>;
  getContributorStats(maxCommits: number, excludePatterns?: string[]): Promise<ContributorStats[]>;
  getCodeFrequency(maxCommits: number, excludePatterns?: string[]): Promise<CodeFrequency[]>;
  getFileModificationDates(): Promise<Map<string, string>>;
  getTrackedFiles(): Promise<string[]>;
  getSubmodulePaths(): Promise<string[]>;
  getHeadBlobShas(paths?: string[]): Promise<Map<string, string>>;
  raw(args: string[]): Promise<string>;
}

// ============================================================================
// Git Analyzer Implementation
// ============================================================================

export class GitAnalyzer implements GitClient {
  private git: SimpleGit;
  private repoPath: string;
  private commitAnalyticsCache = new Map<string, CommitAnalytics>();

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
      const [branch, headSha, commitCountRaw] = await Promise.all([
        this.git.revparse(['--abbrev-ref', 'HEAD']),
        this.git.revparse(['HEAD']),
        this.git.raw(['rev-list', '--all', '--count']),
      ]);

      const name = this.getRepositoryName();
      const commitCount = Number.parseInt(commitCountRaw.trim(), 10);

      return {
        name,
        path: this.repoPath,
        branch: branch.trim(),
        commitCount: Number.isFinite(commitCount) ? commitCount : 0,
        headSha: headSha.trim(),
      };
    } catch (error) {
      if (error instanceof Error && error.message.includes('not found')) {
        throw new GitNotFoundError();
      }
      throw error;
    }
  }

  async getCommitAnalytics(
    maxCommits: number,
    excludePatterns: string[] = []
  ): Promise<CommitAnalytics> {
    if (!(await this.isRepo())) {
      throw new NotAGitRepoError(this.repoPath);
    }

    const cacheKey = JSON.stringify({
      maxCommits,
      excludePatterns: [...excludePatterns].sort((a, b) => a.localeCompare(b)),
    });
    const cached = this.commitAnalyticsCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const rawLog = await this.git.raw([
      'log',
      '--all',
      `--max-count=${maxCommits}`,
      '--no-renames',
      '--format=__COMMIT__|%H|%an|%ae|%aI|%s',
      '--numstat',
    ]);

    const analytics = buildCommitAnalytics(
      parseCommitHistoryLog(rawLog, excludePatterns)
    );
    this.commitAnalyticsCache.set(cacheKey, analytics);
    return analytics;
  }

  async getContributorStats(
    maxCommits: number,
    excludePatterns: string[] = []
  ): Promise<ContributorStats[]> {
    const analytics = await this.getCommitAnalytics(maxCommits, excludePatterns);
    return buildContributorStatsFromCommitAnalytics(analytics);
  }

  async getCodeFrequency(
    maxCommits: number,
    excludePatterns: string[] = []
  ): Promise<CodeFrequency[]> {
    const analytics = await this.getCommitAnalytics(maxCommits, excludePatterns);
    return buildCodeFrequencyFromCommitAnalytics(analytics);
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

  private getRepositoryName(): string {
    const name = this.repoPath.split('/').pop()?.trim() ?? '';
    if (!name) {
      throw new Error(`Cannot derive repository name from path: "${this.repoPath}"`);
    }

    return name;
  }
}

// ============================================================================
// Factory Function for Dependency Injection
// ============================================================================

export function createGitAnalyzer(repoPath: string): GitClient {
  return new GitAnalyzer(repoPath);
}
