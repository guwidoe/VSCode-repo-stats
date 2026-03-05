import type {
  ColumnFilter,
  ColumnFilters,
  DateColumnFilter,
  FileRow,
  FileSortKey,
  NumberColumnFilter,
  SortDirection,
  SortRule,
  TextColumnFilter,
} from './types';

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
  blamedLines: 'desc',
  lineAgeAvgDays: 'desc',
  lineAgeMinDays: 'desc',
  lineAgeMaxDays: 'desc',
  topOwnerAuthor: 'asc',
  topOwnerLines: 'desc',
  topOwnerShare: 'desc',
  lastModified: 'desc',
};

export const DEFAULT_SORT_RULES: SortRule[] = [
  { key: 'lines', direction: 'desc' },
];

export function createDefaultFilter(kind: ColumnFilter['kind']): ColumnFilter {
  switch (kind) {
    case 'text':
      return { kind: 'text', value: '' };
    case 'number':
      return { kind: 'number', min: '', max: '' };
    case 'boolean':
      return { kind: 'boolean', mode: 'all' };
    case 'date':
      return { kind: 'date', from: '', to: '' };
    default:
      return { kind: 'text', value: '' };
  }
}

export function isColumnFilterActive(filter: ColumnFilter | undefined): boolean {
  if (!filter) {
    return false;
  }

  switch (filter.kind) {
    case 'text':
      return filter.value.trim().length > 0;
    case 'number':
      return filter.min.trim().length > 0 || filter.max.trim().length > 0;
    case 'boolean':
      return filter.mode !== 'all';
    case 'date':
      return filter.from.length > 0 || filter.to.length > 0;
    default:
      return false;
  }
}

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
    case 'blamedLines':
      return compareNumbers(a.blamedLines, b.blamedLines);
    case 'lineAgeAvgDays':
      return compareNumbers(a.lineAgeAvgDays, b.lineAgeAvgDays);
    case 'lineAgeMinDays':
      return compareNumbers(a.lineAgeMinDays, b.lineAgeMinDays);
    case 'lineAgeMaxDays':
      return compareNumbers(a.lineAgeMaxDays, b.lineAgeMaxDays);
    case 'topOwnerAuthor':
      return compareStrings(a.topOwnerAuthorLower, b.topOwnerAuthorLower);
    case 'topOwnerLines':
      return compareNumbers(a.topOwnerLines, b.topOwnerLines);
    case 'topOwnerShare':
      return compareNumbers(a.topOwnerShare, b.topOwnerShare);
    case 'lastModified':
      return compareNumbers(a.lastModifiedEpoch, b.lastModifiedEpoch);
    default:
      return 0;
  }
}

function getStringValue(row: FileRow, key: FileSortKey): string {
  switch (key) {
    case 'path':
      return row.pathLower;
    case 'name':
      return row.nameLower;
    case 'ext':
      return row.ext.toLowerCase();
    case 'language':
      return row.language.toLowerCase();
    case 'topOwnerAuthor':
      return row.topOwnerAuthorLower;
    default:
      return '';
  }
}

function getNumberValue(row: FileRow, key: FileSortKey): number {
  switch (key) {
    case 'lines':
      return row.lines;
    case 'bytes':
      return row.bytes;
    case 'complexity':
      return row.complexity;
    case 'commentLines':
      return row.commentLines;
    case 'blankLines':
      return row.blankLines;
    case 'blamedLines':
      return row.blamedLines;
    case 'lineAgeAvgDays':
      return row.lineAgeAvgDays;
    case 'lineAgeMinDays':
      return row.lineAgeMinDays;
    case 'lineAgeMaxDays':
      return row.lineAgeMaxDays;
    case 'topOwnerLines':
      return row.topOwnerLines;
    case 'topOwnerShare':
      return row.topOwnerShare * 100;
    default:
      return 0;
  }
}

function getBooleanValue(row: FileRow, key: FileSortKey): boolean {
  switch (key) {
    case 'generated':
      return row.generated;
    case 'binary':
      return row.binary;
    case 'isCode':
      return row.isCode;
    default:
      return false;
  }
}

function matchesTextFilter(row: FileRow, key: FileSortKey, filter: TextColumnFilter): boolean {
  const query = filter.value.trim().toLowerCase();
  if (!query) {
    return true;
  }

  return getStringValue(row, key).includes(query);
}

function matchesNumberFilter(row: FileRow, key: FileSortKey, filter: NumberColumnFilter): boolean {
  const min = filter.min.trim().length > 0 ? Number(filter.min) : null;
  const max = filter.max.trim().length > 0 ? Number(filter.max) : null;
  const value = getNumberValue(row, key);

  if (min !== null && Number.isFinite(min) && value < min) {
    return false;
  }

  if (max !== null && Number.isFinite(max) && value > max) {
    return false;
  }

  return true;
}

function matchesBooleanFilter(row: FileRow, key: FileSortKey, mode: 'all' | 'true' | 'false'): boolean {
  if (mode === 'all') {
    return true;
  }

  const value = getBooleanValue(row, key);
  return mode === 'true' ? value : !value;
}

function matchesDateFilter(row: FileRow, filter: DateColumnFilter): boolean {
  const fromEpoch = filter.from ? Date.parse(filter.from) : NaN;
  const toEpoch = filter.to ? Date.parse(filter.to) : NaN;
  const from = Number.isFinite(fromEpoch) ? fromEpoch : null;
  const to = Number.isFinite(toEpoch) ? toEpoch + (24 * 60 * 60 * 1000) - 1 : null;

  if (from !== null && row.lastModifiedEpoch < from) {
    return false;
  }

  if (to !== null && row.lastModifiedEpoch > to) {
    return false;
  }

  return true;
}

function rowMatchesFilter(row: FileRow, key: FileSortKey, filter: ColumnFilter): boolean {
  switch (filter.kind) {
    case 'text':
      return matchesTextFilter(row, key, filter);
    case 'number':
      return matchesNumberFilter(row, key, filter);
    case 'boolean':
      return matchesBooleanFilter(row, key, filter.mode);
    case 'date':
      if (key !== 'lastModified') {
        return true;
      }
      return matchesDateFilter(row, filter);
    default:
      return true;
  }
}

export function filterFiles(rows: FileRow[], columnFilters: ColumnFilters): FileRow[] {
  const activeFilters = Object.entries(columnFilters)
    .filter(([, filter]) => isColumnFilterActive(filter as ColumnFilter)) as Array<[FileSortKey, ColumnFilter]>;

  if (activeFilters.length === 0) {
    return rows;
  }

  return rows.filter((row) => {
    for (const [key, filter] of activeFilters) {
      if (!rowMatchesFilter(row, key, filter)) {
        return false;
      }
    }
    return true;
  });
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
