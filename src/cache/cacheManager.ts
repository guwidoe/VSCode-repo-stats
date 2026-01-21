/**
 * Cache Manager - Handles caching of analysis results.
 * Uses an abstract storage interface for testability.
 */

import * as crypto from 'crypto';
import {
  CacheStructure,
  AnalysisResult,
  TreemapNode,
} from '../types/index.js';

// ============================================================================
// Cache Version - Bump this when cache structure changes
// ============================================================================

const CACHE_VERSION = '1.0.0';

// ============================================================================
// Storage Interface (for dependency injection)
// ============================================================================

export interface CacheStorage {
  get<T>(key: string): T | undefined;
  set<T>(key: string, value: T): void;
}

// ============================================================================
// Cache Manager
// ============================================================================

export class CacheManager {
  private storage: CacheStorage;
  private keyPrefix: string;

  constructor(storage: CacheStorage, repoPath: string) {
    this.storage = storage;
    // Create a hash of the repo path for the cache key
    this.keyPrefix = `repoStats_${this.hashPath(repoPath)}`;
  }

  /**
   * Check if the cache is valid for the given commit SHA.
   */
  isValid(currentSha: string): boolean {
    const cache = this.getCache();
    if (!cache) {return false;}
    if (cache.version !== CACHE_VERSION) {return false;}
    if (cache.lastCommitSha !== currentSha) {return false;}
    return true;
  }

  /**
   * Get the full cached analysis result if valid.
   */
  getIfValid(currentSha: string): AnalysisResult | null {
    if (!this.isValid(currentSha)) {return null;}

    const cache = this.getCache();
    if (!cache) {return null;}

    return {
      repository: {
        name: cache.repoPath.split('/').pop() || 'unknown',
        path: cache.repoPath,
        branch: '', // Not cached, will be refreshed
        commitCount: 0, // Not cached, will be refreshed
        headSha: cache.lastCommitSha,
      },
      contributors: cache.contributors,
      codeFrequency: cache.codeFrequency,
      fileTree: cache.fileTree,
      analyzedAt: new Date(cache.lastAnalyzed).toISOString(),
      analyzedCommitCount: 0, // Will be refreshed from current analysis
      maxCommitsLimit: 0, // Will be refreshed from current analysis
      limitReached: false, // Will be refreshed from current analysis
      sccInfo: { version: '', source: 'none' }, // Not cached, determined at runtime
    };
  }

  /**
   * Save analysis result to cache.
   */
  save(result: AnalysisResult): void {
    const cache: CacheStructure = {
      version: CACHE_VERSION,
      repoPath: result.repository.path,
      lastCommitSha: result.repository.headSha,
      lastAnalyzed: Date.now(),
      contributors: result.contributors,
      codeFrequency: result.codeFrequency,
      fileTree: result.fileTree,
      fileLOC: this.buildFileLOCMap(result.fileTree),
    };

    this.storage.set(this.keyPrefix, cache);
  }

  /**
   * Clear the cache.
   */
  clear(): void {
    this.storage.set(this.keyPrefix, undefined);
  }

  /**
   * Get the cache timestamp.
   */
  getLastAnalyzed(): Date | null {
    const cache = this.getCache();
    if (!cache) {return null;}
    return new Date(cache.lastAnalyzed);
  }

  private getCache(): CacheStructure | null {
    const cached = this.storage.get<CacheStructure>(this.keyPrefix);
    return cached || null;
  }

  private hashPath(path: string): string {
    return crypto.createHash('md5').update(path).digest('hex').slice(0, 8);
  }

  private buildFileLOCMap(node: TreemapNode, map: Record<string, { sha: string; lines: number; language: string }> = {}): Record<string, { sha: string; lines: number; language: string }> {
    if (node.type === 'file') {
      map[node.path] = {
        sha: '', // TODO: Could store blob SHA for incremental updates
        lines: node.lines || 0,
        language: node.language || 'Unknown',
      };
    }

    for (const child of node.children || []) {
      this.buildFileLOCMap(child, map);
    }

    return map;
  }
}

// ============================================================================
// In-Memory Storage (for testing)
// ============================================================================

export class InMemoryCacheStorage implements CacheStorage {
  private store = new Map<string, unknown>();

  get<T>(key: string): T | undefined {
    return this.store.get(key) as T | undefined;
  }

  set<T>(key: string, value: T): void {
    if (value === undefined) {
      this.store.delete(key);
    } else {
      this.store.set(key, value);
    }
  }
}

// ============================================================================
// Factory Function
// ============================================================================

export function createCacheManager(storage: CacheStorage, repoPath: string): CacheManager {
  return new CacheManager(storage, repoPath);
}
