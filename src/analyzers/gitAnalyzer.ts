import simpleGit, { SimpleGit } from 'simple-git';
import { ContributorStats, CodeFrequency } from '../types';

/**
 * Error thrown when the path is not a git repository
 */
export class NotAGitRepoError extends Error {
  constructor(path: string) {
    super(`Not a git repository: ${path}`);
    this.name = 'NotAGitRepoError';
  }
}

/**
 * Error thrown when git binary is not found
 */
export class GitNotFoundError extends Error {
  constructor() {
    super('Git binary not found. Please ensure git is installed and in PATH.');
    this.name = 'GitNotFoundError';
  }
}

/**
 * Handles all git operations for repository analysis
 */
export class GitAnalyzer {
  private git: SimpleGit;
  private repoPath: string;

  constructor(repoPath: string) {
    this.repoPath = repoPath;
    this.git = simpleGit(repoPath, {
      binary: 'git',
      maxConcurrentProcesses: 6,
      trimmed: true,
    });
  }

  /**
   * Check if the path is a valid git repository
   */
  async isGitRepo(): Promise<boolean> {
    try {
      await this.git.revparse(['--git-dir']);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get the current HEAD SHA for cache invalidation
   */
  async getHeadSha(): Promise<string> {
    return await this.git.revparse(['HEAD']);
  }

  /**
   * Get the current branch name
   */
  async getCurrentBranch(): Promise<string> {
    return await this.git.revparse(['--abbrev-ref', 'HEAD']);
  }

  /**
   * Get contributor statistics
   */
  async getContributors(limit?: number): Promise<ContributorStats[]> {
    const args = ['--all', '--format=%an|%ae|%ad|%H', '--date=iso'];
    if (limit) {
      args.unshift('-n', String(limit));
    }

    const log = await this.git.log(args);
    const contributorMap = new Map<string, ContributorStats>();

    for (const commit of log.all) {
      // Parse the custom format
      const parts = commit.hash.split('|');
      if (parts.length < 4) {continue;}

      const [name, email, dateStr] = parts;
      const key = email.toLowerCase();
      const commitDate = new Date(dateStr);

      if (!contributorMap.has(key)) {
        contributorMap.set(key, {
          name,
          email,
          commits: 0,
          linesAdded: 0,
          linesDeleted: 0,
          firstCommit: commitDate,
          lastCommit: commitDate,
          weeklyActivity: [],
        });
      }

      const contributor = contributorMap.get(key)!;
      contributor.commits++;

      if (commitDate < contributor.firstCommit) {
        contributor.firstCommit = commitDate;
      }
      if (commitDate > contributor.lastCommit) {
        contributor.lastCommit = commitDate;
      }
    }

    return Array.from(contributorMap.values()).sort(
      (a, b) => b.commits - a.commits
    );
  }

  /**
   * Get code frequency data (additions/deletions over time)
   */
  async getCodeFrequency(): Promise<CodeFrequency[]> {
    const log = await this.git.log([
      '--all',
      '--numstat',
      '--format=COMMIT|%ad',
      '--date=iso',
    ]);

    const weeklyData = new Map<string, CodeFrequency>();
    let currentWeek = '';

    // The log output is in the raw property for numstat
    const raw = (log as unknown as { raw?: string }).raw || '';
    const lines = raw.split('\n');

    for (const line of lines) {
      if (line.startsWith('COMMIT|')) {
        const dateStr = line.substring(7);
        currentWeek = this.getISOWeek(new Date(dateStr));

        if (!weeklyData.has(currentWeek)) {
          weeklyData.set(currentWeek, {
            week: currentWeek,
            additions: 0,
            deletions: 0,
            netChange: 0,
          });
        }
      } else if (line.match(/^\d+\t\d+\t/) && currentWeek) {
        const [addStr, delStr] = line.split('\t');
        const additions = parseInt(addStr, 10) || 0;
        const deletions = parseInt(delStr, 10) || 0;

        const data = weeklyData.get(currentWeek)!;
        data.additions += additions;
        data.deletions += deletions;
        data.netChange = data.additions - data.deletions;
      }
    }

    return Array.from(weeklyData.values()).sort((a, b) =>
      a.week.localeCompare(b.week)
    );
  }

  /**
   * Get files changed since a specific commit
   */
  async getChangedFiles(sinceCommit: string): Promise<string[]> {
    const diff = await this.git.diff(['--name-only', sinceCommit, 'HEAD']);
    return diff.split('\n').filter(Boolean);
  }

  /**
   * Get the total commit count
   */
  async getCommitCount(): Promise<number> {
    const result = await this.git.raw(['rev-list', '--count', 'HEAD']);
    return parseInt(result.trim(), 10);
  }

  /**
   * Get ISO week string from date (e.g., "2025-W03")
   */
  private getISOWeek(date: Date): string {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + 4 - (d.getDay() || 7));
    const yearStart = new Date(d.getFullYear(), 0, 1);
    const weekNo = Math.ceil(
      ((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7
    );
    return `${d.getFullYear()}-W${String(weekNo).padStart(2, '0')}`;
  }

  /**
   * Safely execute a git operation with error handling
   */
  async safeOperation<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes('not a git repository')) {
        throw new NotAGitRepoError(this.repoPath);
      }
      if (message.includes('ENOENT') && message.includes('git')) {
        throw new GitNotFoundError();
      }
      throw error;
    }
  }
}
