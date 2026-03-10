import type { CommitAnalytics, CommitSortDirection } from '../../types';
import type {
  CommitColumnFilter,
  CommitColumnFilters,
  CommitColumnKey,
  CommitSortState,
  CommitTableRow,
  DateCommitColumnFilter,
  NumberCommitColumnFilter,
  TextCommitColumnFilter,
} from './types';

const collator = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true });

const DEFAULT_DIRECTION_BY_KEY: Record<CommitColumnKey, CommitSortDirection> = {
  committedAt: 'desc',
  authorName: 'asc',
  summary: 'asc',
  sha: 'asc',
  additions: 'desc',
  deletions: 'desc',
  changedLines: 'desc',
  filesChanged: 'desc',
};

export const DEFAULT_COMMIT_SORT: CommitSortState = {
  key: 'committedAt',
  direction: 'desc',
};

export function buildCommitTableRows(analytics: CommitAnalytics): CommitTableRow[] {
  return analytics.records.map((record) => ({
    ...record,
    authorName: analytics.authorDirectory.namesById[record.authorId] ?? 'Unknown',
    authorEmail: analytics.authorDirectory.emailsById[record.authorId] ?? '',
    authorNameLower: (analytics.authorDirectory.namesById[record.authorId] ?? 'Unknown').toLowerCase(),
    summaryLower: record.summary.toLowerCase(),
    shaLower: record.sha.toLowerCase(),
  }));
}

export function createDefaultCommitFilter(kind: CommitColumnFilter['kind']): CommitColumnFilter {
  switch (kind) {
    case 'number':
      return { kind: 'number', min: '', max: '' };
    case 'date':
      return { kind: 'date', from: '', to: '' };
    case 'text':
    default:
      return { kind: 'text', value: '' };
  }
}

export function isCommitColumnFilterActive(filter: CommitColumnFilter | undefined): boolean {
  if (!filter) {
    return false;
  }

  switch (filter.kind) {
    case 'text':
      return filter.value.trim().length > 0;
    case 'number':
      return filter.min.trim().length > 0 || filter.max.trim().length > 0;
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

function compareByKey(a: CommitTableRow, b: CommitTableRow, key: CommitColumnKey): number {
  switch (key) {
    case 'committedAt':
      return compareNumbers(a.timestamp, b.timestamp);
    case 'authorName':
      return compareStrings(a.authorNameLower, b.authorNameLower);
    case 'summary':
      return compareStrings(a.summaryLower, b.summaryLower);
    case 'sha':
      return compareStrings(a.shaLower, b.shaLower);
    case 'additions':
      return compareNumbers(a.additions, b.additions);
    case 'deletions':
      return compareNumbers(a.deletions, b.deletions);
    case 'changedLines':
      return compareNumbers(a.changedLines, b.changedLines);
    case 'filesChanged':
      return compareNumbers(a.filesChanged, b.filesChanged);
    default:
      return 0;
  }
}

function getStringValue(row: CommitTableRow, key: CommitColumnKey): string {
  switch (key) {
    case 'authorName':
      return row.authorNameLower;
    case 'summary':
      return row.summaryLower;
    case 'sha':
      return row.shaLower;
    default:
      return '';
  }
}

function getNumberValue(row: CommitTableRow, key: CommitColumnKey): number {
  switch (key) {
    case 'additions':
      return row.additions;
    case 'deletions':
      return row.deletions;
    case 'changedLines':
      return row.changedLines;
    case 'filesChanged':
      return row.filesChanged;
    default:
      return 0;
  }
}

function matchesTextFilter(row: CommitTableRow, key: CommitColumnKey, filter: TextCommitColumnFilter): boolean {
  const query = filter.value.trim().toLowerCase();
  if (!query) {
    return true;
  }

  return getStringValue(row, key).includes(query);
}

function matchesNumberFilter(row: CommitTableRow, key: CommitColumnKey, filter: NumberCommitColumnFilter): boolean {
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

function matchesDateFilter(row: CommitTableRow, filter: DateCommitColumnFilter): boolean {
  const fromEpoch = filter.from ? Date.parse(filter.from) : NaN;
  const toEpoch = filter.to ? Date.parse(filter.to) : NaN;
  const from = Number.isFinite(fromEpoch) ? fromEpoch : null;
  const to = Number.isFinite(toEpoch) ? toEpoch + (24 * 60 * 60 * 1000) - 1 : null;
  const timestamp = row.timestamp * 1000;

  if (from !== null && timestamp < from) {
    return false;
  }

  if (to !== null && timestamp > to) {
    return false;
  }

  return true;
}

function rowMatchesFilter(row: CommitTableRow, key: CommitColumnKey, filter: CommitColumnFilter): boolean {
  switch (filter.kind) {
    case 'text':
      return matchesTextFilter(row, key, filter);
    case 'number':
      return matchesNumberFilter(row, key, filter);
    case 'date':
      return key === 'committedAt' ? matchesDateFilter(row, filter) : true;
    default:
      return true;
  }
}

export function filterCommits(rows: CommitTableRow[], columnFilters: CommitColumnFilters): CommitTableRow[] {
  const activeFilters = Object.entries(columnFilters)
    .filter(([, filter]) => isCommitColumnFilterActive(filter as CommitColumnFilter)) as Array<[CommitColumnKey, CommitColumnFilter]>;

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

export function sortCommits(rows: CommitTableRow[], sortState: CommitSortState): CommitTableRow[] {
  return rows
    .map((row, originalIndex) => ({ row, originalIndex }))
    .sort((a, b) => {
      const result = compareByKey(a.row, b.row, sortState.key);
      if (result !== 0) {
        return sortState.direction === 'asc' ? result : -result;
      }
      return a.originalIndex - b.originalIndex;
    })
    .map((entry) => entry.row);
}

export function toggleCommitSort(current: CommitSortState, key: CommitColumnKey): CommitSortState {
  if (current.key !== key) {
    return { key, direction: DEFAULT_DIRECTION_BY_KEY[key] };
  }

  return {
    key,
    direction: current.direction === 'asc' ? 'desc' : 'asc',
  };
}
