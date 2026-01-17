import * as vscode from 'vscode';
import { CacheStructure } from '../types';

const CACHE_VERSION = '1.0.0';
const CACHE_KEY_PREFIX = 'repoStats.cache.';

/**
 * Manages caching of analysis results using VSCode workspaceState
 */
export class CacheManager {
  constructor(private storage: vscode.Memento) {}

  /**
   * Get cached data for a repository
   * Returns null if cache is invalid or doesn't exist
   */
  async get(
    repoPath: string,
    currentHeadSha: string
  ): Promise<CacheStructure | null> {
    const key = this.getCacheKey(repoPath);
    const cached = this.storage.get<CacheStructure>(key);

    if (!cached) {
      return null;
    }

    // Check version compatibility
    if (cached.version !== CACHE_VERSION) {
      await this.invalidate(repoPath);
      return null;
    }

    // Check if HEAD has changed
    if (cached.lastCommitSha !== currentHeadSha) {
      // Cache is stale, but we could potentially do incremental update
      // For now, just invalidate
      return null;
    }

    return cached;
  }

  /**
   * Store analysis results in cache
   */
  async set(
    repoPath: string,
    headSha: string,
    data: CacheStructure
  ): Promise<void> {
    const key = this.getCacheKey(repoPath);
    await this.storage.update(key, {
      ...data,
      version: CACHE_VERSION,
      lastCommitSha: headSha,
      lastAnalyzed: Date.now(),
    });
  }

  /**
   * Invalidate cache for a repository
   */
  async invalidate(repoPath: string): Promise<void> {
    const key = this.getCacheKey(repoPath);
    await this.storage.update(key, undefined);
  }

  /**
   * Get the cache key for a repository
   */
  private getCacheKey(repoPath: string): string {
    // Use a hash of the path to avoid issues with special characters
    const hash = this.simpleHash(repoPath);
    return `${CACHE_KEY_PREFIX}${hash}`;
  }

  /**
   * Simple hash function for cache keys
   */
  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(36);
  }
}
