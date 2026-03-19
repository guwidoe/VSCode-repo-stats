import type { StateCreator } from 'zustand';
import type { RepoStatsState } from '../types';

export const createRepositorySlice: StateCreator<
  RepoStatsState,
  [],
  [],
  Pick<RepoStatsState, 'availableTargets' | 'selectedTargetId' | 'setRepositorySelection'>
> = (set) => ({
  availableTargets: [],
  selectedTargetId: null,

  setRepositorySelection: (availableTargets, selectedTargetId) => {
    set({ availableTargets, selectedTargetId });
  },
});
