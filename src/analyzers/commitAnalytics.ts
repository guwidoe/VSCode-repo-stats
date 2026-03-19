import {
  CodeFrequency,
  CommitAnalytics,
  CommitContributorSummary,
  CommitMetricSummary,
  CommitRecord,
  CommitSortField,
  CommitStatBucket,
  ContributorStats,
  WeeklyCommit,
} from '../types/index.js';
import { createPathPatternMatcher } from './pathMatching.js';

interface ParsedCommitHistoryEntry {
  sha: string;
  name: string;
  email: string;
  date: string;
  timestamp: number;
  summary: string;
  additions: number;
  deletions: number;
  filesChanged: number;
  hasIncludedChanges: boolean;
  sawAnyFileStats: boolean;
}

const UNKNOWN_AUTHOR = 'Unknown';
const UNKNOWN_EMAIL = 'unknown@unknown.local';
const CHANGED_LINE_BUCKET_UPPER_BOUNDS = [0, 10, 50, 100, 250, 500, 1000, 5000, 10000];
const FILE_CHANGE_BUCKET_UPPER_BOUNDS = [0, 1, 2, 5, 10, 25, 50, 100, 500];

export function parseCommitHistoryLog(
  rawLog: string,
  excludePatterns: string[] = []
): ParsedCommitHistoryEntry[] {
  const shouldExcludePath = createPathPatternMatcher(excludePatterns);
  const commits: ParsedCommitHistoryEntry[] = [];
  let current: ParsedCommitHistoryEntry | null = null;

  const pushCurrent = () => {
    if (!current) {
      return;
    }

    if (current.hasIncludedChanges || !current.sawAnyFileStats) {
      commits.push(current);
    }
  };

  for (const line of rawLog.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }

    if (trimmed.startsWith('__COMMIT__|')) {
      pushCurrent();
      current = createParsedCommit(trimmed);
      continue;
    }

    if (!current) {
      continue;
    }

    const fileStat = parseNumstatLine(line);
    if (!fileStat) {
      continue;
    }

    current.sawAnyFileStats = true;
    if (shouldExcludePath(fileStat.filePath)) {
      continue;
    }

    current.hasIncludedChanges = true;
    current.additions += fileStat.additions;
    current.deletions += fileStat.deletions;
    current.filesChanged += 1;
  }

  pushCurrent();
  return commits;
}

export function buildCommitAnalytics(
  commits: ParsedCommitHistoryEntry[],
  repositoryId = 'default'
): CommitAnalytics {
  const authorIdByEmail = new Map<string, number>();
  const namesById: string[] = [];
  const emailsById: string[] = [];
  const records: CommitRecord[] = [];

  for (const commit of commits) {
    const normalizedEmail = normalizeEmail(commit.email);
    let authorId = authorIdByEmail.get(normalizedEmail);
    if (authorId === undefined) {
      authorId = namesById.length;
      authorIdByEmail.set(normalizedEmail, authorId);
      namesById.push(commit.name || UNKNOWN_AUTHOR);
      emailsById.push(commit.email || UNKNOWN_EMAIL);
    }

    records.push({
      sha: commit.sha,
      repositoryId,
      authorId,
      committedAt: commit.date,
      timestamp: commit.timestamp,
      summary: commit.summary,
      additions: commit.additions,
      deletions: commit.deletions,
      changedLines: commit.additions + commit.deletions,
      filesChanged: commit.filesChanged,
    });
  }

  const summary = buildSummary(records);
  const contributorSummaries = buildContributorSummaries(records, namesById, emailsById);

  return {
    authorDirectory: {
      idByEmail: Object.fromEntries(authorIdByEmail.entries()),
      namesById,
      emailsById,
    },
    records,
    summary,
    contributorSummaries,
    changedLineBuckets: buildBuckets(records.map((record) => record.changedLines), CHANGED_LINE_BUCKET_UPPER_BOUNDS),
    fileChangeBuckets: buildBuckets(records.map((record) => record.filesChanged), FILE_CHANGE_BUCKET_UPPER_BOUNDS),
    indexes: {
      byTimestampAsc: sortRecordIndexes(records, 'timestamp', 'asc'),
      byAdditionsDesc: sortRecordIndexes(records, 'additions', 'desc'),
      byDeletionsDesc: sortRecordIndexes(records, 'deletions', 'desc'),
      byChangedLinesDesc: sortRecordIndexes(records, 'changedLines', 'desc'),
      byFilesChangedDesc: sortRecordIndexes(records, 'filesChanged', 'desc'),
    },
  };
}

