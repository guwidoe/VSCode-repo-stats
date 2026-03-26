import { describe, expect, it, beforeEach } from 'vitest';
import { InMemoryCacheStorage } from './cacheManager';
import { EvolutionCacheManager } from './evolutionCacheManager';
import { normalizeEvolutionResult, type EvolutionResult } from '../types';

describe('EvolutionCacheManager', () => {
  let storage: InMemoryCacheStorage;
  let cacheManager: EvolutionCacheManager;

  const mockResult: EvolutionResult = normalizeEvolutionResult({
    generatedAt: '2026-03-05T00:00:00.000Z',
    targetId: 'repo:/tmp/repo',
    historyMode: 'singleBranch',
    revisionHash: 'rev-1',
    settingsHash: 'settings-hash-1',
    memberHeads: [
      {
        repositoryId: '/tmp/repo',
        repositoryName: 'repo',
        branch: 'main',
        headSha: 'abc123',
      },
    ],
    cohorts: {
      ts: ['2024-01-01T00:00:00.000Z'],
      labels: ['2024'],
      y: [[100]],
    },
    authors: {
      ts: ['2024-01-01T00:00:00.000Z'],
      labels: ['Alice'],
      y: [[100]],
    },
    exts: {
      ts: ['2024-01-01T00:00:00.000Z'],
      labels: ['.ts'],
      y: [[100]],
    },
    dirs: {
      ts: ['2024-01-01T00:00:00.000Z'],
      labels: ['src/'],
      y: [[100]],
    },
    domains: {
      ts: ['2024-01-01T00:00:00.000Z'],
      labels: ['example.com'],
      y: [[100]],
    },
  });

  beforeEach(() => {
    storage = new InMemoryCacheStorage();
    cacheManager = new EvolutionCacheManager(storage, 'repo:/tmp/repo');
  });

  it('returns null when cache is empty', () => {
    expect(cacheManager.getIfValid('rev-1', 'settings-hash-1')).toBeNull();
  });

  it('saves and retrieves valid evolution result', async () => {
    await cacheManager.save(mockResult);

    const cached = cacheManager.getIfValid('rev-1', 'settings-hash-1');
    expect(cached).not.toBeNull();
    expect(cached?.authors.labels).toContain('Alice');
  });

  it('invalidates cache when revision changes', async () => {
    await cacheManager.save(mockResult);

    const cached = cacheManager.getIfValid('rev-2', 'settings-hash-1');
    expect(cached).toBeNull();
  });

  it('invalidates cache when settings hash changes', async () => {
    await cacheManager.save(mockResult);

    const cached = cacheManager.getIfValid('rev-1', 'settings-hash-2');
    expect(cached).toBeNull();
  });

  it('returns latest cache regardless of validity checks', async () => {
    await cacheManager.save(mockResult);

    const latest = cacheManager.getLatest();
    expect(latest).not.toBeNull();
    expect(latest?.memberHeads[0]?.headSha).toBe('abc123');
  });

  it('clears cache', async () => {
    await cacheManager.save(mockResult);
    await cacheManager.clear();

    expect(cacheManager.getLatest()).toBeNull();
  });

  it('treats malformed cached latest data as a cache miss and clears it', async () => {
    const keyPrefix = (cacheManager as unknown as { keyPrefix: string }).keyPrefix;
    await storage.set(keyPrefix, {
      version: '2.0.0',
      targetId: mockResult.targetId,
      lastAnalyzed: Date.now(),
      data: {
        ...mockResult,
        extensions: undefined,
        directories: undefined,
        exts: undefined,
        dirs: undefined,
      },
    });

    expect(cacheManager.getLatest()).toBeNull();
    expect(storage.get(keyPrefix)).toBeUndefined();
  });

  it('treats malformed cached valid data as a cache miss and clears it', async () => {
    const keyPrefix = (cacheManager as unknown as { keyPrefix: string }).keyPrefix;
    await storage.set(keyPrefix, {
      version: '2.0.0',
      targetId: mockResult.targetId,
      lastAnalyzed: Date.now(),
      data: {
        ...mockResult,
        extensions: undefined,
        directories: undefined,
        exts: undefined,
        dirs: undefined,
      },
    });

    expect(cacheManager.getIfValid('rev-1', 'settings-hash-1')).toBeNull();
    expect(storage.get(keyPrefix)).toBeUndefined();
  });
});
