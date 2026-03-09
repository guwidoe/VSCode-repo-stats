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

  it('treats slash-separated plain paths as repo-relative prefixes', () => {
    expect(matchesPathPattern('backend/fixtures/seed.ts', 'backend/fixtures')).toBe(true);
    expect(matchesPathPattern('packages/backend/fixtures/seed.ts', 'backend/fixtures')).toBe(false);
  });

  it('supports exact file paths without requiring glob syntax', () => {
    expect(matchesPathPattern('src/components/index.ts', 'src/components/index.ts')).toBe(true);
    expect(matchesPathPattern('src/components/index.ts.map', 'src/components/index.ts')).toBe(false);
    expect(matchesPathPattern('README.md', '/README.md')).toBe(true);
    expect(matchesPathPattern('docs/README.md', '/README.md')).toBe(false);
  });
});

describe('createPathPatternMatcher', () => {
  it('returns false when no patterns are configured', () => {
    expect(createPathPatternMatcher([])('src/app.ts')).toBe(false);
  });

  it('supports mixed plain and anchored patterns', () => {
    const matcher = createPathPatternMatcher(['vendor', '/README.md']);

    expect(matcher('packages/app/vendor/index.js')).toBe(true);
    expect(matcher('README.md')).toBe(true);
    expect(matcher('docs/README.md')).toBe(false);
  });
});

describe('getLiteralExcludeDirNames', () => {
  it('keeps only simple directory names for scc optimization', () => {
    expect(getLiteralExcludeDirNames(['vendor', 'backend/fixtures', '**/cache/**'])).toEqual([
      'vendor',
    ]);
  });
});
