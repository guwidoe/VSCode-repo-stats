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
  TreemapFilterPreset,
  TreemapFilterState,
  ExtensionSettings,
} from '../types';
import type { SizeDisplayMode } from '../components/treemap/types';
import { isCodeLanguage } from '../utils/fileTypes';

// ============================================================================
// Store State Interface
// ============================================================================

interface RepoStatsState {
  // Data
  data: AnalysisResult | null;
  error: string | null;

  // Loading state
  loading: LoadingState;

  // Settings
  settings: ExtensionSettings | null;

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

  // Treemap filter
  treemapFilter: TreemapFilterState;

  // Treemap display options
  sizeDisplayMode: SizeDisplayMode;
  maxNestingDepth: number;
  hoveredNode: TreemapNode | null;
  selectedNode: TreemapNode | null;

  // Actions
  setData: (data: AnalysisResult) => void;
  setError: (error: string | null) => void;
  setLoading: (loading: Partial<LoadingState>) => void;
  setSettings: (settings: ExtensionSettings) => void;
  setActiveView: (view: ViewType) => void;
  setTimePeriod: (period: TimePeriod) => void;
  setFrequencyGranularity: (granularity: FrequencyGranularity) => void;
  setContributorGranularity: (granularity: FrequencyGranularity) => void;
  setColorMode: (mode: ColorMode) => void;
  setTimeRange: (start: number | null, end: number | null) => void;
  navigateToTreemapPath: (path: string[]) => void;
  setTreemapFilterPreset: (preset: TreemapFilterPreset) => void;
  toggleTreemapLanguage: (language: string) => void;
  setSizeDisplayMode: (mode: SizeDisplayMode) => void;
  setMaxNestingDepth: (depth: number) => void;
  setHoveredNode: (node: TreemapNode | null) => void;
  setSelectedNode: (node: TreemapNode | null) => void;
  clearSelection: () => void;
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
  settings: null as ExtensionSettings | null,
  activeView: 'overview' as ViewType,
  timePeriod: 'all' as TimePeriod,
  frequencyGranularity: 'weekly' as FrequencyGranularity,
  contributorGranularity: 'weekly' as FrequencyGranularity,
  colorMode: 'language' as ColorMode,
  timeRangeStart: null as number | null,
  timeRangeEnd: null as number | null,
  treemapPath: [] as string[],
  currentTreemapNode: null,
  treemapFilter: {
    preset: 'all' as TreemapFilterPreset,
    selectedLanguages: new Set<string>(),
  },
  // Treemap display options
  sizeDisplayMode: 'loc' as SizeDisplayMode,
  maxNestingDepth: 5,
  hoveredNode: null as TreemapNode | null,
  selectedNode: null as TreemapNode | null,
};

// ============================================================================
// Helper: Compute Default Granularity
// ============================================================================

/**
 * Computes the default granularity based on settings and data.
 * - 'auto' mode: weekly if repo has <= threshold weeks, monthly otherwise
 * - 'weekly' mode: always weekly
 * - 'monthly' mode: always monthly
 */
function computeDefaultGranularity(
  data: AnalysisResult | null,
  settings: ExtensionSettings | null
): FrequencyGranularity {
  if (!settings) {
    return 'weekly';
  }

  const mode = settings.defaultGranularityMode || 'auto';

  if (mode === 'weekly') {
    return 'weekly';
  }

  if (mode === 'monthly') {
    return 'monthly';
  }

  // Auto mode - compute based on data
  if (!data) {
    return 'weekly';
  }

  // Count unique weeks in the data
  const allWeeks = new Set<string>();
  for (const contributor of data.contributors) {
    for (const week of contributor.weeklyActivity) {
      if (/^\d{4}-W\d{2}$/.test(week.week)) {
        allWeeks.add(week.week);
      }
    }
  }

  const weekCount = allWeeks.size;
  const threshold = settings.autoGranularityThreshold || 20;

  return weekCount <= threshold ? 'weekly' : 'monthly';
}

