import type { StateCreator } from 'zustand';
import type { RepoStatsState } from '../types';
import { resultPresentationForCompleteness } from './resultPresentation';

export const createEvolutionSlice: StateCreator<
  RepoStatsState,
  [],
  [],
  Pick<
    RepoStatsState,
    'evolutionData' | 'evolutionStatus' | 'evolutionError' | 'evolutionLoading' | 'evolutionStale' | 'evolutionPresentation' | 'setEvolutionData' | 'setEvolutionError' | 'setEvolutionLoading' | 'setEvolutionStatus' | 'setEvolutionPresentation'
  >
> = (set) => ({
  evolutionData: null,
  evolutionStatus: 'idle',
  evolutionError: null,
  evolutionLoading: { isLoading: false, phase: '', progress: 0 },
  evolutionStale: false,
  evolutionPresentation: {
    displayedResultKind: 'none',
    displayedResultSource: 'none',
    activeRunState: 'idle',
  },

  setEvolutionData: (data, options) => {
    const completeness = options?.completeness ?? 'final';

    set((state) => ({
      evolutionData: data,
      evolutionStatus: completeness === 'final' ? 'ready' : state.evolutionStatus,
      evolutionError: null,
      evolutionStale: false,
      evolutionLoading: completeness === 'final'
        ? { isLoading: false, phase: '', progress: 100 }
        : state.evolutionLoading,
      evolutionPresentation: resultPresentationForCompleteness(completeness),
    }));
  },

  setEvolutionError: (error) => {
    set((state) => {
      if (!error) {
        return {
          evolutionError: null,
        };
      }

      return {
        evolutionError: error,
        evolutionStatus: 'error',
        evolutionLoading: { isLoading: false, phase: '', progress: 0 },
        evolutionPresentation: {
          ...state.evolutionPresentation,
          activeRunState: 'idle',
        },
      };
    });
  },

  setEvolutionLoading: (loading) => {
    set((state) => ({
      evolutionLoading: { ...state.evolutionLoading, ...loading },
      evolutionStatus: loading.isLoading ? 'loading' : state.evolutionStatus,
    }));
  },

  setEvolutionStatus: (status) => {
    set({ evolutionStatus: status, evolutionStale: status === 'stale' });
  },

  setEvolutionPresentation: (presentation) => {
    set((state) => ({
      evolutionPresentation: {
        ...state.evolutionPresentation,
        ...presentation,
      },
    }));
  },
});
