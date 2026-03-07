import { describe, expect, it } from 'vitest';
import {
  createPathPatternMatcher,
  getLiteralExcludeDirNames,
  matchesPathPattern,
} from './pathMatching';

describe('matchesPathPattern', () => {
  it('matches root-level paths for leading ** patterns', () => {
    expect(matchesPathPattern('backend/fixtures/seed.ts', '**/backend/fixtures/**')).toBe(true);
  });

  it('matches plain directory names anywhere in the tree', () => {
    expect(matchesPathPattern('packages/api/vendor/index.js', 'vendor')).toBe(true);
    expect(matchesPathPattern('vendor/index.js', 'vendor')).toBe(true);
    expect(matchesPathPattern('packages/api/source/index.js', 'vendor')).toBe(false);
  });
});

describe('createPathPatternMatcher', () => {
  it('returns false when no patterns are configured', () => {
    expect(createPathPatternMatcher([])('src/app.ts')).toBe(false);
  });
});

describe('getLiteralExcludeDirNames', () => {
  it('keeps only simple directory names for scc optimization', () => {
    expect(getLiteralExcludeDirNames(['vendor', 'backend/fixtures', '**/cache/**'])).toEqual([
      'vendor',
    ]);
  });
});
