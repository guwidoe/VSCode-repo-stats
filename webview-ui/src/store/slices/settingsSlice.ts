import type { StateCreator } from 'zustand';
import type { RepoStatsState } from '../types';
import { computeDefaultGranularity } from '../helpers';

export const createSettingsSlice: StateCreator<
  RepoStatsState,
  [],
  [],
  Pick<RepoStatsState, 'settings' | 'scopedSettings' | 'setSettings' | 'setScopedSettings'>
> = (set, get) => ({
  settings: null,
  scopedSettings: null,

  setSettings: (settings) => {
    const defaultGranularity = computeDefaultGranularity(get().data, settings);
    set({
      settings,
      frequencyGranularity: defaultGranularity,
      contributorGranularity: defaultGranularity,
    });
  },

  setScopedSettings: (scopedSettings) => {
    set({ scopedSettings });
  },
});
