import { describe, expect, it } from 'vitest';
import { normalizeBookmarkedRepositoryPaths } from './bookmarkedRepositoryConfig.js';

describe('normalizeBookmarkedRepositoryPaths', () => {
  it('returns an empty list for non-array config values', () => {
    expect(normalizeBookmarkedRepositoryPaths(undefined)).toEqual([]);
    expect(normalizeBookmarkedRepositoryPaths('bad')).toEqual([]);
  });

  it('keeps only non-empty strings and resolves them', () => {
    expect(normalizeBookmarkedRepositoryPaths([' /tmp/example ', '', 42, '../repo'])).toEqual([
      '/tmp/example',
      expect.stringMatching(/repo$/),
    ]);
  });
});
