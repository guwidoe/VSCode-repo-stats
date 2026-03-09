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
    commitAnalytics: {
      authorDirectory: {
        idByEmail: { 'test@example.com': 0 },
        namesById: ['Test User'],
        emailsById: ['test@example.com'],
      },
      records: [
        {
          sha: 'abc123',
          authorId: 0,
          committedAt: '2024-12-01T00:00:00Z',
          timestamp: 1733011200,
          summary: 'test commit',
          additions: 100,
          deletions: 50,
          changedLines: 150,
          filesChanged: 3,
        },
      ],
      summary: {
        totalCommits: 1,
        totalAdditions: 100,
        totalDeletions: 50,
        totalChangedLines: 150,
        averageChangedLines: 150,
        medianChangedLines: 150,
        averageFilesChanged: 3,
      },
      contributorSummaries: [
        {
          authorId: 0,
          authorName: 'Test User',
          authorEmail: 'test@example.com',
          totalCommits: 1,
          totalAdditions: 100,
          totalDeletions: 50,
          totalChangedLines: 150,
          averageChangedLines: 150,
          medianChangedLines: 150,
          averageFilesChanged: 3,
        },
      ],
      changedLineBuckets: [],
      fileChangeBuckets: [],
      indexes: { byTimestampAsc: [0], byAdditionsDesc: [0], byDeletionsDesc: [0], byChangedLinesDesc: [0], byFilesChangedDesc: [0] },
    },
    fileTree: {
      name: 'test-repo',
      path: '',
      type: 'directory',
      lines: 1000,
      children: [],
    },
    analyzedAt: '2024-12-01T00:00:00Z',
    analyzedCommitCount: 100,
    maxCommitsLimit: 10000,
    limitReached: false,
    sccInfo: { version: '3.5.0', source: 'system' },
    blameMetrics: {
      analyzedAt: '2024-12-01T00:00:00Z',
      maxAgeDays: 30,
      ageByDay: [10, 5, 1],
      ownershipByAuthor: [
        { author: 'Test User', email: 'test@example.com', lines: 16 },
      ],
      totals: {
        totalBlamedLines: 16,
        filesAnalyzed: 1,
        filesSkipped: 0,
        cacheHits: 0,
      },
    },
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
      cacheManager.save(mockResult, {}, 'settings-hash-1');
      expect(cacheManager.isValid('abc123', 'settings-hash-1')).toBe(true);
    });

    it('should return false for cache with different SHA', () => {
      cacheManager.save(mockResult, {}, 'settings-hash-1');
      expect(cacheManager.isValid('xyz789', 'settings-hash-1')).toBe(false);
    });

    it('should return false for cache with different settings hash', () => {
      cacheManager.save(mockResult, {}, 'settings-hash-1');
      expect(cacheManager.isValid('abc123', 'settings-hash-2')).toBe(false);
    });
  });

  describe('save and getIfValid', () => {
    it('should save and retrieve analysis result', () => {
      cacheManager.save(mockResult, {}, 'settings-hash-1');
      const cached = cacheManager.getIfValid('abc123', 'settings-hash-1');

      expect(cached).not.toBeNull();
      expect(cached?.contributors).toHaveLength(1);
      expect(cached?.contributors[0].name).toBe('Test User');
      expect(cached?.codeFrequency).toHaveLength(1);
      expect(cached?.blameMetrics.totals.totalBlamedLines).toBe(16);
    });

    it('should return null for invalid SHA', () => {
      cacheManager.save(mockResult, {}, 'settings-hash-1');
      const cached = cacheManager.getIfValid('wrong-sha', 'settings-hash-1');

      expect(cached).toBeNull();
    });

    it('should return null for invalid settings hash', () => {
      cacheManager.save(mockResult, {}, 'settings-hash-1');
      const cached = cacheManager.getIfValid('abc123', 'settings-hash-2');

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

  describe('getBlameFileCache', () => {
    it('should return cached blame file entries when available', () => {
      cacheManager.save(mockResult, {
        'src/a.ts': {
          blobSha: 'blob-a',
          totalLines: 10,
          ageCounts: [[1, 10]],
          ownership: [{ author: 'Test User', email: 'test@example.com', lines: 10 }],
          minAgeDays: 1,
          maxAgeDays: 1,
          avgAgeDays: 1,
          topOwnerAuthor: 'Test User',
          topOwnerEmail: 'test@example.com',
          topOwnerLines: 10,
          topOwnerShare: 1,
        },
      });

      const fileCache = cacheManager.getBlameFileCache();
      expect(fileCache['src/a.ts']?.blobSha).toBe('blob-a');
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
