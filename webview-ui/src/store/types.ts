import type {
  RunResultCompleteness,
  AnalysisResult,
  AnalysisTargetOption,
  ColorMode,
  RepositoryOption,
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

export type DisplayedResultKind = 'none' | RunResultCompleteness;
export type DisplayedResultSource = 'none' | 'lastCompletedRun' | 'activeRun';
export type ActiveRunState = 'idle' | 'running' | 'cancelled';

export interface ResultPresentationState {
  displayedResultKind: DisplayedResultKind;
  displayedResultSource: DisplayedResultSource;
  activeRunState: ActiveRunState;
}

export interface AnalysisSlice {
  data: AnalysisResult | null;
  error: string | null;
  loading: LoadingState;
  coreStale: boolean;
  analysisPresentation: ResultPresentationState;
  setData: (data: AnalysisResult, options?: { completeness?: RunResultCompleteness }) => void;
  mergeData: (partial: Partial<AnalysisResult>, options?: { completeness?: RunResultCompleteness }) => void;
  setError: (error: string | null) => void;
  setLoading: (loading: Partial<LoadingState>) => void;
  setAnalysisPresentation: (presentation: Partial<ResultPresentationState>) => void;
  setStaleness: (status: { coreStale: boolean; evolutionStale: boolean }) => void;
  resetAnalysisState: () => void;
}

export interface EvolutionSlice {
  evolutionData: EvolutionResult | null;
  evolutionStatus: EvolutionStatus;
  evolutionError: string | null;
  evolutionLoading: LoadingState;
  evolutionStale: boolean;
  evolutionPresentation: ResultPresentationState;
  setEvolutionData: (data: EvolutionResult, options?: { completeness?: RunResultCompleteness }) => void;
  setEvolutionError: (error: string | null) => void;
  setEvolutionLoading: (loading: Partial<LoadingState>) => void;
  setEvolutionStatus: (status: EvolutionStatus) => void;
  setEvolutionPresentation: (presentation: Partial<ResultPresentationState>) => void;
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
  availableRepositories: RepositoryOption[];
  selectedRepositoryIds: string[];
  selectedTarget: AnalysisTargetOption | null;
  setRepositorySelection: (
    repositories: RepositoryOption[],
    selectedRepositoryIds: string[],
    selectedTarget: AnalysisTargetOption | null
  ) => void;
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

export const emptyResultPresentationState = {
  displayedResultKind: 'none',
  displayedResultSource: 'none',
  activeRunState: 'idle',
} satisfies ResultPresentationState;

export const analysisInitialState = {
  data: null as AnalysisResult | null,
  error: null as string | null,
  loading: {
    isLoading: false,
    phase: '',
    progress: 0,
  } satisfies LoadingState,
  coreStale: false,
  analysisPresentation: { ...emptyResultPresentationState },
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
  evolutionPresentation: { ...emptyResultPresentationState },
};

export const settingsInitialState = {
  settings: null as ExtensionSettings | null,
  scopedSettings: null as RepoScopedSettings | null,
  repoScopeAvailable: true,
};

export const repositoryInitialState = {
  availableRepositories: [] as RepositoryOption[],
  selectedRepositoryIds: [] as string[],
  selectedTarget: null as AnalysisTargetOption | null,
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
