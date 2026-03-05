import { describe, expect, it } from 'vitest';
import {
  createDefaultFilter,
  DEFAULT_SORT_RULES,
  filterFiles,
  isColumnFilterActive,
  sortFiles,
  updateSortRules,
} from './fileTableLogic';
import type { ColumnFilters, FileRow, SortRule } from './types';

const rows: FileRow[] = [
  {
    path: 'src/app.ts',
    name: 'app.ts',
    ext: '.ts',
    language: 'TypeScript',
    lines: 200,
    bytes: 8000,
    binary: false,
    generated: false,
    isCode: true,
    complexity: 12,
    commentLines: 25,
    blankLines: 20,
    lastModified: '2026-03-01T10:00:00.000Z',
    lastModifiedEpoch: Date.parse('2026-03-01T10:00:00.000Z'),
    pathLower: 'src/app.ts',
    nameLower: 'app.ts',
  },
  {
    path: 'dist/bundle.generated.js',
    name: 'bundle.generated.js',
    ext: '.js',
    language: 'JavaScript',
    lines: 600,
    bytes: 22000,
    binary: false,
    generated: true,
    isCode: true,
    complexity: 0,
    commentLines: 2,
    blankLines: 3,
    lastModified: '2026-02-01T10:00:00.000Z',
    lastModifiedEpoch: Date.parse('2026-02-01T10:00:00.000Z'),
    pathLower: 'dist/bundle.generated.js',
    nameLower: 'bundle.generated.js',
  },
  {
    path: 'assets/logo.png',
    name: 'logo.png',
    ext: '.png',
    language: 'Unknown',
    lines: 0,
    bytes: 45000,
    binary: true,
    generated: false,
    isCode: false,
    complexity: 0,
    commentLines: 0,
    blankLines: 0,
    lastModified: undefined,
    lastModifiedEpoch: 0,
    pathLower: 'assets/logo.png',
    nameLower: 'logo.png',
  },
];

describe('fileTableLogic', () => {
  it('uses default LOC-desc sorting', () => {
    const sorted = sortFiles(rows, DEFAULT_SORT_RULES);
    expect(sorted.map((row) => row.path)).toEqual([
      'dist/bundle.generated.js',
      'src/app.ts',
      'assets/logo.png',
    ]);
  });

  it('applies stable multi-column sorting', () => {
    const sortRules: SortRule[] = [
      { key: 'generated', direction: 'asc' },
      { key: 'lines', direction: 'desc' },
    ];

    const sorted = sortFiles(rows, sortRules);
    expect(sorted.map((row) => row.path)).toEqual([
      'src/app.ts',
      'assets/logo.png',
      'dist/bundle.generated.js',
    ]);
  });

  it('filters by text, range, date, and boolean column filters', () => {
    const filters: ColumnFilters = {
      name: { kind: 'text', value: 'bundle' },
      generated: { kind: 'boolean', mode: 'true' },
      lines: { kind: 'number', min: '500', max: '' },
      bytes: { kind: 'number', min: '', max: '23000' },
      lastModified: { kind: 'date', from: '2026-01-20', to: '2026-02-28' },
    };

    const filtered = filterFiles(rows, filters);
    expect(filtered.map((row) => row.path)).toEqual(['dist/bundle.generated.js']);
  });

  it('supports combined language/extension text filters', () => {
    const filters: ColumnFilters = {
      language: { kind: 'text', value: 'type' },
      ext: { kind: 'text', value: '.ts' },
      isCode: { kind: 'boolean', mode: 'true' },
    };

    const filtered = filterFiles(rows, filters);
    expect(filtered).toHaveLength(1);
    expect(filtered[0].path).toBe('src/app.ts');
  });

  it('updates sort rules for single and multi-column mode', () => {
    const single = updateSortRules(DEFAULT_SORT_RULES, 'lines', false);
    expect(single).toEqual([{ key: 'lines', direction: 'asc' }]);

    const multi = updateSortRules(DEFAULT_SORT_RULES, 'bytes', true);
    expect(multi).toEqual([
      { key: 'lines', direction: 'desc' },
      { key: 'bytes', direction: 'desc' },
    ]);
  });

  it('creates default filters and tracks active state', () => {
    const text = createDefaultFilter('text');
    const number = createDefaultFilter('number');
    const bool = createDefaultFilter('boolean');

    expect(isColumnFilterActive(text)).toBe(false);
    expect(isColumnFilterActive(number)).toBe(false);
    expect(isColumnFilterActive(bool)).toBe(false);

    expect(isColumnFilterActive({ kind: 'text', value: 'abc' })).toBe(true);
    expect(isColumnFilterActive({ kind: 'number', min: '1', max: '' })).toBe(true);
    expect(isColumnFilterActive({ kind: 'boolean', mode: 'false' })).toBe(true);
  });
});
