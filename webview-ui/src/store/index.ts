/**
 * Zustand store for the Repo Stats webview.
 */

import { create } from 'zustand';
import type {
  AnalysisResult,
  TimePeriod,
  TreemapFilterPreset,
  TreemapFilterState,
  TreemapNode,
} from '../types';
import type { SizeDisplayMode } from '../components/treemap/types';
import { isCodeLanguage } from '../utils/fileTypes';
import { createAnalysisSlice } from './slices/analysisSlice';
import { createEvolutionSlice } from './slices/evolutionSlice';
import { createRepositorySlice } from './slices/repositorySlice';
import { createSettingsSlice } from './slices/settingsSlice';
import { createTreemapSlice } from './slices/treemapSlice';
import { createUiSlice } from './slices/uiSlice';
import {
  createInitialRepoStatsState,
  type RepoStatsState,
} from './types';

export const useStore = create<RepoStatsState>((set, get, api) => ({
  ...createInitialRepoStatsState(),
  ...createAnalysisSlice(set, get, api),
  ...createEvolutionSlice(set, get, api),
  ...createSettingsSlice(set, get, api),
  ...createRepositorySlice(set, get, api),
  ...createUiSlice(set, get, api),
  ...createTreemapSlice(set, get, api),
  reset: () => {
    set(createInitialRepoStatsState());
  },
}));

// ============================================================================
// Memoization Cache
// ============================================================================

let cachedAllWeeksData: AnalysisResult | null = null;
let cachedAllWeeks: string[] = [];
let cachedWeeklyTotalsData: AnalysisResult | null = null;
let cachedWeeklyTotals: { week: string; commits: number }[] = [];

let cachedFilteredTreemapNode: TreemapNode | null = null;
let cachedFilterParams: {
  node: TreemapNode | null;
  preset: TreemapFilterPreset;
  selectedLanguages: string[];
  sizeMode: SizeDisplayMode;
} | null = null;

function isValidISOWeek(value: string): boolean {
  return /^\d{4}-W\d{2}$/.test(value);
}

// ============================================================================
// Selectors
// ============================================================================

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
    filtered = frequency.filter((f) => {
      const weekDate = parseISOWeek(f.week);
      return weekDate !== null && weekDate >= cutoffDate;
    });
  }

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

function parseISOWeek(isoWeek: string): Date | null {
  const match = isoWeek.match(/^(\d{4})-W(\d{2})$/);
  if (!match) {
    return null;
  }

  const year = parseInt(match[1], 10);
  const week = parseInt(match[2], 10);
  if (year < 1970 || year > 2100 || week < 1 || week > 53) {
    return null;
  }

  const jan4 = new Date(year, 0, 4);
  const dayOfWeek = jan4.getDay() || 7;
  const week1Monday = new Date(jan4);
  week1Monday.setDate(jan4.getDate() - dayOfWeek + 1);

  const result = new Date(week1Monday);
  result.setDate(week1Monday.getDate() + (week - 1) * 7);

  return result;
}

function aggregateToMonthly(
  weekly: { week: string; additions: number; deletions: number; netChange: number }[]
) {
  const monthlyMap = new Map<string, { additions: number; deletions: number; netChange: number }>();

  for (const week of weekly) {
    const date = parseISOWeek(week.week);
    if (!date) {
      continue;
    }

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
      week: month,
      ...data,
    }))
    .sort((a, b) => a.week.localeCompare(b.week));
}

// ============================================================================
// Treemap Filter Selector
// ============================================================================

export const selectFilteredTreemapNode = (state: RepoStatsState): TreemapNode | null => {
  const { currentTreemapNode, treemapFilter, sizeDisplayMode } = state;

  if (!currentTreemapNode) {
    return null;
  }

  const shouldHideBinaries = sizeDisplayMode === 'loc';
  const noFilterNeeded = treemapFilter.preset === 'all' && !shouldHideBinaries;

  if (noFilterNeeded) {
    return currentTreemapNode;
  }

  const selectedLanguagesArray = Array.from(treemapFilter.selectedLanguages).sort();
  if (
    cachedFilterParams &&
    cachedFilterParams.node === currentTreemapNode &&
    cachedFilterParams.preset === treemapFilter.preset &&
    cachedFilterParams.sizeMode === sizeDisplayMode &&
    arraysEqual(cachedFilterParams.selectedLanguages, selectedLanguagesArray)
  ) {
    return cachedFilteredTreemapNode;
  }

  const filterFn = createTreemapFilterFunction(treemapFilter, shouldHideBinaries);
  const filtered = filterTreeNode(currentTreemapNode, filterFn);

  cachedFilterParams = {
    node: currentTreemapNode,
    preset: treemapFilter.preset,
    selectedLanguages: selectedLanguagesArray,
    sizeMode: sizeDisplayMode,
  };
  cachedFilteredTreemapNode = filtered;

  return filtered;
};

function createTreemapFilterFunction(
  filter: TreemapFilterState,
  forceHideBinaries: boolean = false
): (node: TreemapNode) => boolean {
  switch (filter.preset) {
    case 'hide-binary':
      return (node) => {
        if (node.type === 'directory') {
          return true;
        }
        return !node.binary;
      };

    case 'code-only':
      return (node) => {
        if (node.type === 'directory') {
          return true;
        }
        return !node.binary && isCodeLanguage(node.language);
      };

    case 'custom':
      return (node) => {
        if (node.type === 'directory') {
          return true;
        }
        return filter.selectedLanguages.has(node.language ?? 'Unknown');
      };

    default:
      if (forceHideBinaries) {
        return (node) => {
          if (node.type === 'directory') {
            return true;
          }
          return !node.binary;
        };
      }
      return () => true;
  }
}

function filterTreeNode(
  node: TreemapNode,
  filterFn: (node: TreemapNode) => boolean
): TreemapNode | null {
  if (!filterFn(node)) {
    return null;
  }

  if (node.type === 'file') {
    return { ...node };
  }

  const filteredChildren: TreemapNode[] = [];
  let totalLines = 0;

  for (const child of node.children ?? []) {
    const filteredChild = filterTreeNode(child, filterFn);
    if (filteredChild) {
      filteredChildren.push(filteredChild);
      totalLines += filteredChild.lines ?? 0;
    }
  }

  if (filteredChildren.length === 0) {
    return null;
  }

  return {
    ...node,
    children: filteredChildren,
    lines: totalLines,
  };
}

function arraysEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) {
    return false;
  }
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) {
      return false;
    }
  }
  return true;
}

export type { RepoStatsState } from './types';
