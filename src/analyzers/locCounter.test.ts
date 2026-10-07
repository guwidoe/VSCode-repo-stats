/**
 * Tests for LOC extension filtering helpers.
 */

import { afterEach, describe, it, expect } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';
import { execFileSync } from 'child_process';
import {
  createGitIgnoredPathMatcher,
  listGitIgnoredPaths,
  normalizeExtensionForFilter,
  parseGitIgnoredPaths,
  parseSccLanguageGroups,
  shouldExcludeFileByExtension,
} from './locCounter';

describe('normalizeExtensionForFilter', () => {
  it('normalizes extension values to lowercase dot-prefixed format', () => {
    expect(normalizeExtensionForFilter('.svg')).toBe('.svg');
    expect(normalizeExtensionForFilter('svg')).toBe('.svg');
    expect(normalizeExtensionForFilter('  .SVG  ')).toBe('.svg');
    expect(normalizeExtensionForFilter('TSX')).toBe('.tsx');
  });

  it('accepts common glob-like forms used by users', () => {
    expect(normalizeExtensionForFilter('*.svg')).toBe('.svg');
    expect(normalizeExtensionForFilter('**/*.svg')).toBe('.svg');
    expect(normalizeExtensionForFilter('assets/*.svg')).toBe('.svg');
  });

  it('returns null for invalid extension values', () => {
    expect(normalizeExtensionForFilter('')).toBeNull();
    expect(normalizeExtensionForFilter('   ')).toBeNull();
    expect(normalizeExtensionForFilter('.')).toBeNull();
    expect(normalizeExtensionForFilter('folder/svg')).toBeNull();
    expect(normalizeExtensionForFilter('assets/icons')).toBeNull();
    expect(normalizeExtensionForFilter('*')).toBeNull();
  });
});

describe('shouldExcludeFileByExtension', () => {
  it('matches excluded extensions case-insensitively', () => {
    const excluded = new Set(['.svg', '.png']);

    expect(shouldExcludeFileByExtension('icons/logo.svg', excluded)).toBe(true);
    expect(shouldExcludeFileByExtension('icons/LOGO.SVG', excluded)).toBe(true);
    expect(shouldExcludeFileByExtension('icons\\logo.SVG', excluded)).toBe(true);
    expect(shouldExcludeFileByExtension('icons/logo.jpg', excluded)).toBe(false);
  });

  it('supports dotfile names when configured explicitly', () => {
    const excluded = new Set(['.env']);

    expect(shouldExcludeFileByExtension('.env', excluded)).toBe(true);
    expect(shouldExcludeFileByExtension('config/.ENV', excluded)).toBe(true);
    expect(shouldExcludeFileByExtension('config/.env.local', excluded)).toBe(false);
  });

  it('returns false when exclusion set is empty', () => {
    expect(shouldExcludeFileByExtension('icons/logo.svg', new Set())).toBe(false);
  });
});

describe('parseSccLanguageGroups', () => {
  it('accepts valid scc by-file output', () => {
    expect(parseSccLanguageGroups(JSON.stringify([
      {
        Name: 'TypeScript',
        Files: [
          {
            Location: '/repo/src/index.ts',
            Code: 10,
            Lines: 14,
            Blank: 2,
            Comment: 2,
            Complexity: 1,
          },
        ],
      },
    ]))).toEqual([
      {
        Name: 'TypeScript',
        Files: [
          {
            Location: '/repo/src/index.ts',
            Code: 10,
            Lines: 14,
            Blank: 2,
            Comment: 2,
            Complexity: 1,
          },
        ],
      },
    ]);
  });

  it('rejects malformed scc output shapes', () => {
    expect(() => parseSccLanguageGroups(JSON.stringify([{ Name: 'TypeScript', Files: [{}] }]))).toThrow(
      'Received invalid scc JSON output.'
    );
  });
});

describe('parseGitIgnoredPaths', () => {
  it('splits NUL-separated git output into directories and files', () => {
    expect(parseGitIgnoredPaths('.claude/worktrees/\0build/\0backend/plan\0')).toEqual({
      directories: ['.claude/worktrees', 'build'],
      files: ['backend/plan'],
    });
  });

  it('returns empty lists for empty output', () => {
    expect(parseGitIgnoredPaths('')).toEqual({ directories: [], files: [] });
  });
});

describe('createGitIgnoredPathMatcher', () => {
  it('matches ignored files exactly and anything below ignored directories', () => {
    const isIgnored = createGitIgnoredPathMatcher({
      directories: ['.claude/worktrees'],
      files: ['backend/plan'],
    });

    expect(isIgnored('.claude/worktrees/agent-a/src/index.ts')).toBe(true);
    expect(isIgnored('backend/plan')).toBe(true);
    expect(isIgnored('.claude/worktrees-notes.md')).toBe(false);
    expect(isIgnored('backend/planner.ts')).toBe(false);
    expect(isIgnored('.claude/settings.json')).toBe(false);
  });
});

describe('listGitIgnoredPaths', () => {
  let repoPath: string | undefined;

  afterEach(() => {
    if (repoPath) {
      rmSync(repoPath, { recursive: true, force: true });
      repoPath = undefined;
    }
  });

  it('includes paths ignored via .git/info/exclude, which scc does not read', async () => {
    repoPath = mkdtempSync(path.join(tmpdir(), 'repo-stats-loc-ignored-'));
    execFileSync('git', ['init', '--quiet'], { cwd: repoPath });

    mkdirSync(path.join(repoPath, '.claude', 'worktrees', 'agent-a'), { recursive: true });
    writeFileSync(path.join(repoPath, '.claude', 'worktrees', 'agent-a', 'index.ts'), 'x;\n');
    writeFileSync(path.join(repoPath, '.claude', 'settings.json'), '{}\n');
    mkdirSync(path.join(repoPath, 'dist'));
    writeFileSync(path.join(repoPath, 'dist', 'bundle.js'), 'x;\n');
    writeFileSync(path.join(repoPath, 'local.log'), 'log\n');
    writeFileSync(path.join(repoPath, 'index.ts'), 'x;\n');
    writeFileSync(path.join(repoPath, '.gitignore'), 'dist/\n');
    writeFileSync(
      path.join(repoPath, '.git', 'info', 'exclude'),
      '.claude/worktrees/\nlocal.log\n'
    );

    const ignored = await listGitIgnoredPaths(repoPath);

    expect(ignored.directories.sort()).toEqual(['.claude/worktrees', 'dist']);
    expect(ignored.files).toEqual(['local.log']);
  });

  it('fails loudly when the path is not a git repository', async () => {
    repoPath = mkdtempSync(path.join(tmpdir(), 'repo-stats-loc-not-git-'));
    writeFileSync(path.join(repoPath, '.git'), 'not a repository\n');

    await expect(listGitIgnoredPaths(repoPath)).rejects.toThrow();
  });
});
