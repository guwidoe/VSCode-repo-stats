/**
 * Cache Manager - Handles caching of analysis results.
 * Uses an abstract storage interface for testability.
 */

import * as crypto from 'crypto';
import {
  BlameFileCacheEntry,
  CacheStructure,
  AnalysisResult,
  TreemapNode,
} from '../types/index.js';

const CACHE_VERSION = '2.0.0';

export interface CacheStorage {
  get<T>(key: string): T | undefined;
  set<T>(key: string, value: T): Promise<void>;
}

export class CacheManager {
  private readonly keyPrefix: string;

  constructor(
    private readonly storage: CacheStorage,
    cacheId: string
  ) {
    this.keyPrefix = `repoStats_${this.hashId(cacheId)}`;
  }

  isValid(currentRevisionHash: string, settingsHash?: string): boolean {
    const cache = this.getCache();
    if (!cache) {return false;}
    if (cache.version !== CACHE_VERSION) {return false;}
    if (cache.revisionHash !== currentRevisionHash) {return false;}
    if (settingsHash !== undefined && cache.settingsHash !== settingsHash) {return false;}
    return true;
  }

  getIfValid(currentRevisionHash: string, settingsHash?: string): AnalysisResult | null {
    if (!this.isValid(currentRevisionHash, settingsHash)) {
      return null;
    }

    return this.getCache()?.data ?? null;
  }

  getBlameFileCaches(): Record<string, Record<string, BlameFileCacheEntry>> {
    const cache = this.getCache();
    return cache?.blameFileCaches ?? {};
  }

  async save(
    result: AnalysisResult,
    revisionHash: string,
    blameFileCaches: Record<string, Record<string, BlameFileCacheEntry>> = {},
    settingsHash?: string
  ): Promise<void> {
    const cache: CacheStructure = {
      version: CACHE_VERSION,
      targetId: result.target.id,
      revisionHash,
      settingsHash,
      lastAnalyzed: Date.now(),
      data: result,
      blameFileCaches,
      fileLOC: this.buildFileLOCMap(result.fileTree),
    };

    await this.storage.set(this.keyPrefix, cache);
  }

  async clear(): Promise<void> {
    await this.storage.set(this.keyPrefix, undefined);
  }

  getLastAnalyzed(): Date | null {
    const cache = this.getCache();
    if (!cache) {
      return null;
    }
    return new Date(cache.lastAnalyzed);
  }

  private getCache(): CacheStructure | null {
    const cached = this.storage.get<CacheStructure>(this.keyPrefix);
    return cached ?? null;
  }

  private hashId(value: string): string {
    return crypto.createHash('md5').update(value).digest('hex').slice(0, 8);
  }

  private buildFileLOCMap(
    node: TreemapNode,
    map: Record<string, { sha: string; lines: number; language: string }> = {}
  ): Record<string, { sha: string; lines: number; language: string }> {
    if (node.type === 'file') {
      map[node.path] = {
        sha: '',
        lines: node.lines ?? 0,
        language: node.language ?? 'Unknown',
      };
    }

    for (const child of node.children ?? []) {
      this.buildFileLOCMap(child, map);
    }

    return map;
  }
}

export class InMemoryCacheStorage implements CacheStorage {
  private readonly store = new Map<string, unknown>();

  get<T>(key: string): T | undefined {
    return this.store.get(key) as T | undefined;
  }

  async set<T>(key: string, value: T): Promise<void> {
    if (value === undefined) {
      this.store.delete(key);
    } else {
      this.store.set(key, value);
    }
  }
}
