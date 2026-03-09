import type { StateCreator } from 'zustand';
import type { RepoStatsState } from '../types';

export const createEvolutionSlice: StateCreator<
  RepoStatsState,
  [],
  [],
  Pick<
    RepoStatsState,
    'evolutionData' | 'evolutionStatus' | 'evolutionError' | 'evolutionLoading' | 'evolutionStale' | 'setEvolutionData' | 'setEvolutionError' | 'setEvolutionLoading' | 'setEvolutionStatus'
  >
> = (set) => ({
  evolutionData: null,
  evolutionStatus: 'idle',
  evolutionError: null,
  evolutionLoading: { isLoading: false, phase: '', progress: 0 },
  evolutionStale: false,

  setEvolutionData: (data) => {
    set({
      evolutionData: data,
      evolutionStatus: 'ready',
      evolutionError: null,
      evolutionStale: false,
      evolutionLoading: { isLoading: false, phase: '', progress: 100 },
    });
  },

  setEvolutionError: (error) => {
    set({
      evolutionError: error,
      evolutionStatus: error ? 'error' : 'idle',
      evolutionLoading: { isLoading: false, phase: '', progress: 0 },
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
});
