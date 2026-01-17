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

// ============================================================================
// Interfaces for Dependency Injection
// ============================================================================

export interface GitClient {
  isRepo(): Promise<boolean>;
  getRepoInfo(): Promise<RepositoryInfo>;
  getContributorStats(maxCommits: number): Promise<ContributorStats[]>;
  getCodeFrequency(maxCommits: number): Promise<CodeFrequency[]>;
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

      const name = this.repoPath.split('/').pop() || 'unknown';

      return {
        name: name.trim(),
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

  async getContributorStats(maxCommits: number): Promise<ContributorStats[]> {
    if (!(await this.isRepo())) {
      throw new NotAGitRepoError(this.repoPath);
    }

    // Parse raw log output for detailed stats
    const rawLog = await this.git.raw([
      'log',
      '--all',
      `--max-count=${maxCommits}`,
      '--format=%H|%an|%ae|%aI',
      '--shortstat',
    ]);

    const contributorMap = new Map<string, ContributorStats>();
    const lines = rawLog.split('\n');

    let currentCommit: {
      hash: string;
      name: string;
      email: string;
      date: string;
    } | null = null;

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) {continue;}

      // Check if this is a commit line (hash|name|email|date)
      if (trimmed.includes('|') && !trimmed.includes('insertion') && !trimmed.includes('deletion')) {
        const parts = trimmed.split('|');
        if (parts.length >= 4) {
          currentCommit = {
            hash: parts[0],
            name: parts[1],
            email: parts[2],
            date: parts[3],
          };
        }
      } else if (currentCommit && (trimmed.includes('insertion') || trimmed.includes('deletion') || trimmed.includes('file'))) {
        // Parse stat line: "X files changed, Y insertions(+), Z deletions(-)"
        const stats = this.parseStatLine(trimmed);
        const key = currentCommit.email.toLowerCase();

        if (!contributorMap.has(key)) {
          contributorMap.set(key, {
            name: currentCommit.name,
            email: currentCommit.email,
            commits: 0,
            linesAdded: 0,
            linesDeleted: 0,
            firstCommit: currentCommit.date,
            lastCommit: currentCommit.date,
            weeklyActivity: [],
          });
        }

        const contributor = contributorMap.get(key)!;
        contributor.commits++;
        contributor.linesAdded += stats.additions;
        contributor.linesDeleted += stats.deletions;

        // Update first/last commit dates
        if (currentCommit.date < contributor.firstCommit) {
          contributor.firstCommit = currentCommit.date;
        }
        if (currentCommit.date > contributor.lastCommit) {
          contributor.lastCommit = currentCommit.date;
        }

        // Add to weekly activity
        const week = this.getISOWeek(new Date(currentCommit.date));
        let weeklyEntry = contributor.weeklyActivity.find(w => w.week === week);
        if (!weeklyEntry) {
          weeklyEntry = { week, commits: 0, additions: 0, deletions: 0 };
          contributor.weeklyActivity.push(weeklyEntry);
        }
        weeklyEntry.commits++;
        weeklyEntry.additions += stats.additions;
        weeklyEntry.deletions += stats.deletions;

        currentCommit = null;
      }
    }

    // Handle commits without stat lines (empty commits)
    // We need a second pass for these
    const rawLogBasic = await this.git.raw([
      'log',
      '--all',
      `--max-count=${maxCommits}`,
      '--format=%an|%ae|%aI',
    ]);

    for (const line of rawLogBasic.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.includes('|')) {continue;}

      const parts = trimmed.split('|');
      if (parts.length >= 3) {
        const email = parts[1].toLowerCase();
        if (!contributorMap.has(email)) {
          contributorMap.set(email, {
            name: parts[0],
            email: parts[1],
            commits: 1,
            linesAdded: 0,
            linesDeleted: 0,
            firstCommit: parts[2],
            lastCommit: parts[2],
            weeklyActivity: [],
          });
        }
      }
    }

    // Sort contributors by commit count (descending)
    const contributors = Array.from(contributorMap.values());
    contributors.sort((a, b) => b.commits - a.commits);

    // Sort weekly activity by week
    for (const contributor of contributors) {
      contributor.weeklyActivity.sort((a, b) => a.week.localeCompare(b.week));
    }

    return contributors;
  }

  async getCodeFrequency(maxCommits: number): Promise<CodeFrequency[]> {
    if (!(await this.isRepo())) {
      throw new NotAGitRepoError(this.repoPath);
    }

    const rawLog = await this.git.raw([
      'log',
      '--all',
      `--max-count=${maxCommits}`,
      '--format=%aI',
      '--shortstat',
    ]);

    const weeklyMap = new Map<string, CodeFrequency>();
    const lines = rawLog.split('\n');

    let currentDate: string | null = null;

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) {continue;}

      // Check if this is a date line (ISO format)
      if (trimmed.match(/^\d{4}-\d{2}-\d{2}T/)) {
        currentDate = trimmed;
      } else if (currentDate && (trimmed.includes('insertion') || trimmed.includes('deletion') || trimmed.includes('file'))) {
        const stats = this.parseStatLine(trimmed);
        const week = this.getISOWeek(new Date(currentDate));

        if (!weeklyMap.has(week)) {
          weeklyMap.set(week, {
            week,
            additions: 0,
            deletions: 0,
            netChange: 0,
          });
        }

        const entry = weeklyMap.get(week)!;
        entry.additions += stats.additions;
        entry.deletions += stats.deletions;
        entry.netChange = entry.additions - entry.deletions;

        currentDate = null;
      }
    }

    // Sort by week
    const frequency = Array.from(weeklyMap.values());
    frequency.sort((a, b) => a.week.localeCompare(b.week));

    return frequency;
  }

  private parseStatLine(line: string): { additions: number; deletions: number } {
    let additions = 0;
    let deletions = 0;

    const insertionMatch = line.match(/(\d+)\s+insertion/);
    if (insertionMatch) {
      additions = parseInt(insertionMatch[1], 10);
    }

    const deletionMatch = line.match(/(\d+)\s+deletion/);
    if (deletionMatch) {
      deletions = parseInt(deletionMatch[1], 10);
    }

    return { additions, deletions };
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
