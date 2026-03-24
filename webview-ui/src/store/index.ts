/**
 * Zustand store for the Repo Stats webview.
 */

import { create } from 'zustand';
import type {
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
export {
  selectAllWeeks,
  selectFilteredCodeFrequency,
  selectFilteredContributors,
  selectTimeRangeWeeks,
  selectWeeklyCommitTotals,
} from './selectors/analysisSelectors';

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

let cachedFilteredTreemapNode: TreemapNode | null = null;
let cachedFilterParams: {
  node: TreemapNode | null;
  preset: TreemapFilterPreset;
  selectedLanguages: string[];
  sizeMode: SizeDisplayMode;
} | null = null;

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
