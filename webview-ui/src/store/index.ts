import { create } from 'zustand';

// Types matching the extension's data models
export interface ContributorStats {
  name: string;
  email: string;
  avatarUrl?: string;
  commits: number;
  linesAdded: number;
  linesDeleted: number;
  firstCommit: string;
  lastCommit: string;
  weeklyActivity: WeeklyCommit[];
}

export interface WeeklyCommit {
  week: string;
  commits: number;
  additions: number;
  deletions: number;
}

export interface CodeFrequency {
  week: string;
  additions: number;
  deletions: number;
  netChange: number;
}

export interface TreemapNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  lines?: number;
  language?: string;
  lastModified?: string;
  children?: TreemapNode[];
}

export interface RepoInfo {
  name: string;
  branch: string;
  totalCommits: number;
  totalFiles: number;
  totalLines: number;
}

type ViewType = 'contributors' | 'frequency' | 'treemap';

interface StoreState {
  // Data
  contributors: ContributorStats[];
  codeFrequency: CodeFrequency[];
  treemapData: TreemapNode | null;
  repoInfo: RepoInfo | null;

  // UI State
  activeView: ViewType;
  isLoading: boolean;
  error: string | null;

  // Treemap navigation
  treemapPath: string[];

  // Filters
  timePeriod: 'all' | 'lastYear' | 'last6Months' | 'last3Months' | 'lastMonth';
  frequencyGranularity: 'weekly' | 'monthly';
  treemapColorMode: 'language' | 'age';

  // Actions
  setContributors: (data: ContributorStats[]) => void;
  setCodeFrequency: (data: CodeFrequency[]) => void;
  setTreemapData: (data: TreemapNode) => void;
  setRepoInfo: (info: RepoInfo) => void;
  setActiveView: (view: ViewType) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setTreemapPath: (path: string[]) => void;
  setTimePeriod: (period: StoreState['timePeriod']) => void;
  setFrequencyGranularity: (granularity: StoreState['frequencyGranularity']) => void;
  setTreemapColorMode: (mode: StoreState['treemapColorMode']) => void;
}

export const useStore = create<StoreState>((set) => ({
  // Initial data state
  contributors: [],
  codeFrequency: [],
  treemapData: null,
  repoInfo: null,

  // Initial UI state
  activeView: 'contributors',
  isLoading: true,
  error: null,

  // Treemap navigation
  treemapPath: [],

  // Filters
  timePeriod: 'all',
  frequencyGranularity: 'weekly',
  treemapColorMode: 'language',

  // Actions
  setContributors: (data) => set({ contributors: data }),
  setCodeFrequency: (data) => set({ codeFrequency: data }),
  setTreemapData: (data) => set({ treemapData: data }),
  setRepoInfo: (info) => set({ repoInfo: info }),
  setActiveView: (view) => set({ activeView: view }),
  setLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error }),
  setTreemapPath: (path) => set({ treemapPath: path }),
  setTimePeriod: (period) => set({ timePeriod: period }),
  setFrequencyGranularity: (granularity) => set({ frequencyGranularity: granularity }),
  setTreemapColorMode: (mode) => set({ treemapColorMode: mode }),
}));
