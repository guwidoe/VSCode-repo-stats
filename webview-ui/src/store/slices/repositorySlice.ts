import type { StateCreator } from 'zustand';
import type { RepoStatsState } from '../types';

export const createRepositorySlice: StateCreator<
  RepoStatsState,
  [],
  [],
  Pick<
    RepoStatsState,
    'availableRepositories' | 'selectedRepositoryIds' | 'selectedTarget' | 'setRepositorySelection'
  >
> = (set) => ({
  availableRepositories: [],
  selectedRepositoryIds: [],
  selectedTarget: null,

  setRepositorySelection: (availableRepositories, selectedRepositoryIds, selectedTarget) => {
    set({ availableRepositories, selectedRepositoryIds, selectedTarget });
  },
});
