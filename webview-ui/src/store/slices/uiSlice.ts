import type { StateCreator } from 'zustand';
import type { RepoStatsState } from '../types';

export const createUiSlice: StateCreator<
  RepoStatsState,
  [],
  [],
  Pick<
    RepoStatsState,
    'activeView' | 'timePeriod' | 'frequencyGranularity' | 'contributorGranularity' | 'colorMode' | 'timeRangeStart' | 'timeRangeEnd' | 'setActiveView' | 'setTimePeriod' | 'setFrequencyGranularity' | 'setContributorGranularity' | 'setColorMode' | 'setTimeRange'
  >
> = (set) => ({
  activeView: 'overview',
  timePeriod: 'all',
  frequencyGranularity: 'weekly',
  contributorGranularity: 'weekly',
  colorMode: 'language',
  timeRangeStart: null,
  timeRangeEnd: null,

  setActiveView: (view) => {
    set({ activeView: view });
  },

  setTimePeriod: (period) => {
    set({ timePeriod: period });
  },

  setFrequencyGranularity: (granularity) => {
    set({ frequencyGranularity: granularity });
  },

  setContributorGranularity: (granularity) => {
    set({ contributorGranularity: granularity });
  },

  setColorMode: (mode) => {
    set({ colorMode: mode });
  },

  setTimeRange: (start, end) => {
    set({ timeRangeStart: start, timeRangeEnd: end });
  },
});
