/**
 * Evolution Cache Manager - Handles caching of evolution analysis results.
 */

import * as crypto from 'crypto';
import { EvolutionResult, normalizeEvolutionResult } from '../types/index.js';
import type { CacheStorage } from './cacheManager.js';

const EVOLUTION_CACHE_VERSION = '2.0.0';

interface EvolutionCacheStructure {
  version: string;
  targetId: string;
  lastAnalyzed: number;
  data: EvolutionResult;
}

export class EvolutionCacheManager {
  private readonly keyPrefix: string;

  constructor(
    private readonly storage: CacheStorage,
    targetId: string
  ) {
    this.keyPrefix = `repoStatsEvolution_${this.hashId(targetId)}`;
  }

  getIfValid(revisionHash: string, settingsHash: string): EvolutionResult | null {
    const cache = this.getCache();
    if (!cache) {
      return null;
    }

    if (cache.version !== EVOLUTION_CACHE_VERSION) {
      return null;
    }

    if (cache.data.revisionHash !== revisionHash) {
      return null;
    }

    if (cache.data.settingsHash !== settingsHash) {
      return null;
    }

    return this.normalizeCachedResult(cache.data);
  }

  getLatest(): EvolutionResult | null {
    const cache = this.getCache();
    if (!cache || cache.version !== EVOLUTION_CACHE_VERSION) {
      return null;
    }

    return this.normalizeCachedResult(cache.data);
  }

  async save(result: EvolutionResult): Promise<void> {
    const cache: EvolutionCacheStructure = {
      version: EVOLUTION_CACHE_VERSION,
      targetId: result.targetId,
      lastAnalyzed: Date.now(),
      data: normalizeEvolutionResult(result),
    };

    await this.storage.set(this.keyPrefix, cache);
  }

  async clear(): Promise<void> {
    await this.storage.set(this.keyPrefix, undefined);
  }

  private getCache(): EvolutionCacheStructure | null {
    const cached = this.storage.get<EvolutionCacheStructure>(this.keyPrefix);
    return cached ?? null;
  }

  private normalizeCachedResult(result: EvolutionResult): EvolutionResult | null {
    try {
      return normalizeEvolutionResult(result);
    } catch (error) {
      console.warn('Discarding malformed evolution cache entry.', error);
      void this.clear();
      return null;
    }
  }

  private hashId(value: string): string {
    return crypto.createHash('md5').update(value).digest('hex').slice(0, 8);
  }
}
