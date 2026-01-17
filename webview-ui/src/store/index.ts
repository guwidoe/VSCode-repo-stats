/**
 * Zustand store for the Repo Stats webview.
 */

import { create } from 'zustand';
import type {
  AnalysisResult,
  ViewType,
  TimePeriod,
  FrequencyGranularity,
  ColorMode,
  LoadingState,
  TreemapNode,
} from '../types';

// ============================================================================
// Store State Interface
// ============================================================================

interface RepoStatsState {
  // Data
  data: AnalysisResult | null;
  error: string | null;

  // Loading state
  loading: LoadingState;

  // UI State
  activeView: ViewType;
  timePeriod: TimePeriod;
  frequencyGranularity: FrequencyGranularity;
  contributorGranularity: FrequencyGranularity;
  colorMode: ColorMode;

  // Time range slider (indices into allWeeks array, null means full range)
  timeRangeStart: number | null;
  timeRangeEnd: number | null;

  // Treemap navigation
  treemapPath: string[];
  currentTreemapNode: TreemapNode | null;

  // Actions
  setData: (data: AnalysisResult) => void;
  setError: (error: string | null) => void;
  setLoading: (loading: Partial<LoadingState>) => void;
  setActiveView: (view: ViewType) => void;
  setTimePeriod: (period: TimePeriod) => void;
  setFrequencyGranularity: (granularity: FrequencyGranularity) => void;
  setContributorGranularity: (granularity: FrequencyGranularity) => void;
  setColorMode: (mode: ColorMode) => void;
  setTimeRange: (start: number | null, end: number | null) => void;
  navigateToTreemapPath: (path: string[]) => void;
  reset: () => void;
}

// ============================================================================
// Initial State
// ============================================================================

const initialState = {
  data: null,
  error: null,
  loading: {
    isLoading: false,
    phase: '',
    progress: 0,
  },
  activeView: 'contributors' as ViewType,
  timePeriod: 'all' as TimePeriod,
  frequencyGranularity: 'weekly' as FrequencyGranularity,
  contributorGranularity: 'weekly' as FrequencyGranularity,
  colorMode: 'language' as ColorMode,
  timeRangeStart: null as number | null,
  timeRangeEnd: null as number | null,
  treemapPath: [] as string[],
  currentTreemapNode: null,
};

// ============================================================================
// Store
// ============================================================================

export const useStore = create<RepoStatsState>((set, get) => ({
  ...initialState,

  setData: (data: AnalysisResult) => {
    set({
      data,
      error: null,
      loading: { isLoading: false, phase: '', progress: 100 },
      currentTreemapNode: data.fileTree,
      treemapPath: [],
    });
  },

  setError: (error: string | null) => {
    set({
      error,
      loading: { isLoading: false, phase: '', progress: 0 },
    });
  },

  setLoading: (loading: Partial<LoadingState>) => {
    set((state) => ({
      loading: { ...state.loading, ...loading },
    }));
  },

  setActiveView: (view: ViewType) => {
    set({ activeView: view });
  },

  setTimePeriod: (period: TimePeriod) => {
    set({ timePeriod: period });
  },

  setFrequencyGranularity: (granularity: FrequencyGranularity) => {
    set({ frequencyGranularity: granularity });
  },

  setContributorGranularity: (granularity: FrequencyGranularity) => {
    set({ contributorGranularity: granularity });
  },

  setColorMode: (mode: ColorMode) => {
    set({ colorMode: mode });
  },

  setTimeRange: (start: number | null, end: number | null) => {
    set({ timeRangeStart: start, timeRangeEnd: end });
  },

  navigateToTreemapPath: (path: string[]) => {
    const { data } = get();
    if (!data) {return;}

    // Navigate to the node at the given path
    let node: TreemapNode | null = data.fileTree;

    for (const segment of path) {
      if (!node || !node.children) {
        node = null;
        break;
      }
      node = node.children.find((child) => child.name === segment) || null;
    }

    set({
      treemapPath: path,
      currentTreemapNode: node || data.fileTree,
    });
  },

  reset: () => {
    set(initialState);
  },
}));

// ============================================================================
// Selectors
// ============================================================================

/**
 * Returns ALL weeks from the data (for the slider background).
 */
