/**
 * Tests for the CacheManager.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { CacheManager, InMemoryCacheStorage } from './cacheManager';
import type { AnalysisResult } from '../types/index';

describe('CacheManager', () => {
  let storage: InMemoryCacheStorage;
  let cacheManager: CacheManager;

  const mockResult: AnalysisResult = {
    repository: {
      name: 'test-repo',
      path: '/path/to/repo',
      branch: 'main',
      commitCount: 100,
      headSha: 'abc123',
    },
    contributors: [
      {
        name: 'Test User',
        email: 'test@example.com',
        commits: 50,
        linesAdded: 1000,
        linesDeleted: 500,
        firstCommit: '2024-01-01T00:00:00Z',
        lastCommit: '2024-12-01T00:00:00Z',
        weeklyActivity: [],
      },
    ],
    codeFrequency: [
      {
        week: '2024-W01',
        additions: 100,
        deletions: 50,
        netChange: 50,
      },
    ],
    fileTree: {
      name: 'test-repo',
      path: '',
      type: 'directory',
      lines: 1000,
      children: [],
    },
    analyzedAt: '2024-12-01T00:00:00Z',
  };

  beforeEach(() => {
    storage = new InMemoryCacheStorage();
    cacheManager = new CacheManager(storage, '/path/to/repo');
  });

  describe('isValid', () => {
    it('should return false for empty cache', () => {
      expect(cacheManager.isValid('abc123')).toBe(false);
    });

    it('should return true for valid cache with matching SHA', () => {
      cacheManager.save(mockResult);
      expect(cacheManager.isValid('abc123')).toBe(true);
    });

    it('should return false for cache with different SHA', () => {
      cacheManager.save(mockResult);
      expect(cacheManager.isValid('xyz789')).toBe(false);
    });
  });

  describe('save and getIfValid', () => {
    it('should save and retrieve analysis result', () => {
      cacheManager.save(mockResult);
      const cached = cacheManager.getIfValid('abc123');

      expect(cached).not.toBeNull();
      expect(cached?.contributors).toHaveLength(1);
      expect(cached?.contributors[0].name).toBe('Test User');
      expect(cached?.codeFrequency).toHaveLength(1);
    });

    it('should return null for invalid SHA', () => {
      cacheManager.save(mockResult);
      const cached = cacheManager.getIfValid('wrong-sha');

      expect(cached).toBeNull();
    });
  });

  describe('clear', () => {
    it('should clear the cache', () => {
      cacheManager.save(mockResult);
      expect(cacheManager.isValid('abc123')).toBe(true);

      cacheManager.clear();
      expect(cacheManager.isValid('abc123')).toBe(false);
    });
  });

  describe('getLastAnalyzed', () => {
    it('should return null for empty cache', () => {
      expect(cacheManager.getLastAnalyzed()).toBeNull();
    });

    it('should return date for cached result', () => {
      cacheManager.save(mockResult);
      const lastAnalyzed = cacheManager.getLastAnalyzed();

      expect(lastAnalyzed).toBeInstanceOf(Date);
    });
  });
});

describe('InMemoryCacheStorage', () => {
  let storage: InMemoryCacheStorage;

  beforeEach(() => {
    storage = new InMemoryCacheStorage();
  });

  it('should store and retrieve values', () => {
    storage.set('key', { value: 'test' });
    expect(storage.get('key')).toEqual({ value: 'test' });
  });

  it('should return undefined for missing keys', () => {
    expect(storage.get('missing')).toBeUndefined();
  });

  it('should delete values when set to undefined', () => {
    storage.set('key', { value: 'test' });
    storage.set('key', undefined);
    expect(storage.get('key')).toBeUndefined();
  });
});
