/**
 * Analysis Coordinator - Orchestrates all analysis operations.
 * This module has NO VSCode dependencies and is fully testable.
 */

import {
  AnalysisResult,
  RepositoryInfo,
  ContributorStats,
  CodeFrequency,
  TreemapNode,
  ExtensionSettings,
} from '../types/index.js';
import { GitClient, createGitAnalyzer } from './gitAnalyzer.js';
import { LOCClient, createLOCCounter } from './locCounter.js';

// ============================================================================
// Progress Callback Type
// ============================================================================

export type ProgressCallback = (phase: string, progress: number) => void;

// ============================================================================
// Analysis Coordinator
// ============================================================================

export class AnalysisCoordinator {
  private gitClient: GitClient;
  private locClient: LOCClient;
  private settings: ExtensionSettings;

  constructor(
    repoPath: string,
    settings: ExtensionSettings,
    sccStoragePath: string,
    gitClient?: GitClient,
    locClient?: LOCClient
  ) {
    this.settings = settings;
    this.gitClient = gitClient || createGitAnalyzer(repoPath);
    this.locClient = locClient || createLOCCounter(repoPath, sccStoragePath);
  }

  async analyze(onProgress?: ProgressCallback): Promise<AnalysisResult> {
    // Phase 1: Repository info
    onProgress?.('Checking repository', 0);
    const repository = await this.gitClient.getRepoInfo();
    onProgress?.('Repository info loaded', 5);

    // Phase 2: Ensure scc is available (may download)
    onProgress?.('Checking scc binary', 7);
    await this.locClient.ensureSccAvailable((downloadPercent) => {
      const phase = `Downloading scc (${Math.round(downloadPercent)}%)`;
      // Download progress maps to 7-12% of total progress
      onProgress?.(phase, 7 + (downloadPercent * 0.05));
    });
    const sccInfo = await this.locClient.getSccInfo();
    onProgress?.('scc ready', 12);

    // Phase 3: Contributor stats (can be slow for large repos)
    onProgress?.('Analyzing contributors', 15);
    const contributors = await this.gitClient.getContributorStats(
      this.settings.maxCommitsToAnalyze
    );
    onProgress?.('Contributors analyzed', 40);

    // Phase 4: Code frequency
    onProgress?.('Calculating code frequency', 45);
    const codeFrequency = await this.gitClient.getCodeFrequency(
      this.settings.maxCommitsToAnalyze
    );
    onProgress?.('Code frequency calculated', 60);

    // Phase 5: File tree with LOC
    onProgress?.('Counting lines of code', 65);
    const fileTree = await this.locClient.countLines(
      this.settings.excludePatterns
    );
    onProgress?.('Lines of code counted', 95);

    // Complete
    onProgress?.('Analysis complete', 100);

    // Calculate actual commits analyzed (sum across all contributors)
    const analyzedCommitCount = contributors.reduce(
      (sum, c) => sum + c.commits,
      0
    );
    const maxCommitsLimit = this.settings.maxCommitsToAnalyze;
    // Limit is reached if repo has more commits than we analyzed
    const limitReached = repository.commitCount > maxCommitsLimit;

    return {
      repository,
      contributors,
      codeFrequency,
      fileTree,
      analyzedAt: new Date().toISOString(),
      analyzedCommitCount,
      maxCommitsLimit,
      limitReached,
      sccInfo,
    };
  }

  async getRepositoryInfo(): Promise<RepositoryInfo> {
    return this.gitClient.getRepoInfo();
  }

  async getContributors(): Promise<ContributorStats[]> {
    return this.gitClient.getContributorStats(this.settings.maxCommitsToAnalyze);
  }

  async getCodeFrequency(): Promise<CodeFrequency[]> {
    return this.gitClient.getCodeFrequency(this.settings.maxCommitsToAnalyze);
  }

  async getFileTree(): Promise<TreemapNode> {
    return this.locClient.countLines(this.settings.excludePatterns);
  }
}

// ============================================================================
// Factory Function
// ============================================================================

export function createAnalysisCoordinator(
  repoPath: string,
  settings: ExtensionSettings,
  sccStoragePath: string
): AnalysisCoordinator {
  return new AnalysisCoordinator(repoPath, settings, sccStoragePath);
}
