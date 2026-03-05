import { describe, expect, it } from 'vitest';
import { buildBinaryExtensionSet } from '../utils/fileTypes';
import { DEFAULT_GENERATED_PATTERNS } from '../utils/fileClassification';
import { buildFileCatalog } from './useFileCatalog';
import type { TreemapNode } from '../types';

const mockFileTree: TreemapNode = {
  name: 'demo',
  path: '',
  type: 'directory',
  children: [
    {
      name: 'src',
      path: 'src',
      type: 'directory',
      children: [
        {
          name: 'app.ts',
          path: 'src/app.ts',
          type: 'file',
          lines: 120,
          bytes: 4500,
          language: 'TypeScript',
          complexity: 9,
        },
        {
          name: 'bundle.generated.js',
          path: 'src/bundle.generated.js',
          type: 'file',
          lines: 700,
          bytes: 18000,
          language: 'JavaScript',
        },
      ],
    },
    {
      name: 'assets',
      path: 'assets',
      type: 'directory',
      children: [
        {
          name: 'logo.png',
          path: 'assets/logo.png',
          type: 'file',
          lines: 0,
          bytes: 5300,
          language: 'Unknown',
          binary: true,
        },
      ],
    },
  ],
};

describe('buildFileCatalog', () => {
  it('flattens the file tree into rows', () => {
    const catalog = buildFileCatalog(
      mockFileTree,
      DEFAULT_GENERATED_PATTERNS,
      buildBinaryExtensionSet(undefined)
    );

    expect(catalog.rows).toHaveLength(3);
    expect(catalog.rows.map((row) => row.path)).toEqual([
      'src/app.ts',
      'src/bundle.generated.js',
      'assets/logo.png',
    ]);
  });

  it('computes metadata flags and filter options', () => {
    const catalog = buildFileCatalog(
      mockFileTree,
      DEFAULT_GENERATED_PATTERNS,
      buildBinaryExtensionSet(undefined)
    );

    const generated = catalog.rows.find((row) => row.path === 'src/bundle.generated.js');
    expect(generated?.generated).toBe(true);
    expect(generated?.isCode).toBe(true);
    expect(generated?.blamedLines).toBe(0);

    const binary = catalog.rows.find((row) => row.path === 'assets/logo.png');
    expect(binary?.binary).toBe(true);
    expect(binary?.ext).toBe('.png');

    expect(catalog.languages).toContain('TypeScript');
    expect(catalog.extensions).toContain('.js');
    expect(catalog.extensions).toContain('.png');
  });
});
