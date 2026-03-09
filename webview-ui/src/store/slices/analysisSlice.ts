import type { StateCreator } from 'zustand';
import type { RepoStatsState } from '../types';
import { computeDefaultGranularity } from '../helpers';

export const createAnalysisSlice: StateCreator<
  RepoStatsState,
  [],
  [],
  Pick<
    RepoStatsState,
    'data' | 'error' | 'loading' | 'coreStale' | 'setData' | 'mergeData' | 'setError' | 'setLoading' | 'setStaleness' | 'resetAnalysisState'
  >
> = (set, get) => ({
  data: null,
  error: null,
  loading: { isLoading: false, phase: '', progress: 0 },
  coreStale: false,

  setData: (data) => {
    const defaultGranularity = computeDefaultGranularity(data, get().settings);

    set({
      data,
      error: null,
      loading: { isLoading: false, phase: '', progress: 100 },
      currentTreemapNode: data.fileTree,
      treemapPath: [],
      frequencyGranularity: defaultGranularity,
      contributorGranularity: defaultGranularity,
      coreStale: false,
    });
  },

  mergeData: (partial) => {
    set((state) => {
      if (!state.data) {
        return {};
      }

      return {
        data: {
          ...state.data,
          ...partial,
        },
        error: null,
      };
    });
  },

  setError: (error) => {
    set({
      error,
      loading: { isLoading: false, phase: '', progress: 0 },
    });
  },

  setLoading: (loading) => {
    set((state) => ({
      loading: { ...state.loading, ...loading },
    }));
  },

  setStaleness: ({ coreStale, evolutionStale }) => {
    set((state) => ({
      coreStale,
      evolutionStale,
      evolutionStatus:
        evolutionStale && state.evolutionData && state.evolutionStatus === 'ready'
          ? 'stale'
          : state.evolutionStatus,
    }));
  },

  resetAnalysisState: () => {
    set((state) => ({
      data: null,
      error: null,
      evolutionData: null,
      evolutionStatus: 'idle',
      evolutionError: null,
      loading: { isLoading: false, phase: '', progress: 0 },
      evolutionLoading: { isLoading: false, phase: '', progress: 0 },
      settings: null,
      scopedSettings: null,
      coreStale: false,
      evolutionStale: false,
      treemapPath: [],
      currentTreemapNode: null,
      hoveredNode: null,
      selectedNode: null,
      timeRangeStart: null,
      timeRangeEnd: null,
      frequencyGranularity: state.settings
        ? computeDefaultGranularity(null, state.settings)
        : state.frequencyGranularity,
      contributorGranularity: state.settings
        ? computeDefaultGranularity(null, state.settings)
        : state.contributorGranularity,
    }));
  },
});