export function buildContributorStatsFromCommitAnalytics(
  analytics: CommitAnalytics
): ContributorStats[] {
  const contributorMap = new Map<number, ContributorStats & { weeklyMap: Map<string, WeeklyCommit> }>();

  for (const record of analytics.records) {
    let contributor = contributorMap.get(record.authorId);
    if (!contributor) {
      contributor = {
        name: analytics.authorDirectory.namesById[record.authorId] ?? UNKNOWN_AUTHOR,
        email: analytics.authorDirectory.emailsById[record.authorId] ?? UNKNOWN_EMAIL,
        commits: 0,
        linesAdded: 0,
        linesDeleted: 0,
        firstCommit: record.committedAt,
        lastCommit: record.committedAt,
        weeklyActivity: [],
        weeklyMap: new Map<string, WeeklyCommit>(),
      };
      contributorMap.set(record.authorId, contributor);
    }

    contributor.commits += 1;
    contributor.linesAdded += record.additions;
    contributor.linesDeleted += record.deletions;

    if (record.committedAt < contributor.firstCommit) {
      contributor.firstCommit = record.committedAt;
    }
    if (record.committedAt > contributor.lastCommit) {
      contributor.lastCommit = record.committedAt;
    }

    const week = getISOWeek(new Date(record.committedAt));
    let weeklyEntry = contributor.weeklyMap.get(week);
    if (!weeklyEntry) {
      weeklyEntry = { week, commits: 0, additions: 0, deletions: 0 };
      contributor.weeklyMap.set(week, weeklyEntry);
    }

    weeklyEntry.commits += 1;
    weeklyEntry.additions += record.additions;
    weeklyEntry.deletions += record.deletions;
  }

  const contributors = Array.from(contributorMap.values()).map((contributor) => ({
    name: contributor.name,
    email: contributor.email,
    commits: contributor.commits,
    linesAdded: contributor.linesAdded,
    linesDeleted: contributor.linesDeleted,
    firstCommit: contributor.firstCommit,
    lastCommit: contributor.lastCommit,
    weeklyActivity: Array.from(contributor.weeklyMap.values()).sort((a, b) => a.week.localeCompare(b.week)),
  }));

  contributors.sort((a, b) => b.commits - a.commits || a.email.localeCompare(b.email));
  return contributors;
}

export function mergeCommitAnalytics(analyticsList: CommitAnalytics[]): CommitAnalytics {
  const authorIdByEmail = new Map<string, number>();
  const namesById: string[] = [];
  const emailsById: string[] = [];
  const records: CommitRecord[] = [];

  for (const analytics of analyticsList) {
    for (const record of analytics.records) {
      const email = analytics.authorDirectory.emailsById[record.authorId] ?? UNKNOWN_EMAIL;
      const name = analytics.authorDirectory.namesById[record.authorId] ?? UNKNOWN_AUTHOR;
      const normalizedEmail = normalizeEmail(email);
      let mergedAuthorId = authorIdByEmail.get(normalizedEmail);
      if (mergedAuthorId === undefined) {
        mergedAuthorId = namesById.length;
        authorIdByEmail.set(normalizedEmail, mergedAuthorId);
        namesById.push(name);
        emailsById.push(email);
      }

      records.push({
        ...record,
        authorId: mergedAuthorId,
      });
    }
  }

  const summary = buildSummary(records);
  const contributorSummaries = buildContributorSummaries(records, namesById, emailsById);

  return {
    authorDirectory: {
      idByEmail: Object.fromEntries(authorIdByEmail.entries()),
      namesById,
      emailsById,
    },
    records,
    summary,
    contributorSummaries,
    changedLineBuckets: buildBuckets(records.map((record) => record.changedLines), CHANGED_LINE_BUCKET_UPPER_BOUNDS),
    fileChangeBuckets: buildBuckets(records.map((record) => record.filesChanged), FILE_CHANGE_BUCKET_UPPER_BOUNDS),
    indexes: {
      byTimestampAsc: sortRecordIndexes(records, 'timestamp', 'asc'),
      byAdditionsDesc: sortRecordIndexes(records, 'additions', 'desc'),
      byDeletionsDesc: sortRecordIndexes(records, 'deletions', 'desc'),
      byChangedLinesDesc: sortRecordIndexes(records, 'changedLines', 'desc'),
      byFilesChangedDesc: sortRecordIndexes(records, 'filesChanged', 'desc'),
    },
  };
}

export function buildCodeFrequencyFromCommitAnalytics(
  analytics: CommitAnalytics
): CodeFrequency[] {
  const weeklyMap = new Map<string, CodeFrequency>();

  for (const record of analytics.records) {
    const week = getISOWeek(new Date(record.committedAt));
    let entry = weeklyMap.get(week);
    if (!entry) {
      entry = {
        week,
        additions: 0,
        deletions: 0,
        netChange: 0,
      };
      weeklyMap.set(week, entry);
    }

    entry.additions += record.additions;
    entry.deletions += record.deletions;
    entry.netChange = entry.additions - entry.deletions;
  }

  return Array.from(weeklyMap.values()).sort((a, b) => a.week.localeCompare(b.week));
}

