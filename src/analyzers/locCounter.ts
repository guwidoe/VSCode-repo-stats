/**
 * LOC Counter - Lines of Code counting using scc binary.
 * This module has NO VSCode dependencies and is fully testable.
 *
 * Note: scc respects .gitignore by default. The excludePatterns setting
 * provides ADDITIONAL exclusions beyond what's in .gitignore.
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import { TreemapNode } from '../types/index.js';
import {
  SccBinaryManager,
  SccInfo,
  createSccBinaryManager,
} from './sccBinaryManager.js';

const execAsync = promisify(exec);

// ============================================================================
// Interfaces for Dependency Injection
// ============================================================================

export interface LOCClient {
  countLines(excludePatterns: string[]): Promise<TreemapNode>;
  ensureSccAvailable(onProgress?: (percent: number) => void): Promise<void>;
  getSccInfo(): Promise<SccInfo>;
}

// ============================================================================
// SCC Output Types
// ============================================================================

interface SccFileEntry {
  Location: string;
  Language: string;
  Code: number;
  Lines: number;
  Blank: number;
  Comment: number;
  Complexity: number;
}

interface SccLanguageGroup {
  Name: string;
  Files: SccFileEntry[];
}

// ============================================================================
// LOC Counter Implementation
// ============================================================================

export class LOCCounter implements LOCClient {
  private repoPath: string;
  private binaryManager: SccBinaryManager;
  private sccPath: string | null = null;

  constructor(repoPath: string, storagePath: string) {
    this.repoPath = repoPath;
    this.binaryManager = createSccBinaryManager(storagePath);
  }

  /**
   * Ensure scc is available, downloading if necessary.
   * @throws Error if scc cannot be made available
   */
  async ensureSccAvailable(onProgress?: (percent: number) => void): Promise<void> {
    // Check if already resolved
    if (this.sccPath) {
      return;
    }

    // Try to get existing binary (system or downloaded)
    const existingPath = await this.binaryManager.getBinaryPath();
    if (existingPath) {
      this.sccPath = existingPath;
      return;
    }

    // Need to download
    this.sccPath = await this.binaryManager.downloadBinary(onProgress);
  }

  /**
   * Get information about the scc installation.
   */
  async getSccInfo(): Promise<SccInfo> {
    return this.binaryManager.getSccInfo();
  }

  /**
   * Count lines of code in the repository.
   * Note: scc respects .gitignore by default.
   * @param excludePatterns Additional patterns to exclude beyond .gitignore
   */
  async countLines(excludePatterns: string[]): Promise<TreemapNode> {
    if (!this.sccPath) {
      throw new Error(
        'scc is not available. Call ensureSccAvailable() first.'
      );
    }

    const excludeArgs = excludePatterns
      .map((p) => `--exclude-dir=${p}`)
      .join(' ');

    try {
      const { stdout } = await execAsync(
        `"${this.sccPath}" --by-file --format=json ${excludeArgs} "${this.repoPath}"`,
        { maxBuffer: 50 * 1024 * 1024 } // 50MB buffer for large repos
      );

      // scc outputs array of language groups, each containing a Files array
      const languageGroups = JSON.parse(stdout) as SccLanguageGroup[];
      const allFiles: SccFileEntry[] = [];
      for (const group of languageGroups) {
        if (group.Files) {
          for (const file of group.Files) {
            // Use group name if file doesn't have Language set
            allFiles.push({
              ...file,
              Language: file.Language || group.Name,
            });
          }
        }
      }
      return this.buildTreeFromScc(allFiles);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to count lines of code: ${errorMessage}`);
    }
  }

  private buildTreeFromScc(sccResult: SccFileEntry[]): TreemapNode {
    const root: TreemapNode = {
      name: path.basename(this.repoPath),
      path: '',
      type: 'directory',
      lines: 0,
      children: [],
    };

    for (const file of sccResult) {
      let relativePath = file.Location.startsWith(this.repoPath)
        ? file.Location.slice(this.repoPath.length + 1)
        : file.Location;

      // Normalize path: remove leading ./, use forward slashes
      relativePath = relativePath.replace(/^\.\//, '').replace(/\\/g, '/');

      const parts = relativePath.split('/');
      let current = root;

      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        const isFile = i === parts.length - 1;
        const currentPath = parts.slice(0, i + 1).join('/');

        if (isFile) {
          const fileNode: TreemapNode = {
            name: part,
            path: currentPath,
            type: 'file',
            lines: file.Code,
            language: file.Language,
            complexity: file.Complexity,
            commentLines: file.Comment,
            blankLines: file.Blank,
          };
          current.children = current.children || [];
          current.children.push(fileNode);
        } else {
          current.children = current.children || [];
          let dirNode = current.children.find(
            (c) => c.name === part && c.type === 'directory'
          );
          if (!dirNode) {
            dirNode = {
              name: part,
              path: currentPath,
              type: 'directory',
              lines: 0,
              children: [],
            };
            current.children.push(dirNode);
          }
          current = dirNode;
        }
      }
    }

    // Calculate directory metrics (lines, complexity, etc.)
    this.calculateDirectoryMetrics(root);

    return root;
  }

  /**
   * Calculate directory metrics recursively.
   * Returns aggregated metrics for the subtree.
   */
  private calculateDirectoryMetrics(node: TreemapNode): DirectoryMetrics {
    if (node.type === 'file') {
      return {
        lines: node.lines || 0,
        complexity: node.complexity || 0,
        commentLines: node.commentLines || 0,
        blankLines: node.blankLines || 0,
        fileCount: 1,
        maxComplexity: node.complexity || 0,
      };
    }

    // Aggregate metrics from children
    let totalLines = 0;
    let totalComplexity = 0;
    let totalCommentLines = 0;
    let totalBlankLines = 0;
    let totalFileCount = 0;
    let maxComplexity = 0;

    for (const child of node.children || []) {
      const childMetrics = this.calculateDirectoryMetrics(child);
      totalLines += childMetrics.lines;
      totalComplexity += childMetrics.complexity;
      totalCommentLines += childMetrics.commentLines;
      totalBlankLines += childMetrics.blankLines;
      totalFileCount += childMetrics.fileCount;
      maxComplexity = Math.max(maxComplexity, childMetrics.maxComplexity);
    }

    // Set directory node metrics
    node.lines = totalLines;
    node.complexity = totalComplexity;
    node.commentLines = totalCommentLines;
    node.blankLines = totalBlankLines;
    node.fileCount = totalFileCount;
    node.complexityMax = maxComplexity;
    node.complexityAvg =
      totalFileCount > 0 ? Math.round(totalComplexity / totalFileCount) : 0;

    return {
      lines: totalLines,
      complexity: totalComplexity,
      commentLines: totalCommentLines,
      blankLines: totalBlankLines,
      fileCount: totalFileCount,
      maxComplexity,
    };
  }
}

// ============================================================================
// Internal Types
// ============================================================================

interface DirectoryMetrics {
  lines: number;
  complexity: number;
  commentLines: number;
  blankLines: number;
  fileCount: number;
  maxComplexity: number;
}

// ============================================================================
// Factory Function for Dependency Injection
// ============================================================================

export function createLOCCounter(
  repoPath: string,
  storagePath: string
): LOCClient {
  return new LOCCounter(repoPath, storagePath);
}
