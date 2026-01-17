import * as vscode from 'vscode';
import { GitAnalyzer, NotAGitRepoError } from './gitAnalyzer';
import { LOCCounter } from './locCounter';
import { CacheManager } from '../cache/cacheManager';
import { AnalysisResult, TreemapNode } from '../types';
import * as path from 'path';

/**
 * Coordinates the analysis of a repository
 * Orchestrates git analysis, LOC counting, and caching
 */
export class AnalysisCoordinator {
  private gitAnalyzer: GitAnalyzer;
  private locCounter: LOCCounter;
  private cacheManager: CacheManager;
  private repoPath: string;

  constructor(repoPath: string, context: vscode.ExtensionContext) {
    this.repoPath = repoPath;
    this.gitAnalyzer = new GitAnalyzer(repoPath);
    this.locCounter = new LOCCounter(repoPath);
    this.cacheManager = new CacheManager(context.workspaceState);
  }

  /**
   * Perform full repository analysis
   */
  async analyze(): Promise<AnalysisResult> {
    // Check if this is a git repository
    const isGitRepo = await this.gitAnalyzer.isGitRepo();
    if (!isGitRepo) {
      throw new NotAGitRepoError(this.repoPath);
    }

    // Check cache validity
    const headSha = await this.gitAnalyzer.getHeadSha();
    const cached = await this.cacheManager.get(this.repoPath, headSha);
    if (cached) {
      return this.cacheToResult(cached);
    }

    // Perform fresh analysis
    const [contributors, codeFrequency, treemap, commitCount, branch] =
      await Promise.all([
        this.gitAnalyzer.getContributors(),
        this.gitAnalyzer.getCodeFrequency(),
        this.locCounter.getTreemap(),
        this.gitAnalyzer.getCommitCount(),
        this.gitAnalyzer.getCurrentBranch(),
      ]);

    // Calculate totals
    const totalFiles = this.countFiles(treemap);
    const totalLines = this.countLines(treemap);

    const result: AnalysisResult = {
      contributors,
      codeFrequency,
      treemap,
      repoInfo: {
        name: path.basename(this.repoPath),
        branch,
        totalCommits: commitCount,
        totalFiles,
        totalLines,
      },
    };

    // Cache the result
    await this.cacheManager.set(this.repoPath, headSha, {
      version: '1.0.0',
      repoPath: this.repoPath,
      lastCommitSha: headSha,
      lastAnalyzed: Date.now(),
      contributors,
      codeFrequency,
      fileTree: treemap,
      fileLOC: {},
    });

    return result;
  }

  /**
   * Invalidate the cache for this repository
   */
  async invalidateCache(): Promise<void> {
    await this.cacheManager.invalidate(this.repoPath);
  }

  /**
   * Convert cached data to analysis result
   */
  private cacheToResult(cached: {
    contributors: AnalysisResult['contributors'];
    codeFrequency: AnalysisResult['codeFrequency'];
    fileTree: TreemapNode;
  }): AnalysisResult {
    const totalFiles = this.countFiles(cached.fileTree);
    const totalLines = this.countLines(cached.fileTree);

    return {
      contributors: cached.contributors,
      codeFrequency: cached.codeFrequency,
      treemap: cached.fileTree,
      repoInfo: {
        name: path.basename(this.repoPath),
        branch: 'main', // Will be updated on next fresh analysis
        totalCommits: 0,
        totalFiles,
        totalLines,
      },
    };
  }

  /**
   * Count total files in treemap
   */
  private countFiles(node: TreemapNode): number {
    if (node.type === 'file') {
      return 1;
    }
    return (node.children || []).reduce(
      (sum, child) => sum + this.countFiles(child),
      0
    );
  }

  /**
   * Count total lines in treemap
   */
  private countLines(node: TreemapNode): number {
    if (node.type === 'file') {
      return node.lines || 0;
    }
    return (node.children || []).reduce(
      (sum, child) => sum + this.countLines(child),
      0
    );
  }
}
