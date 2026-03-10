import { useDeferredValue, useMemo, useState } from 'react';
import { useStore } from '../store';
import {
  buildCommitTableRows,
  DEFAULT_COMMIT_SORT,
  filterCommits,
  isCommitColumnFilterActive,
  sortCommits,
  toggleCommitSort,
} from '../components/commits/commitTableLogic';
import type { CommitColumnFilter, CommitColumnKey, CommitSortState } from '../components/commits/types';

export function formatCommitDate(isoDate: string): string {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) {
    return isoDate;
  }

  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  }).format(date);
}

export function formatCommitBucketLabel(minInclusive: number, maxInclusive: number): string {
  if (maxInclusive === Number.MAX_SAFE_INTEGER) {
    return `${minInclusive.toLocaleString()}+`;
  }
  if (minInclusive === maxInclusive) {
    return minInclusive.toLocaleString();
  }
  return `${minInclusive.toLocaleString()}-${maxInclusive.toLocaleString()}`;
}

export function useCommitPanelState() {
  const data = useStore((state) => state.data);

  const analytics = data?.commitAnalytics ?? null;
  const [sortState, setSortState] = useState<CommitSortState>(DEFAULT_COMMIT_SORT);
  const [columnFilters, setColumnFilters] = useState<Partial<Record<CommitColumnKey, CommitColumnFilter>>>({});
  const [activeFilterColumn, setActiveFilterColumn] = useState<CommitColumnKey | null>(null);

  const tableRows = useMemo(
    () => (analytics ? buildCommitTableRows(analytics) : []),
    [analytics]
  );
  const deferredFilters = useDeferredValue(columnFilters);
  const filteredRows = useMemo(
    () => filterCommits(tableRows, deferredFilters),
    [tableRows, deferredFilters]
  );
  const rows = useMemo(
    () => sortCommits(filteredRows, sortState),
    [filteredRows, sortState]
  );
  const largestCommit = useMemo(
    () => analytics
      ? [...tableRows].sort((a, b) => b.changedLines - a.changedLines || b.timestamp - a.timestamp)[0] ?? null
      : null,
    [analytics, tableRows]
  );
  const largestCommits = useMemo(
    () => analytics
      ? [...tableRows]
        .sort((a, b) => b.changedLines - a.changedLines || b.timestamp - a.timestamp)
        .slice(0, 5)
      : [],
    [analytics, tableRows]
  );
  const contributorPatterns = useMemo(
    () => analytics
      ? [...analytics.contributorSummaries]
        .sort((a, b) => b.averageChangedLines - a.averageChangedLines || b.totalCommits - a.totalCommits)
        .slice(0, 8)
      : [],
    [analytics]
  );
  const maxChangedLineBucketCount = useMemo(
    () => analytics ? Math.max(1, ...analytics.changedLineBuckets.map((bucket) => bucket.count)) : 1,
    [analytics]
  );
  const maxFileBucketCount = useMemo(
    () => analytics ? Math.max(1, ...analytics.fileChangeBuckets.map((bucket) => bucket.count)) : 1,
    [analytics]
  );
  const maxContributorPatternAverage = useMemo(
    () => Math.max(1, ...contributorPatterns.map((pattern) => pattern.averageChangedLines)),
    [contributorPatterns]
  );
  const maxLargestCommitChangedLines = useMemo(
    () => Math.max(1, ...largestCommits.map((record) => record.changedLines)),
    [largestCommits]
  );
  const activeFilterCount = useMemo(
    () => Object.values(columnFilters).filter((filter) => isCommitColumnFilterActive(filter)).length,
    [columnFilters]
  );

  const setFilter = (key: CommitColumnKey, filter: CommitColumnFilter) => {
    setColumnFilters((prev) => ({ ...prev, [key]: filter }));
  };

  const clearFilter = (key: CommitColumnKey) => {
    setColumnFilters((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const clearAllFilters = () => {
    setColumnFilters({});
    setActiveFilterColumn(null);
  };

  const resetSort = () => {
    setSortState(DEFAULT_COMMIT_SORT);
  };

  return {
    data,
    rows,
    totalRows: tableRows.length,
    activeFilterCount,
    summary: analytics?.summary ?? null,
    largestCommit,
    largestCommits,
    contributorPatterns,
    maxChangedLineBucketCount,
    maxFileBucketCount,
    maxContributorPatternAverage,
    maxLargestCommitChangedLines,
    table: {
      sortState,
      setSortState,
      toggleSort: (key: CommitColumnKey) => setSortState((current) => toggleCommitSort(current, key)),
      resetSort,
      columnFilters,
      activeFilterColumn,
      setActiveFilterColumn,
      setFilter,
      clearFilter,
      clearAllFilters,
    },
  };
}
