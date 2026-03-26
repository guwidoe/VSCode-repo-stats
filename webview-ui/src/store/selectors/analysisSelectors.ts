import type { AnalysisResult, TimePeriod } from '../../types';
import type { RepoStatsState } from '../types';
import { isValidISOWeek, parseISOWeek, weekToMonthKey } from '../../utils/timeSeries';

let cachedAllWeeksData: AnalysisResult | null = null;
let cachedAllWeeks: string[] = [];
let cachedWeeklyTotalsData: AnalysisResult | null = null;
let cachedWeeklyTotals: { week: string; commits: number }[] = [];

function getCutoffDate(period: TimePeriod): Date | null {
  const now = new Date();

  switch (period) {
    case 'month':
      return new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
    case '3months':
      return new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
    case '6months':
      return new Date(now.getFullYear(), now.getMonth() - 6, now.getDate());
    case 'year':
      return new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
    case 'all':
    default:
      return null;
  }
}

function aggregateToMonthly(
  weekly: { week: string; additions: number; deletions: number; netChange: number }[]
) {
  const monthlyMap = new Map<string, { additions: number; deletions: number; netChange: number }>();

  for (const week of weekly) {
    const monthKey = weekToMonthKey(week.week);
    if (!monthKey) {
      continue;
    }

    if (!monthlyMap.has(monthKey)) {
      monthlyMap.set(monthKey, { additions: 0, deletions: 0, netChange: 0 });
    }

    const entry = monthlyMap.get(monthKey)!;
    entry.additions += week.additions;
    entry.deletions += week.deletions;
    entry.netChange += week.netChange;
  }

  return Array.from(monthlyMap.entries())
    .map(([month, data]) => ({
      week: month,
      ...data,
    }))
    .sort((a, b) => a.week.localeCompare(b.week));
}

export const selectAllWeeks = (state: RepoStatsState): string[] => {
  if (!state.data) {
    return [];
  }

  if (state.data === cachedAllWeeksData && cachedAllWeeks.length > 0) {
    return cachedAllWeeks;
  }

  const allWeeks = new Set<string>();
  for (const contributor of state.data.contributors) {
    for (const week of contributor.weeklyActivity) {
      if (isValidISOWeek(week.week)) {
        allWeeks.add(week.week);
      }
    }
  }

  cachedAllWeeksData = state.data;
  cachedAllWeeks = Array.from(allWeeks).sort();
  return cachedAllWeeks;
};

export const selectWeeklyCommitTotals = (
  state: RepoStatsState
): { week: string; commits: number }[] => {
  if (!state.data) {
    return [];
  }

  if (state.data === cachedWeeklyTotalsData && cachedWeeklyTotals.length > 0) {
    return cachedWeeklyTotals;
  }

  const weekMap = new Map<string, number>();
  for (const contributor of state.data.contributors) {
    for (const week of contributor.weeklyActivity) {
      if (isValidISOWeek(week.week)) {
        weekMap.set(week.week, (weekMap.get(week.week) ?? 0) + week.commits);
      }
    }
  }

  cachedWeeklyTotals = Array.from(weekMap.entries())
    .map(([week, commits]) => ({ week, commits }))
    .sort((a, b) => a.week.localeCompare(b.week));
  cachedWeeklyTotalsData = state.data;

  return cachedWeeklyTotals;
};

export const selectFilteredContributors = (state: RepoStatsState) => {
  if (!state.data) {
    return [];
  }

  const contributors = state.data.contributors;
  const allWeeks = selectAllWeeks(state);
  const startIdx = state.timeRangeStart ?? 0;
  const endIdx = state.timeRangeEnd ?? allWeeks.length - 1;
  const selectedWeeks = new Set(allWeeks.slice(startIdx, endIdx + 1));

  return contributors.map((contributor) => {
    const filteredActivity = contributor.weeklyActivity.filter((week) =>
      selectedWeeks.has(week.week)
    );

    const filteredCommits = filteredActivity.reduce((sum, week) => sum + week.commits, 0);
    const filteredAdded = filteredActivity.reduce((sum, week) => sum + week.additions, 0);
    const filteredDeleted = filteredActivity.reduce((sum, week) => sum + week.deletions, 0);

    return {
      ...contributor,
      commits: filteredCommits,
      linesAdded: filteredAdded,
      linesDeleted: filteredDeleted,
      weeklyActivity: filteredActivity,
    };
  }).filter((contributor) => contributor.commits > 0).sort((a, b) => b.commits - a.commits);
};

export const selectTimeRangeWeeks = (state: RepoStatsState): string[] => {
  if (!state.data) {
    return [];
  }

  const allWeeks = selectAllWeeks(state);
  const startIdx = state.timeRangeStart ?? 0;
  const endIdx = state.timeRangeEnd ?? allWeeks.length - 1;

  return allWeeks.slice(startIdx, endIdx + 1);
};

export const selectFilteredCodeFrequency = (state: RepoStatsState) => {
  if (!state.data) {
    return [];
  }

  const frequency = state.data.codeFrequency.filter((entry) => parseISOWeek(entry.week) !== null);
  const cutoffDate = getCutoffDate(state.timePeriod);

  let filtered = frequency;
  if (cutoffDate) {
    filtered = frequency.filter((entry) => {
      const weekDate = parseISOWeek(entry.week);
      return weekDate !== null && weekDate >= cutoffDate;
    });
  }

  if (state.frequencyGranularity === 'monthly') {
    return aggregateToMonthly(filtered);
  }

  return filtered;
};