// ============================================================================
// Store
// ============================================================================

export const useStore = create<RepoStatsState>((set, get) => ({
  ...initialState,

  setData: (data: AnalysisResult) => {
    const { settings } = get();

    // Compute default granularity based on settings and data
    const defaultGranularity = computeDefaultGranularity(data, settings);

    set({
      data,
      error: null,
      loading: { isLoading: false, phase: '', progress: 100 },
      currentTreemapNode: data.fileTree,
      treemapPath: [],
      frequencyGranularity: defaultGranularity,
      contributorGranularity: defaultGranularity,
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

  setSettings: (settings: ExtensionSettings) => {
    const { data } = get();
    const defaultGranularity = computeDefaultGranularity(data, settings);
    set({
      settings,
      frequencyGranularity: defaultGranularity,
      contributorGranularity: defaultGranularity,
    });
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

  setTreemapFilterPreset: (preset: TreemapFilterPreset) => {
    set((state) => ({
      treemapFilter: { ...state.treemapFilter, preset },
    }));
  },

  toggleTreemapLanguage: (language: string) => {
    set((state) => {
      const newSet = new Set(state.treemapFilter.selectedLanguages);
      if (newSet.has(language)) {
        newSet.delete(language);
      } else {
        newSet.add(language);
      }
      return {
        treemapFilter: { ...state.treemapFilter, selectedLanguages: newSet },
      };
    });
  },

  setSizeDisplayMode: (mode: SizeDisplayMode) => {
    set({ sizeDisplayMode: mode });
  },

  setMaxNestingDepth: (depth: number) => {
    set({ maxNestingDepth: depth });
  },

  setHoveredNode: (node: TreemapNode | null) => {
    set({ hoveredNode: node });
  },

  setSelectedNode: (node: TreemapNode | null) => {
    set({ selectedNode: node });
  },

  clearSelection: () => {
    set({ selectedNode: null });
  },

  reset: () => {
    set(initialState);
  },
}));

// ============================================================================
// Memoization Cache
// ============================================================================

// Simple memoization for expensive selectors that only depend on data
let cachedData: AnalysisResult | null = null;
let cachedAllWeeks: string[] = [];
let cachedWeeklyTotals: { week: string; commits: number }[] = [];

// Memoization for filtered treemap
let cachedFilteredTreemapNode: TreemapNode | null = null;
let cachedFilterParams: {
  node: TreemapNode | null;
  preset: TreemapFilterPreset;
  selectedLanguages: string[];
  sizeMode: SizeDisplayMode;
} | null = null;

/**
 * Validates that a string is a properly formatted ISO week (YYYY-Www).
 */
function isValidISOWeek(value: string): boolean {
  return /^\d{4}-W\d{2}$/.test(value);
}

// ============================================================================
// Selectors
// ============================================================================

/**
 * Returns ALL weeks from the data (for the slider background).
 * Memoized to prevent creating new arrays when data hasn't changed.
 */
export const selectAllWeeks = (state: RepoStatsState): string[] => {
  if (!state.data) {return [];}

  // Return cached result if data hasn't changed
  if (state.data === cachedData && cachedAllWeeks.length > 0) {
    return cachedAllWeeks;
  }

  const allWeeks = new Set<string>();
  for (const contributor of state.data.contributors) {
    for (const week of contributor.weeklyActivity) {
      // Only include valid ISO week strings
      if (isValidISOWeek(week.week)) {
        allWeeks.add(week.week);
      }
    }
  }

  cachedData = state.data;
  cachedAllWeeks = Array.from(allWeeks).sort();
  return cachedAllWeeks;
};

/**
 * Returns aggregated commit counts per week (for slider background chart).
 * Memoized to prevent creating new arrays when data hasn't changed.
 */
export const selectWeeklyCommitTotals = (state: RepoStatsState): { week: string; commits: number }[] => {
  if (!state.data) {return [];}

  // Return cached result if data hasn't changed
  if (state.data === cachedData && cachedWeeklyTotals.length > 0) {
    return cachedWeeklyTotals;
  }

  const weekMap = new Map<string, number>();
  for (const contributor of state.data.contributors) {
    for (const week of contributor.weeklyActivity) {
      // Only include valid ISO week strings
      if (isValidISOWeek(week.week)) {
        weekMap.set(week.week, (weekMap.get(week.week) || 0) + week.commits);
      }
    }
  }

  cachedWeeklyTotals = Array.from(weekMap.entries())
    .map(([week, commits]) => ({ week, commits }))
    .sort((a, b) => a.week.localeCompare(b.week));

  return cachedWeeklyTotals;
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

// ============================================================================
// Treemap Filter Selector
// ============================================================================

/**
 * Returns the filtered treemap node based on current filter settings.
 * Memoized to prevent expensive tree traversal on every render.
 *
 * In LOC mode, binary files are automatically hidden since they have 0 lines.
 * In Size mode, binary files are shown (unless explicitly filtered).
 */
export const selectFilteredTreemapNode = (state: RepoStatsState): TreemapNode | null => {
  const { currentTreemapNode, treemapFilter, sizeDisplayMode } = state;

  if (!currentTreemapNode) {
    return null;
  }

  // In LOC mode, always hide binaries (they have 0 lines)
  // In Size mode with 'all' preset, show everything
  const shouldHideBinaries = sizeDisplayMode === 'loc';
  const noFilterNeeded = treemapFilter.preset === 'all' && !shouldHideBinaries;

  if (noFilterNeeded) {
    return currentTreemapNode;
  }

  // Check memoization cache
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

  // Build filter function based on preset and size mode
  const filterFn = createTreemapFilterFunction(treemapFilter, shouldHideBinaries);

  // Recursively filter the tree
  const filtered = filterTreeNode(currentTreemapNode, filterFn);

  // Update cache
  cachedFilterParams = {
    node: currentTreemapNode,
    preset: treemapFilter.preset,
    selectedLanguages: selectedLanguagesArray,
    sizeMode: sizeDisplayMode,
  };
  cachedFilteredTreemapNode = filtered;

  return filtered;
};

/**
 * Creates a filter function based on the current filter state.
 * @param filter The current filter state
 * @param forceHideBinaries If true, always hide binary files (used in LOC mode)
 */
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
        // Exclude binary files and non-code languages
        return !node.binary && isCodeLanguage(node.language);
      };

    case 'custom':
      return (node) => {
        if (node.type === 'directory') {
          return true;
        }
        return filter.selectedLanguages.has(node.language || 'Unknown');
      };

    default:
      // 'all' preset - but may still hide binaries in LOC mode
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

/**
 * Recursively filters a tree node, recalculating directory line counts.
 * Returns null if the node should be excluded entirely.
 */
function filterTreeNode(
  node: TreemapNode,
  filterFn: (node: TreemapNode) => boolean
): TreemapNode | null {
  // Check if this node passes the filter
  if (!filterFn(node)) {
    return null;
  }

  // For files, return a copy if it passes
  if (node.type === 'file') {
    return { ...node };
  }

  // For directories, recursively filter children
  const filteredChildren: TreemapNode[] = [];
  let totalLines = 0;

  for (const child of node.children || []) {
    const filteredChild = filterTreeNode(child, filterFn);
    if (filteredChild) {
      filteredChildren.push(filteredChild);
      totalLines += filteredChild.lines || 0;
    }
  }

  // Prune empty directories
  if (filteredChildren.length === 0) {
    return null;
  }

  return {
    ...node,
    children: filteredChildren,
    lines: totalLines,
  };
}

/**
 * Helper for array comparison in memoization.
 */
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