export const selectAllWeeks = (state: RepoStatsState): string[] => {
  if (!state.data) {return [];}

  const allWeeks = new Set<string>();
  for (const contributor of state.data.contributors) {
    for (const week of contributor.weeklyActivity) {
      allWeeks.add(week.week);
    }
  }

  return Array.from(allWeeks).sort();
};

/**
 * Returns aggregated commit counts per week (for slider background chart).
 */
export const selectWeeklyCommitTotals = (state: RepoStatsState): { week: string; commits: number }[] => {
  if (!state.data) {return [];}

  const weekMap = new Map<string, number>();
  for (const contributor of state.data.contributors) {
    for (const week of contributor.weeklyActivity) {
      weekMap.set(week.week, (weekMap.get(week.week) || 0) + week.commits);
    }
  }

  return Array.from(weekMap.entries())
    .map(([week, commits]) => ({ week, commits }))
    .sort((a, b) => a.week.localeCompare(b.week));
};

export const selectFilteredContributors = (state: RepoStatsState) => {
  if (!state.data) {return [];}

  const contributors = state.data.contributors;
  const allWeeks = selectAllWeeks(state);

  // Use slider range if set, otherwise use full range
  const startIdx = state.timeRangeStart ?? 0;
  const endIdx = state.timeRangeEnd ?? allWeeks.length - 1;
  const selectedWeeks = new Set(allWeeks.slice(startIdx, endIdx + 1));

  return contributors.map((contributor) => {
    const filteredActivity = contributor.weeklyActivity.filter((week) =>
      selectedWeeks.has(week.week)
    );

    const filteredCommits = filteredActivity.reduce((sum, w) => sum + w.commits, 0);
    const filteredAdded = filteredActivity.reduce((sum, w) => sum + w.additions, 0);
    const filteredDeleted = filteredActivity.reduce((sum, w) => sum + w.deletions, 0);

    return {
      ...contributor,
      commits: filteredCommits,
      linesAdded: filteredAdded,
      linesDeleted: filteredDeleted,
      weeklyActivity: filteredActivity,
    };
  }).filter((c) => c.commits > 0).sort((a, b) => b.commits - a.commits);
};

/**
 * Returns all weeks in the filtered time range.
 * Used to ensure all contributor sparklines show the same time range.
 */
export const selectTimeRangeWeeks = (state: RepoStatsState): string[] => {
  if (!state.data) {return [];}

  const allWeeks = selectAllWeeks(state);

  // Use slider range if set, otherwise use full range
  const startIdx = state.timeRangeStart ?? 0;
  const endIdx = state.timeRangeEnd ?? allWeeks.length - 1;

  return allWeeks.slice(startIdx, endIdx + 1);
};

export const selectFilteredCodeFrequency = (state: RepoStatsState) => {
  if (!state.data) {return [];}

  const frequency = state.data.codeFrequency;
  const cutoffDate = getCutoffDate(state.timePeriod);

  let filtered = frequency;
  if (cutoffDate) {
    filtered = frequency.filter((f) => {
      const weekDate = parseISOWeek(f.week);
      return weekDate >= cutoffDate;
    });
  }

  // Aggregate to monthly if needed
  if (state.frequencyGranularity === 'monthly') {
    return aggregateToMonthly(filtered);
  }

  return filtered;
};

// ============================================================================
// Helper Functions
// ============================================================================

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

function parseISOWeek(isoWeek: string): Date {
  // Parse "2025-W03" format
  const match = isoWeek.match(/^(\d{4})-W(\d{2})$/);
  if (!match) {return new Date(0);}

  const year = parseInt(match[1], 10);
  const week = parseInt(match[2], 10);

  // Get January 4th of the year (always in week 1)
  const jan4 = new Date(year, 0, 4);
  // Get the Monday of week 1
  const dayOfWeek = jan4.getDay() || 7;
  const week1Monday = new Date(jan4);
  week1Monday.setDate(jan4.getDate() - dayOfWeek + 1);

  // Add weeks
  const result = new Date(week1Monday);
  result.setDate(week1Monday.getDate() + (week - 1) * 7);

  return result;
}

function aggregateToMonthly(weekly: { week: string; additions: number; deletions: number; netChange: number }[]) {
  const monthlyMap = new Map<string, { additions: number; deletions: number; netChange: number }>();

  for (const week of weekly) {
    const date = parseISOWeek(week.week);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

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
      week: month, // Reusing 'week' field for consistency
      ...data,
    }))
    .sort((a, b) => a.week.localeCompare(b.week));
}
