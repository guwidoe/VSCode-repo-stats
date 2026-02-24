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
import {
  LOCClient,
  createLOCCounter,
  normalizeExtensionForFilter,
  shouldExcludeFileByExtension,
} from './locCounter.js';

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

    // Phase 2.5: Detect submodules to exclude from analysis
    onProgress?.('Detecting submodules', 13);
    const submodulePaths = await this.gitClient.getSubmodulePaths();
    onProgress?.('Submodules detected', 14);

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
    // Combine user exclude patterns with submodule paths
    const allExcludePatterns = [
      ...this.settings.excludePatterns,
      ...submodulePaths,
    ];
    const fileTree = await this.locClient.countLines(
      allExcludePatterns,
      this.settings.locExcludedExtensions
    );
    onProgress?.('Lines of code counted', 80);

    // Phase 6: Get git file modification dates
    onProgress?.('Getting file history', 82);
    const fileModDates = await this.gitClient.getFileModificationDates();
    onProgress?.('File history loaded', 88);

    // Phase 7: Get all tracked files and add binary files to tree
    onProgress?.('Scanning for binary files', 90);
    const trackedFiles = await this.gitClient.getTrackedFiles();
    const codeFilePaths = this.collectFilePaths(fileTree);
    const locExcludedExtensionSet = this.buildExtensionSet(
      this.settings.locExcludedExtensions
    );
    const binaryExtensionSet = this.buildExtensionSet(
      this.settings.binaryExtensions
    );
    await this.addBinaryFilesToTree(
      fileTree,
      trackedFiles,
      codeFilePaths,
      fileModDates,
      locExcludedExtensionSet,
      binaryExtensionSet
    );
    onProgress?.('Binary files added', 93);

    // Phase 8: Enrich tree with modification dates and file sizes
    onProgress?.('Enriching file data', 95);
    await this.enrichTreeWithMetadata(fileTree, fileModDates);
    onProgress?.('File data enriched', 98);

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
      submodules: submodulePaths.length > 0
        ? { paths: submodulePaths, count: submodulePaths.length }
        : undefined,
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

  /**
   * Collect all file paths from the tree.
   */
  private collectFilePaths(node: TreemapNode, paths: Set<string> = new Set()): Set<string> {
    if (node.type === 'file') {
      paths.add(node.path);
    }
    for (const child of node.children || []) {
      this.collectFilePaths(child, paths);
    }
    return paths;
  }

  /**
   * Build a normalized extension set from settings values.
   */
  private buildExtensionSet(extensions: string[] = []): Set<string> {
    const result = new Set<string>();
    for (const extension of extensions) {
      const normalized = normalizeExtensionForFilter(extension);
      if (normalized) {
        result.add(normalized);
      }
    }
    return result;
  }

  /**
   * Returns normalized extension for a filename, handling dotfiles like ".env".
   */
  private getFileExtension(fileName: string): string {
    const ext = path.extname(fileName).toLowerCase();
    if (ext) {
      return ext;
    }

    const normalizedName = fileName.toLowerCase();
    if (normalizedName.startsWith('.') && !normalizedName.slice(1).includes('.')) {
      return normalizedName;
    }

    return '';
  }

  /**
   * Add binary files (files not in scc output) to the tree.
   */
  private async addBinaryFilesToTree(
    root: TreemapNode,
    allTrackedFiles: string[],
    codeFilePaths: Set<string>,
    fileModDates: Map<string, string>,
    locExcludedExtensions: Set<string>,
    binaryExtensions: Set<string>
  ): Promise<void> {
    // Find binary files (tracked but not in scc output)
    const binaryFiles = allTrackedFiles.filter(f => !codeFilePaths.has(f));

    for (const filePath of binaryFiles) {
      const isLocExcluded = shouldExcludeFileByExtension(
        filePath,
        locExcludedExtensions
      );
      const isConfiguredBinary = shouldExcludeFileByExtension(
        filePath,
        binaryExtensions
      );

      // Files excluded from LOC but not configured as binary are fully ignored.
      // This prevents cases like '.ts' being shown as binary when intentionally excluded.
      if (isLocExcluded && !isConfiguredBinary) {
        continue;
      }

      // Get file size
      let bytes = 0;
      try {
        const fullPath = path.join(this.repoPath, filePath);
        const stats = await fs.stat(fullPath);
        bytes = stats.size;
      } catch {
        continue; // Skip files that don't exist
      }

      // Parse path into segments
      const segments = filePath.split('/');
      const fileName = segments[segments.length - 1];

      // Determine language from extension (for display purposes)
      const ext = this.getFileExtension(fileName);
      const language = this.getBinaryLanguage(ext);

      // Navigate/create directory structure
      let current = root;
      for (let i = 0; i < segments.length - 1; i++) {
        const dirName = segments[i];
        const dirPath = segments.slice(0, i + 1).join('/');

        current.children = current.children || [];
        let dirNode = current.children.find(
          c => c.name === dirName && c.type === 'directory'
        );

        if (!dirNode) {
          dirNode = {
            name: dirName,
            path: dirPath,
            type: 'directory',
            lines: 0,
            children: [],
          };
          current.children.push(dirNode);
        }
        current = dirNode;
      }

      // Add the binary file node
      current.children = current.children || [];
      current.children.push({
        name: fileName,
        path: filePath,
        type: 'file',
        lines: 0,
        bytes,
        language,
        binary: true,
        lastModified: fileModDates.get(filePath),
      });
    }
  }

  /**
   * Get a display language for binary file extensions.
   */
  private getBinaryLanguage(ext: string): string {
    const binaryLanguages: Record<string, string> = {
      // Images
      '.png': 'Image', '.jpg': 'Image', '.jpeg': 'Image', '.gif': 'Image',
      '.svg': 'Image', '.ico': 'Image', '.webp': 'Image', '.bmp': 'Image',
      '.tiff': 'Image', '.tif': 'Image', '.psd': 'Image', '.ai': 'Image',
      '.heic': 'Image', '.avif': 'Image',
      // Videos
      '.mp4': 'Video', '.webm': 'Video', '.mov': 'Video', '.avi': 'Video',
      '.mkv': 'Video', '.flv': 'Video',
      // Audio
      '.mp3': 'Audio', '.wav': 'Audio', '.ogg': 'Audio', '.flac': 'Audio',
      '.aac': 'Audio', '.m4a': 'Audio',
      // Fonts
      '.ttf': 'Font', '.otf': 'Font', '.woff': 'Font', '.woff2': 'Font',
      '.eot': 'Font',
      // Archives
      '.zip': 'Archive', '.tar': 'Archive', '.gz': 'Archive', '.rar': 'Archive',
      '.7z': 'Archive',
      // Documents
      '.pdf': 'Document', '.doc': 'Document', '.docx': 'Document',
      '.xls': 'Document', '.xlsx': 'Document', '.ppt': 'Document',
      '.pptx': 'Document',
      // Compiled/Binary
      '.exe': 'Binary', '.dll': 'Binary', '.so': 'Binary', '.dylib': 'Binary',
      '.wasm': 'Binary', '.class': 'Binary', '.pyc': 'Binary',
      // Database
      '.sqlite': 'Database', '.db': 'Database',
    };
    return binaryLanguages[ext] || 'Binary';
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
    return this.locClient.countLines(
      this.settings.excludePatterns,
      this.settings.locExcludedExtensions
    );
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
