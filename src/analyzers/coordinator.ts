/**
 * Analysis Coordinator - Orchestrates all analysis operations.
 * This module has NO VSCode dependencies and is fully testable.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
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
  private repoPath: string;

  constructor(
    repoPath: string,
    settings: ExtensionSettings,
    sccStoragePath: string,
    gitClient?: GitClient,
    locClient?: LOCClient
  ) {
    this.repoPath = repoPath;
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
    onProgress?.('Lines of code counted', 80);

    // Phase 6: Get git file modification dates
    onProgress?.('Getting file history', 82);
    const fileModDates = await this.gitClient.getFileModificationDates();
    onProgress?.('File history loaded', 88);

    // Phase 7: Enrich tree with modification dates and file sizes
    onProgress?.('Enriching file data', 90);
    await this.enrichTreeWithMetadata(fileTree, fileModDates);
    onProgress?.('File data enriched', 95);

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

  /**
   * Enrich tree nodes with git modification dates and file sizes.
   */
  private async enrichTreeWithMetadata(
    node: TreemapNode,
    fileModDates: Map<string, string>
  ): Promise<number> {
    if (node.type === 'file') {
      // Apply git modification date
      const modDate = fileModDates.get(node.path);
      if (modDate) {
        node.lastModified = modDate;
      }

      // Get file size from filesystem
      try {
        const fullPath = path.join(this.repoPath, node.path);
        const stats = await fs.stat(fullPath);
        node.bytes = stats.size;
      } catch {
        // File may have been deleted or moved - use estimate
        node.bytes = (node.lines || 0) * 40; // ~40 bytes per line estimate
      }

      return node.bytes;
    }

    // For directories, recursively process children
    let totalBytes = 0;
    let latestModified: string | undefined;

    if (node.children) {
      // Process children in parallel batches to avoid overwhelming fs
      const BATCH_SIZE = 50;
      for (let i = 0; i < node.children.length; i += BATCH_SIZE) {
        const batch = node.children.slice(i, i + BATCH_SIZE);
        const results = await Promise.all(
          batch.map(child => this.enrichTreeWithMetadata(child, fileModDates))
        );
        totalBytes += results.reduce((sum, bytes) => sum + bytes, 0);
      }

      // Find the most recent modification date among children
      for (const child of node.children) {
        if (child.lastModified) {
          if (!latestModified || child.lastModified > latestModified) {
            latestModified = child.lastModified;
          }
        }
      }
    }

    node.bytes = totalBytes;
    if (latestModified) {
      node.lastModified = latestModified;
    }

    return totalBytes;
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