function createParsedCommit(line: string): ParsedCommitHistoryEntry {
  const parts = line.split('|');
  const sha = parts[1] ?? '';
  const name = parts[2] ?? UNKNOWN_AUTHOR;
  const email = parts[3] ?? UNKNOWN_EMAIL;
  const date = parts[4] ?? '';
  const summary = parts.slice(5).join('|');
  const timestamp = Date.parse(date);

  return {
    sha,
    name: name || UNKNOWN_AUTHOR,
    email: email || UNKNOWN_EMAIL,
    date,
    timestamp: Number.isFinite(timestamp) ? Math.floor(timestamp / 1000) : 0,
    summary,
    additions: 0,
    deletions: 0,
    filesChanged: 0,
    hasIncludedChanges: false,
    sawAnyFileStats: false,
  };
}

function parseNumstatLine(
  line: string
): { additions: number; deletions: number; filePath: string } | null {
  const parts = line.split('\t');
  if (parts.length < 3) {
    return null;
  }

  const filePath = parts[parts.length - 1].trim();
  if (!filePath) {
    return null;
  }

  const additions = parts[0] === '-' ? 0 : parseInt(parts[0], 10);
  const deletions = parts[1] === '-' ? 0 : parseInt(parts[1], 10);

  if (!Number.isFinite(additions) || !Number.isFinite(deletions)) {
    return null;
  }

  return { additions, deletions, filePath };
}

function buildSummary(records: CommitRecord[]): CommitMetricSummary {
  const totalCommits = records.length;
  const totalAdditions = records.reduce((sum, record) => sum + record.additions, 0);
  const totalDeletions = records.reduce((sum, record) => sum + record.deletions, 0);
  const totalChangedLines = records.reduce((sum, record) => sum + record.changedLines, 0);
  const totalFilesChanged = records.reduce((sum, record) => sum + record.filesChanged, 0);
  const medianChangedLines = computeMedian(records.map((record) => record.changedLines));

  return {
    totalCommits,
    totalAdditions,
    totalDeletions,
    totalChangedLines,
    averageChangedLines: totalCommits > 0 ? totalChangedLines / totalCommits : 0,
    medianChangedLines,
    averageFilesChanged: totalCommits > 0 ? totalFilesChanged / totalCommits : 0,
  };
}

function buildContributorSummaries(
  records: CommitRecord[],
  namesById: string[],
  emailsById: string[]
): CommitContributorSummary[] {
  const grouped = new Map<number, CommitRecord[]>();

  for (const record of records) {
    const current = grouped.get(record.authorId) ?? [];
    current.push(record);
    grouped.set(record.authorId, current);
  }

  const summaries = Array.from(grouped.entries()).map(([authorId, authorRecords]) => {
    const summary = buildSummary(authorRecords);
    return {
      authorId,
      authorName: namesById[authorId] ?? UNKNOWN_AUTHOR,
      authorEmail: emailsById[authorId] ?? UNKNOWN_EMAIL,
      ...summary,
    };
  });

  summaries.sort((a, b) => b.totalCommits - a.totalCommits || a.authorEmail.localeCompare(b.authorEmail));
  return summaries;
}

function buildBuckets(values: number[], upperBounds: number[]): CommitStatBucket[] {
  const buckets = upperBounds.map((maxInclusive, index) => ({
    minInclusive: index === 0 ? 0 : upperBounds[index - 1] + 1,
    maxInclusive,
    count: 0,
  }));
  buckets.push({
    minInclusive: upperBounds[upperBounds.length - 1] + 1,
    maxInclusive: Number.MAX_SAFE_INTEGER,
    count: 0,
  });

  for (const value of values) {
    const bucket = buckets.find((candidate) => value >= candidate.minInclusive && value <= candidate.maxInclusive);
    if (bucket) {
      bucket.count += 1;
    }
  }

  return buckets;
}

function sortRecordIndexes(
  records: CommitRecord[],
  field: CommitSortField,
  direction: 'asc' | 'desc'
): number[] {
  return records
    .map((_, index) => index)
    .sort((a, b) => {
      const diff = records[a][field] - records[b][field];
      if (diff !== 0) {
        return direction === 'asc' ? diff : -diff;
      }
      return direction === 'asc'
        ? records[a].timestamp - records[b].timestamp
        : records[b].timestamp - records[a].timestamp;
    });
}

function computeMedian(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 0) {
    return (sorted[middle - 1] + sorted[middle]) / 2;
  }

  return sorted[middle];
}

function normalizeEmail(email: string): string {
  return (email || UNKNOWN_EMAIL).trim().toLowerCase();
}

function getISOWeek(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNum = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${weekNum.toString().padStart(2, '0')}`;
}
