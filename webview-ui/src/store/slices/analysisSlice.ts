import type { StateCreator } from 'zustand';
import type { RepoStatsState } from '../types';
import { computeDefaultGranularity } from '../helpers';
import { resultPresentationForCompleteness } from './resultPresentation';

export const createAnalysisSlice: StateCreator<
  RepoStatsState,
  [],
  [],
  Pick<
    RepoStatsState,
    'data' | 'error' | 'loading' | 'coreStale' | 'analysisPresentation' | 'setData' | 'mergeData' | 'setError' | 'setLoading' | 'setAnalysisPresentation' | 'setStaleness' | 'resetAnalysisState'
  >
> = (set, get) => ({
  data: null,
  error: null,
  loading: { isLoading: false, phase: '', progress: 0 },
  coreStale: false,
  analysisPresentation: {
    displayedResultKind: 'none',
    displayedResultSource: 'none',
    activeRunState: 'idle',
  },

  setData: (data, options) => {
    const completeness = options?.completeness ?? 'final';
    const defaultGranularity = computeDefaultGranularity(data, get().settings);

    set((state) => ({
      data,
      error: null,
      loading: completeness === 'final'
        ? { isLoading: false, phase: '', progress: 100 }
        : state.loading,
      currentTreemapNode: data.fileTree,
      treemapPath: [],
      frequencyGranularity: defaultGranularity,
      contributorGranularity: defaultGranularity,
      coreStale: false,
      analysisPresentation: resultPresentationForCompleteness(completeness),
    }));
  },

  mergeData: (partial, options) => {
    const completeness = options?.completeness ?? 'preliminary';

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
        loading: completeness === 'final'
          ? { isLoading: false, phase: '', progress: 100 }
          : state.loading,
        analysisPresentation: resultPresentationForCompleteness(completeness),
      };
    });
  },

  setError: (error) => {
    set((state) => ({
      error,
      loading: { isLoading: false, phase: '', progress: 0 },
      analysisPresentation: {
        ...state.analysisPresentation,
        activeRunState: 'idle',
      },
    }));
  },

  setLoading: (loading) => {
    set((state) => ({
      loading: { ...state.loading, ...loading },
    }));
  },

  setAnalysisPresentation: (presentation) => {
    set((state) => ({
      analysisPresentation: {
        ...state.analysisPresentation,
        ...presentation,
      },
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
      analysisPresentation: {
        displayedResultKind: 'none',
        displayedResultSource: 'none',
        activeRunState: 'idle',
      },
      evolutionPresentation: {
        displayedResultKind: 'none',
        displayedResultSource: 'none',
        activeRunState: 'idle',
      },
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
