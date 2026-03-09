import { useDeferredValue, useMemo, useState } from 'react';
import { queryCommitAnalytics } from '../../../src/shared/commitAnalyticsQuery';
import { useStore } from '../store';
import type { CommitAnalyticsQuery, CommitSortDirection, CommitSortField } from '../types';

function parseOptionalNumber(value: string): number | undefined {
  if (!value.trim()) {
    return undefined;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

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

  const [messageText, setMessageText] = useState('');
  const [authorId, setAuthorId] = useState<string>('all');
  const [committedAfter, setCommittedAfter] = useState('');
  const [committedBefore, setCommittedBefore] = useState('');
  const [minChangedLines, setMinChangedLines] = useState('');
  const [maxChangedLines, setMaxChangedLines] = useState('');
  const [minFilesChanged, setMinFilesChanged] = useState('');
  const [maxFilesChanged, setMaxFilesChanged] = useState('');
  const [sortBy, setSortBy] = useState<CommitSortField>('timestamp');
  const [sortDirection, setSortDirection] = useState<CommitSortDirection>('desc');

  const query = useMemo<CommitAnalyticsQuery>(() => ({
    messageText: messageText.trim() || undefined,
    authorIds: authorId === 'all' ? undefined : [Number(authorId)],
    committedAfter: committedAfter || undefined,
    committedBefore: committedBefore || undefined,
    minChangedLines: parseOptionalNumber(minChangedLines),
    maxChangedLines: parseOptionalNumber(maxChangedLines),
    minFilesChanged: parseOptionalNumber(minFilesChanged),
    maxFilesChanged: parseOptionalNumber(maxFilesChanged),
    sortBy,
    sortDirection,
  }), [
    messageText,
    authorId,
    committedAfter,
    committedBefore,
    minChangedLines,
    maxChangedLines,
    minFilesChanged,
    maxFilesChanged,
    sortBy,
    sortDirection,
  ]);

  const deferredQuery = useDeferredValue(query);
  const analytics = data?.commitAnalytics ?? null;
  const rows = useMemo(
    () => (analytics ? queryCommitAnalytics(analytics, deferredQuery) : []),
    [analytics, deferredQuery]
  );
  const largestCommit = useMemo(
    () => analytics
      ? queryCommitAnalytics(analytics, { sortBy: 'changedLines', sortDirection: 'desc', limit: 1 })[0] ?? null
      : null,
    [analytics]
  );
  const largestCommits = useMemo(
    () => analytics
      ? queryCommitAnalytics(analytics, { sortBy: 'changedLines', sortDirection: 'desc', limit: 5 })
      : [],
    [analytics]
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

  return {
    data,
    rows,
    authorOptions: analytics?.contributorSummaries ?? [],
    summary: analytics?.summary ?? null,
    largestCommit,
    largestCommits,
    contributorPatterns,
    maxChangedLineBucketCount,
    maxFileBucketCount,
    filters: {
      messageText,
      setMessageText,
      authorId,
      setAuthorId,
      committedAfter,
      setCommittedAfter,
      committedBefore,
      setCommittedBefore,
      minChangedLines,
      setMinChangedLines,
      maxChangedLines,
      setMaxChangedLines,
      minFilesChanged,
      setMinFilesChanged,
      maxFilesChanged,
      setMaxFilesChanged,
      sortBy,
      setSortBy,
      sortDirection,
      setSortDirection,
    },
  };
}
