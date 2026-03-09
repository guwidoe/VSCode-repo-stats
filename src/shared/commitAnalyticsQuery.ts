import type {
  CommitAnalytics,
  CommitAnalyticsQuery,
  CommitRecord,
  CommitSortField,
} from './contracts.js';

export function queryCommitAnalytics(
  analytics: CommitAnalytics,
  query: CommitAnalyticsQuery = {}
): CommitRecord[] {
  const sortField = query.sortBy ?? 'timestamp';
  const sortDirection = query.sortDirection ?? 'desc';
  const orderedIndexes = getOrderedIndexes(analytics, sortField, sortDirection);
  const authorFilter = query.authorIds ? new Set(query.authorIds) : null;
  const offset = Math.max(0, query.offset ?? 0);
  const limit = query.limit === undefined ? Number.POSITIVE_INFINITY : Math.max(0, query.limit);

  const result: CommitRecord[] = [];
  let matched = 0;

  const committedAfter = query.committedAfter ? Date.parse(query.committedAfter) : null;
  const committedBefore = query.committedBefore ? Date.parse(query.committedBefore) : null;
  const messageText = query.messageText?.trim().toLowerCase() ?? '';

  for (const index of orderedIndexes) {
    const record = analytics.records[index];
    if (!record) {
      continue;
    }
    if (authorFilter && !authorFilter.has(record.authorId)) {
      continue;
    }
    if (messageText && !record.summary.toLowerCase().includes(messageText)) {
      continue;
    }
    if (committedAfter !== null && record.timestamp * 1000 < committedAfter) {
      continue;
    }
    if (committedBefore !== null && record.timestamp * 1000 > committedBefore) {
      continue;
    }
    if (query.minAdditions !== undefined && record.additions < query.minAdditions) {
      continue;
    }
    if (query.maxAdditions !== undefined && record.additions > query.maxAdditions) {
      continue;
    }
    if (query.minDeletions !== undefined && record.deletions < query.minDeletions) {
      continue;
    }
    if (query.maxDeletions !== undefined && record.deletions > query.maxDeletions) {
      continue;
    }
    if (query.minChangedLines !== undefined && record.changedLines < query.minChangedLines) {
      continue;
    }
    if (query.maxChangedLines !== undefined && record.changedLines > query.maxChangedLines) {
      continue;
    }
    if (query.minFilesChanged !== undefined && record.filesChanged < query.minFilesChanged) {
      continue;
    }
    if (query.maxFilesChanged !== undefined && record.filesChanged > query.maxFilesChanged) {
      continue;
    }

    if (matched < offset) {
      matched += 1;
      continue;
    }

    result.push(record);
    if (result.length >= limit) {
      break;
    }
  }

  return result;
}

function getOrderedIndexes(
  analytics: CommitAnalytics,
  sortField: CommitSortField,
  sortDirection: 'asc' | 'desc'
): number[] {
  switch (sortField) {
    case 'additions': {
      const base = analytics.indexes.byAdditionsDesc;
      return sortDirection === 'desc' ? base : [...base].reverse();
    }
    case 'deletions': {
      const base = analytics.indexes.byDeletionsDesc;
      return sortDirection === 'desc' ? base : [...base].reverse();
    }
    case 'changedLines': {
      const base = analytics.indexes.byChangedLinesDesc;
      return sortDirection === 'desc' ? base : [...base].reverse();
    }
    case 'filesChanged': {
      const base = analytics.indexes.byFilesChangedDesc;
      return sortDirection === 'desc' ? base : [...base].reverse();
    }
    case 'timestamp':
    default: {
      const base = analytics.indexes.byTimestampAsc;
      return sortDirection === 'asc' ? base : [...base].reverse();
    }
  }
}
