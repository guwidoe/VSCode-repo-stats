import { describe, expect, it } from 'vitest';
import { parseSubmoduleStatusPaths } from './workspaceRepositoryScanner.js';

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
