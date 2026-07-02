import { describe, expect, it } from 'vitest';
import {
  getEnabledExcludePatterns,
  mergeExcludePatterns,
  parseSubmoduleStatusPaths,
  toFindFilesExcludePattern,
} from './workspaceRepositoryScanner.js';

describe('parseSubmoduleStatusPaths', () => {
  it('extracts submodule relative paths from git status output', () => {
    expect(parseSubmoduleStatusPaths(`
 1234567890abcdef packages/a
-abcdef0123456789 libs/b
+fedcba9876543210 nested/c
`)).toEqual(['packages/a', 'libs/b', 'nested/c']);
  });

  it('ignores blank and malformed lines', () => {
    expect(parseSubmoduleStatusPaths('not-a-match\n\n')).toEqual([]);
  });
});

describe('getEnabledExcludePatterns', () => {
  it('keeps only enabled VS Code file exclude entries', () => {
    expect(getEnabledExcludePatterns({
      '**/node_modules/**': true,
      '**/dist/**': false,
      '**/output/**': true,
      '': true,
    })).toEqual(['**/node_modules/**', '**/output/**']);
  });

  it('ignores non-object values', () => {
    expect(getEnabledExcludePatterns(undefined)).toEqual([]);
    expect(getEnabledExcludePatterns(['**/node_modules/**'])).toEqual([]);
  });
});

describe('workspace file search exclude helpers', () => {
  it('deduplicates exclude patterns while preserving order', () => {
    expect(mergeExcludePatterns([
      '**/node_modules/**',
      ' **/output/** ',
      '**/node_modules/**',
      '',
    ])).toEqual(['**/node_modules/**', '**/output/**']);
  });

  it('formats exclude patterns for vscode.workspace.findFiles', () => {
    expect(toFindFilesExcludePattern([])).toBeUndefined();
    expect(toFindFilesExcludePattern(['**/output/**'])).toBe('**/output/**');
    expect(toFindFilesExcludePattern(['**/node_modules/**', '**/output/**'])).toBe(
      '{**/node_modules/**,**/output/**}'
    );
  });
});
