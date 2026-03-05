import { describe, expect, it, beforeEach } from 'vitest';
import { InMemoryCacheStorage } from './cacheManager';
import { EvolutionCacheManager } from './evolutionCacheManager';
import type { EvolutionResult } from '../types';

describe('EvolutionCacheManager', () => {
  let storage: InMemoryCacheStorage;
  let cacheManager: EvolutionCacheManager;

  const mockResult: EvolutionResult = {
    generatedAt: '2026-03-05T00:00:00.000Z',
    headSha: 'abc123',
    branch: 'main',
    settingsHash: 'settings-hash-1',
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
  };

  beforeEach(() => {
    storage = new InMemoryCacheStorage();
    cacheManager = new EvolutionCacheManager(storage, '/tmp/repo');
  });

  it('returns null when cache is empty', () => {
    expect(cacheManager.getIfValid('abc123', 'main', 'settings-hash-1')).toBeNull();
  });

  it('saves and retrieves valid evolution result', () => {
    cacheManager.save(mockResult, '/tmp/repo');

    const cached = cacheManager.getIfValid('abc123', 'main', 'settings-hash-1');
    expect(cached).not.toBeNull();
    expect(cached?.authors.labels).toContain('Alice');
  });

  it('invalidates cache when HEAD changes', () => {
    cacheManager.save(mockResult, '/tmp/repo');

    const cached = cacheManager.getIfValid('def456', 'main', 'settings-hash-1');
    expect(cached).toBeNull();
  });

  it('invalidates cache when settings hash changes', () => {
    cacheManager.save(mockResult, '/tmp/repo');

    const cached = cacheManager.getIfValid('abc123', 'main', 'settings-hash-2');
    expect(cached).toBeNull();
  });

  it('returns latest cache regardless of validity checks', () => {
    cacheManager.save(mockResult, '/tmp/repo');

    const latest = cacheManager.getLatest();
    expect(latest).not.toBeNull();
    expect(latest?.headSha).toBe('abc123');
  });

  it('clears cache', () => {
    cacheManager.save(mockResult, '/tmp/repo');
    cacheManager.clear();

    expect(cacheManager.getLatest()).toBeNull();
  });
});
