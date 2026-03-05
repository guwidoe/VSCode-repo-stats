/**
 * Evolution Cache Manager - Handles caching of evolution analysis results.
 */

import * as crypto from 'crypto';
import { EvolutionResult } from '../types/index.js';
import type { CacheStorage } from './cacheManager.js';

const EVOLUTION_CACHE_VERSION = '1.0.0';

interface EvolutionCacheStructure {
  version: string;
  repoPath: string;
  lastAnalyzed: number;
  data: EvolutionResult;
}

export class EvolutionCacheManager {
  private readonly storage: CacheStorage;
  private readonly keyPrefix: string;

  constructor(storage: CacheStorage, repoPath: string) {
    this.storage = storage;
    this.keyPrefix = `repoStatsEvolution_${this.hashPath(repoPath)}`;
  }

  getIfValid(currentHeadSha: string, branch: string, settingsHash: string): EvolutionResult | null {
    const cache = this.getCache();
    if (!cache) {
      return null;
    }

    if (cache.version !== EVOLUTION_CACHE_VERSION) {
      return null;
    }

    if (cache.data.headSha !== currentHeadSha) {
      return null;
    }

    if (cache.data.branch !== branch) {
      return null;
    }

    if (cache.data.settingsHash !== settingsHash) {
      return null;
    }

    return cache.data;
  }

  getLatest(): EvolutionResult | null {
    const cache = this.getCache();
    if (!cache) {
      return null;
    }

    if (cache.version !== EVOLUTION_CACHE_VERSION) {
      return null;
    }

    return cache.data;
  }

  save(result: EvolutionResult, repoPath: string): void {
    const cache: EvolutionCacheStructure = {
      version: EVOLUTION_CACHE_VERSION,
      repoPath,
      lastAnalyzed: Date.now(),
      data: result,
    };

    this.storage.set(this.keyPrefix, cache);
  }

  clear(): void {
    this.storage.set(this.keyPrefix, undefined);
  }

  private getCache(): EvolutionCacheStructure | null {
    const cached = this.storage.get<EvolutionCacheStructure>(this.keyPrefix);
    return cached || null;
  }

  private hashPath(path: string): string {
    return crypto.createHash('md5').update(path).digest('hex').slice(0, 8);
  }
}

export function createEvolutionCacheManager(storage: CacheStorage, repoPath: string): EvolutionCacheManager {
  return new EvolutionCacheManager(storage, repoPath);
}
