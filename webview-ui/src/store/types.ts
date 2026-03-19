import type {
  AnalysisResult,
  AnalysisTargetOption,
  ColorMode,
  EvolutionResult,
  EvolutionStatus,
  ExtensionSettings,
  FrequencyGranularity,
  LoadingState,
  RepoScopedSettings,
  TimePeriod,
  TreemapFilterPreset,
  TreemapFilterState,
  TreemapNode,
  ViewType,
} from '../types';
import type { SizeDisplayMode } from '../components/treemap/types';

export interface AnalysisSlice {
  data: AnalysisResult | null;
  error: string | null;
  loading: LoadingState;
  coreStale: boolean;
  setData: (data: AnalysisResult) => void;
  mergeData: (partial: Partial<AnalysisResult>) => void;
  setError: (error: string | null) => void;
  setLoading: (loading: Partial<LoadingState>) => void;
  setStaleness: (status: { coreStale: boolean; evolutionStale: boolean }) => void;
  resetAnalysisState: () => void;
}

export interface EvolutionSlice {
  evolutionData: EvolutionResult | null;
  evolutionStatus: EvolutionStatus;
  evolutionError: string | null;
  evolutionLoading: LoadingState;
  evolutionStale: boolean;
  setEvolutionData: (data: EvolutionResult) => void;
  setEvolutionError: (error: string | null) => void;
  setEvolutionLoading: (loading: Partial<LoadingState>) => void;
  setEvolutionStatus: (status: EvolutionStatus) => void;
}

export interface SettingsSlice {
  settings: ExtensionSettings | null;
  scopedSettings: RepoScopedSettings | null;
  repoScopeAvailable: boolean;
  setSettings: (settings: ExtensionSettings) => void;
  setScopedSettings: (settings: RepoScopedSettings) => void;
  setRepoScopeAvailable: (available: boolean) => void;
}

export interface RepositorySlice {
  availableTargets: AnalysisTargetOption[];
  selectedTargetId: string | null;
  setRepositorySelection: (targets: AnalysisTargetOption[], selectedTargetId: string | null) => void;
}

export interface UiSlice {
  activeView: ViewType;
  timePeriod: TimePeriod;
  frequencyGranularity: FrequencyGranularity;
  contributorGranularity: FrequencyGranularity;
  colorMode: ColorMode;
  timeRangeStart: number | null;
  timeRangeEnd: number | null;
  setActiveView: (view: ViewType) => void;
  setTimePeriod: (period: TimePeriod) => void;
  setFrequencyGranularity: (granularity: FrequencyGranularity) => void;
  setContributorGranularity: (granularity: FrequencyGranularity) => void;
  setColorMode: (mode: ColorMode) => void;
  setTimeRange: (start: number | null, end: number | null) => void;
}

export interface TreemapSlice {
  treemapPath: string[];
  currentTreemapNode: TreemapNode | null;
  treemapFilter: TreemapFilterState;
  sizeDisplayMode: SizeDisplayMode;
  maxNestingDepth: number;
  hoveredNode: TreemapNode | null;
  selectedNode: TreemapNode | null;
  navigateToTreemapPath: (path: string[]) => void;
  setTreemapFilterPreset: (preset: TreemapFilterPreset) => void;
  toggleTreemapLanguage: (language: string) => void;
  setSizeDisplayMode: (mode: SizeDisplayMode) => void;
  setMaxNestingDepth: (depth: number) => void;
  setHoveredNode: (node: TreemapNode | null) => void;
  setSelectedNode: (node: TreemapNode | null) => void;
  clearSelection: () => void;
}

export interface StoreLifecycleActions {
  reset: () => void;
}

export type RepoStatsState = AnalysisSlice &
  EvolutionSlice &
  SettingsSlice &
  RepositorySlice &
  UiSlice &
  TreemapSlice &
  StoreLifecycleActions;

export const analysisInitialState = {
  data: null as AnalysisResult | null,
  error: null as string | null,
  loading: {
    isLoading: false,
    phase: '',
    progress: 0,
  } satisfies LoadingState,
  coreStale: false,
};

export const evolutionInitialState = {
  evolutionData: null as EvolutionResult | null,
  evolutionStatus: 'idle' as EvolutionStatus,
  evolutionError: null as string | null,
  evolutionLoading: {
    isLoading: false,
    phase: '',
    progress: 0,
  } satisfies LoadingState,
  evolutionStale: false,
};

export const settingsInitialState = {
  settings: null as ExtensionSettings | null,
  scopedSettings: null as RepoScopedSettings | null,
  repoScopeAvailable: true,
};

export const repositoryInitialState = {
  availableTargets: [] as AnalysisTargetOption[],
  selectedTargetId: null as string | null,
};

export const uiInitialState = {
  activeView: 'overview' as ViewType,
  timePeriod: 'all' as TimePeriod,
  frequencyGranularity: 'weekly' as FrequencyGranularity,
  contributorGranularity: 'weekly' as FrequencyGranularity,
  colorMode: 'language' as ColorMode,
  timeRangeStart: null as number | null,
  timeRangeEnd: null as number | null,
};

export const treemapInitialState = {
  treemapPath: [] as string[],
  currentTreemapNode: null as TreemapNode | null,
  treemapFilter: {
    preset: 'all' as TreemapFilterPreset,
    selectedLanguages: new Set<string>(),
  } satisfies TreemapFilterState,
  sizeDisplayMode: 'loc' as SizeDisplayMode,
  maxNestingDepth: 5,
  hoveredNode: null as TreemapNode | null,
  selectedNode: null as TreemapNode | null,
};

export function createInitialRepoStatsState() {
  return {
    ...analysisInitialState,
    ...evolutionInitialState,
    ...settingsInitialState,
    ...repositoryInitialState,
    ...uiInitialState,
    ...treemapInitialState,
  };
}
