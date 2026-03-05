import type { FileFilterState, FileRow, FileSortKey, SortDirection, SortRule } from './types';

const collator = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true });

const DEFAULT_DIRECTION_BY_KEY: Record<FileSortKey, SortDirection> = {
  path: 'asc',
  name: 'asc',
  ext: 'asc',
  language: 'asc',
  lines: 'desc',
  bytes: 'desc',
  generated: 'desc',
  binary: 'desc',
  isCode: 'desc',
  complexity: 'desc',
  commentLines: 'desc',
  blankLines: 'desc',
  lastModified: 'desc',
};

export const DEFAULT_SORT_RULES: SortRule[] = [
  { key: 'lines', direction: 'desc' },
];

function compareStrings(a: string, b: string): number {
  return collator.compare(a, b);
}

function compareNumbers(a: number, b: number): number {
  return a - b;
}

function compareBooleans(a: boolean, b: boolean): number {
  return Number(a) - Number(b);
}

function compareByKey(a: FileRow, b: FileRow, key: FileSortKey): number {
  switch (key) {
    case 'path':
      return compareStrings(a.pathLower, b.pathLower);
    case 'name':
      return compareStrings(a.nameLower, b.nameLower);
    case 'ext':
      return compareStrings(a.ext, b.ext);
    case 'language':
      return compareStrings(a.language, b.language);
    case 'lines':
      return compareNumbers(a.lines, b.lines);
    case 'bytes':
      return compareNumbers(a.bytes, b.bytes);
    case 'generated':
      return compareBooleans(a.generated, b.generated);
    case 'binary':
      return compareBooleans(a.binary, b.binary);
    case 'isCode':
      return compareBooleans(a.isCode, b.isCode);
    case 'complexity':
      return compareNumbers(a.complexity, b.complexity);
    case 'commentLines':
      return compareNumbers(a.commentLines, b.commentLines);
    case 'blankLines':
      return compareNumbers(a.blankLines, b.blankLines);
    case 'lastModified':
      return compareNumbers(a.lastModifiedEpoch, b.lastModifiedEpoch);
    default:
      return 0;
  }
}

export function sortFiles(rows: FileRow[], sortRules: SortRule[]): FileRow[] {
  const rules = sortRules.length > 0 ? sortRules : DEFAULT_SORT_RULES;

  return rows
    .map((row, originalIndex) => ({ row, originalIndex }))
    .sort((a, b) => {
      for (const rule of rules) {
        const result = compareByKey(a.row, b.row, rule.key);
        if (result !== 0) {
          return rule.direction === 'asc' ? result : -result;
        }
      }
      // Stable tie-breaker
      return a.originalIndex - b.originalIndex;
    })
    .map((entry) => entry.row);
}

function matchesQuery(row: FileRow, query: string): boolean {
  if (!query) {
    return true;
  }
  return row.pathLower.includes(query) || row.nameLower.includes(query);
}

function matchesRange(value: number, min: number | null, max: number | null): boolean {
  if (min !== null && value < min) {
    return false;
  }
  if (max !== null && value > max) {
    return false;
  }
  return true;
}

function matchesMode(
  flag: boolean,
  mode: FileFilterState['generatedMode']
): boolean {
  if (mode === 'all') {
    return true;
  }
  if (mode === 'only') {
    return flag;
  }
  return !flag;
}

export function filterFiles(rows: FileRow[], filters: FileFilterState): FileRow[] {
  const query = filters.query.trim().toLowerCase();
  const languageSet = filters.languages.length > 0 ? new Set(filters.languages) : null;
  const extensionSet = filters.extensions.length > 0 ? new Set(filters.extensions) : null;
  const parsedAfter = filters.modifiedAfter ? Date.parse(filters.modifiedAfter) : NaN;
  const parsedBefore = filters.modifiedBefore ? Date.parse(filters.modifiedBefore) : NaN;
  const modifiedAfter = Number.isFinite(parsedAfter) ? parsedAfter : null;
  const modifiedBefore = Number.isFinite(parsedBefore)
    ? parsedBefore + (24 * 60 * 60 * 1000) - 1
    : null;

  return rows.filter((row) => {
    if (!matchesQuery(row, query)) {
      return false;
    }

    if (languageSet && !languageSet.has(row.language)) {
      return false;
    }

    if (extensionSet && !extensionSet.has(row.ext)) {
      return false;
    }

    if (!matchesRange(row.lines, filters.locMin, filters.locMax)) {
      return false;
    }

    if (!matchesRange(row.bytes, filters.bytesMin, filters.bytesMax)) {
      return false;
    }

    if (!matchesRange(row.complexity, filters.complexityMin, filters.complexityMax)) {
      return false;
    }

    if (!matchesRange(row.commentLines, filters.commentMin, filters.commentMax)) {
      return false;
    }

    if (!matchesRange(row.blankLines, filters.blankMin, filters.blankMax)) {
      return false;
    }

    if (modifiedAfter !== null && row.lastModifiedEpoch < modifiedAfter) {
      return false;
    }

    if (modifiedBefore !== null && row.lastModifiedEpoch > modifiedBefore) {
      return false;
    }

    if (!matchesMode(row.generated, filters.generatedMode)) {
      return false;
    }

    if (!matchesMode(row.binary, filters.binaryMode)) {
      return false;
    }

    if (filters.codeOnly && !row.isCode) {
      return false;
    }

    return true;
  });
}

export function updateSortRules(
  current: SortRule[],
  key: FileSortKey,
  multiColumn: boolean
): SortRule[] {
  const defaultDirection = DEFAULT_DIRECTION_BY_KEY[key];
  const existingIndex = current.findIndex((rule) => rule.key === key);

  if (!multiColumn) {
    if (existingIndex === -1) {
      return [{ key, direction: defaultDirection }];
    }

    const existing = current[existingIndex];
    const nextDirection = existing.direction === 'asc' ? 'desc' : 'asc';
    return [{ key, direction: nextDirection }];
  }

  if (existingIndex === -1) {
    return [...current, { key, direction: defaultDirection }];
  }

  return current.map((rule, index) => {
    if (index !== existingIndex) {
      return rule;
    }
    return {
      ...rule,
      direction: rule.direction === 'asc' ? 'desc' : 'asc',
    };
  });
}
