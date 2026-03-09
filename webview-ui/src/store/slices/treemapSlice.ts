import type { StateCreator } from 'zustand';
import type { RepoStatsState } from '../types';
import { findTreemapNodeByPath } from '../helpers';

export const createTreemapSlice: StateCreator<
  RepoStatsState,
  [],
  [],
  Pick<
    RepoStatsState,
    'treemapPath' | 'currentTreemapNode' | 'treemapFilter' | 'sizeDisplayMode' | 'maxNestingDepth' | 'hoveredNode' | 'selectedNode' | 'navigateToTreemapPath' | 'setTreemapFilterPreset' | 'toggleTreemapLanguage' | 'setSizeDisplayMode' | 'setMaxNestingDepth' | 'setHoveredNode' | 'setSelectedNode' | 'clearSelection'
  >
> = (set, get) => ({
  treemapPath: [],
  currentTreemapNode: null,
  treemapFilter: {
    preset: 'all',
    selectedLanguages: new Set<string>(),
  },
  sizeDisplayMode: 'loc',
  maxNestingDepth: 5,
  hoveredNode: null,
  selectedNode: null,

  navigateToTreemapPath: (path) => {
    const data = get().data;
    if (!data) {
      return;
    }

    set({
      treemapPath: path,
      currentTreemapNode: findTreemapNodeByPath(data.fileTree, path),
    });
  },

  setTreemapFilterPreset: (preset) => {
    set((state) => ({
      treemapFilter: { ...state.treemapFilter, preset },
    }));
  },

  toggleTreemapLanguage: (language) => {
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

  setSizeDisplayMode: (mode) => {
    set({ sizeDisplayMode: mode });
  },

  setMaxNestingDepth: (depth) => {
    set({ maxNestingDepth: depth });
  },

  setHoveredNode: (node) => {
    set({ hoveredNode: node });
  },

  setSelectedNode: (node) => {
    set({ selectedNode: node });
  },

  clearSelection: () => {
    set({ selectedNode: null });
  },
});
