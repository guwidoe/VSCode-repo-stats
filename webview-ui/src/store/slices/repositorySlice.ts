import type { StateCreator } from 'zustand';
import type { RepoStatsState } from '../types';

export const createRepositorySlice: StateCreator<
  RepoStatsState,
  [],
  [],
  Pick<RepoStatsState, 'availableRepositories' | 'selectedRepoPath' | 'setRepositorySelection'>
> = (set) => ({
  availableRepositories: [],
  selectedRepoPath: null,

  setRepositorySelection: (availableRepositories, selectedRepoPath) => {
    set({ availableRepositories, selectedRepoPath });
  },
});
