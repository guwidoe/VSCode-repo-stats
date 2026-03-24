/**
 * Zustand store for the Repo Stats webview.
 */

import { create } from 'zustand';
import { createAnalysisSlice } from './slices/analysisSlice';
import { createEvolutionSlice } from './slices/evolutionSlice';
import { createRepositorySlice } from './slices/repositorySlice';
import { createSettingsSlice } from './slices/settingsSlice';
import { createTreemapSlice } from './slices/treemapSlice';
import { createUiSlice } from './slices/uiSlice';
import {
  createInitialRepoStatsState,
  type RepoStatsState,
} from './types';
export {
  selectAllWeeks,
  selectFilteredCodeFrequency,
  selectFilteredContributors,
  selectTimeRangeWeeks,
  selectWeeklyCommitTotals,
} from './selectors/analysisSelectors';
export { selectFilteredTreemapNode } from './selectors/treemapSelectors';

export const useStore = create<RepoStatsState>((set, get, api) => ({
  ...createInitialRepoStatsState(),
  ...createAnalysisSlice(set, get, api),
  ...createEvolutionSlice(set, get, api),
  ...createSettingsSlice(set, get, api),
  ...createRepositorySlice(set, get, api),
  ...createUiSlice(set, get, api),
  ...createTreemapSlice(set, get, api),
  reset: () => {
    set(createInitialRepoStatsState());
  },
}));

export type { RepoStatsState } from './types';
