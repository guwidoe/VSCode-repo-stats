import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { AnalysisResult, ExtensionSettings } from './types';

const requestRefresh = vi.fn();
const cancelAnalysis = vi.fn();
const updateRepositorySelection = vi.fn();

type MockAppState = {
  activeView: 'overview' | 'files' | 'contributors' | 'commits' | 'frequency' | 'evolution' | 'treemap' | 'settings' | 'about';
  loading: { isLoading: boolean; phase: string; progress: number };
  error: string | null;
  data: AnalysisResult | null;
  settings: ExtensionSettings | null;
  coreStale: boolean;
  evolutionStale: boolean;
  analysisPresentation: {
    displayedResultKind: 'none' | 'preliminary' | 'final';
    displayedResultSource: 'none' | 'lastCompletedRun' | 'activeRun';
    activeRunState: 'idle' | 'running' | 'cancelled';
  };
  availableRepositories: Array<{ path: string; name: string; source: 'workspace' | 'bookmarked'; relativePath?: string; workspaceFolderName?: string }>;
  selectedRepositoryIds: string[];
  selectedTarget: {
    id: string;
    kind: 'repository' | 'repositoryWithSubmodules' | 'workspace';
    label: string;
    memberCount: number;
    settingsScope: 'repo' | 'workspace';
    description?: string;
  } | null;
};

const { mockStoreState, useStoreMock } = vi.hoisted(() => {
  const stateRef: { current: MockAppState | null } = { current: null };
  const storeFn = vi.fn(() => stateRef.current as MockAppState);

  return {
    mockStoreState: stateRef,
    useStoreMock: storeFn,
  };
});

vi.mock('./store', () => ({
  useStore: useStoreMock,
}));

vi.mock('./hooks/useVsCodeApi', () => ({
  useVsCodeApi: () => ({
    requestRefresh,
    cancelAnalysis,
    updateRepositorySelection,
  }),
}));

vi.mock('./components/Navigation', () => ({
  Navigation: 'mock-navigation',
}));

vi.mock('./components/overview/OverviewPanel', () => ({
  OverviewPanel: 'mock-overview-panel',
}));

vi.mock('./components/files/FilesPanel', () => ({
  FilesPanel: 'mock-files-panel',
}));

vi.mock('./components/contributors/ContributorsPanel', () => ({
  ContributorsPanel: 'mock-contributors-panel',
}));

vi.mock('./components/commits/CommitsPanel', () => ({
  CommitsPanel: 'mock-commits-panel',
}));

vi.mock('./components/frequency/CodeFrequencyPanel', () => ({
  CodeFrequencyPanel: 'mock-frequency-panel',
}));

vi.mock('./components/treemap/TreemapPanel', () => ({
  TreemapPanel: 'mock-treemap-panel',
}));

vi.mock('./components/evolution/EvolutionPanel', () => ({
  EvolutionPanel: 'mock-evolution-panel',
}));

vi.mock('./components/settings/SettingsPanel', () => ({
  SettingsPanel: 'mock-settings-panel',
}));

vi.mock('./components/about/AboutPanel', () => ({
  AboutPanel: 'mock-about-panel',
}));

import { App } from './App';

function createSettings(): ExtensionSettings {
  return {
    excludePatterns: [],
    maxCommitsToAnalyze: 1000,
    defaultColorMode: 'language',
    generatedPatterns: [],
    binaryExtensions: ['.png'],
    locExcludedExtensions: [],
    showEmptyTimePeriods: true,
    defaultGranularityMode: 'auto',
    autoGranularityThreshold: 20,
    overviewDisplayMode: 'percent',
    tooltipSettings: {
      showLinesOfCode: true,
      showFileSize: true,
      showLanguage: true,
      showLastModified: true,
      showComplexity: false,
      showCommentLines: false,
      showCommentRatio: false,
      showBlankLines: false,
      showCodeDensity: false,
      showFileCount: true,
    },
    treemap: {
      ageColorRangeMode: 'auto',
      ageColorNewestDate: '',
      ageColorOldestDate: '',
    },
    evolution: {
      autoRun: false,
      samplingMode: 'time',
      snapshotIntervalDays: 7,
      showInactivePeriods: false,
      maxSnapshots: 20,
      maxSeries: 20,
      cohortFormat: '%Y',
    },
  };
}

function createAnalysisResult(): AnalysisResult {
  return {
    target: {
      id: 'workspace',
      kind: 'workspace',
      label: 'Workspace',
      memberCount: 2,
    },
    repositories: [
      {
        id: 'repo-1',
        role: 'workspaceRepo',
        logicalRoot: 'repo-1',
        pathPrefix: 'repo-1',
        name: 'Repo One',
        path: '/tmp/repo-1',
        branch: 'main',
        commitCount: 12,
        headSha: 'abc123',
      },
    ],
    contributors: [],
    codeFrequency: [],
    commitAnalytics: {
      authorDirectory: { idByEmail: {}, namesById: [], emailsById: [] },
      records: [],
      summary: {
        totalCommits: 0,
        totalAdditions: 0,
        totalDeletions: 0,
        totalChangedLines: 0,
        averageChangedLines: 0,
        medianChangedLines: 0,
        averageFilesChanged: 0,
      },
      contributorSummaries: [],
      changedLineBuckets: [],
      fileChangeBuckets: [],
      indexes: {
        byTimestampAsc: [],
        byAdditionsDesc: [],
        byDeletionsDesc: [],
        byChangedLinesDesc: [],
        byFilesChangedDesc: [],
      },
    },
    fileTree: { name: 'root', path: '', type: 'directory', children: [] },
    analyzedAt: '2026-03-25T00:00:00.000Z',
    analyzedCommitCount: 12,
    maxCommitsLimit: 1000,
    limitReached: false,
    sccInfo: { version: '1.0.0', source: 'system' },
    blameMetrics: {
      analyzedAt: '2026-03-25T00:00:00.000Z',
      maxAgeDays: 0,
      ageByDay: [],
      ownershipByAuthor: [],
      totals: {
        totalBlamedLines: 0,
        filesAnalyzed: 0,
        filesSkipped: 0,
        cacheHits: 0,
      },
    },
  };
}

describe('App', () => {
  beforeEach(() => {
    requestRefresh.mockClear();
    cancelAnalysis.mockClear();
    updateRepositorySelection.mockClear();
    useStoreMock.mockClear();
    mockStoreState.current = {
      activeView: 'overview',
      loading: { isLoading: false, phase: '', progress: 0 },
      error: null,
      data: null,
      settings: createSettings(),
      coreStale: false,
      evolutionStale: false,
      analysisPresentation: {
        displayedResultKind: 'none',
        displayedResultSource: 'none',
        activeRunState: 'idle',
      },
      availableRepositories: [],
      selectedRepositoryIds: [],
      selectedTarget: null,
    };
  });

  it('keeps the dashboard visible with a refresh status bar when prior data exists', () => {
    mockStoreState.current = {
      ...mockStoreState.current!,
      data: createAnalysisResult(),
      loading: { isLoading: true, phase: 'Refreshing workspace analysis', progress: 42 },
      analysisPresentation: {
        displayedResultKind: 'final',
        displayedResultSource: 'lastCompletedRun',
        activeRunState: 'running',
      },
    };

    const { container } = render(<App />);

    expect(container.querySelector('mock-overview-panel')).toBeTruthy();
    expect(screen.getByText('Refresh in progress')).toBeInTheDocument();
    expect(screen.getByText(/Showing the last completed results while the new refresh is still running/i)).toBeInTheDocument();
    expect(screen.queryByText(/This may take a moment for large repositories/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    fireEvent.click(screen.getByRole('button', { name: 'Restart Scan' }));

    expect(cancelAnalysis).toHaveBeenCalledTimes(1);
    expect(requestRefresh).toHaveBeenCalledTimes(1);
  });

  it('labels active-run dashboard data as preliminary when current results are partial', () => {
    mockStoreState.current = {
      ...mockStoreState.current!,
      data: createAnalysisResult(),
      loading: { isLoading: true, phase: 'Merging workspace results', progress: 75 },
      analysisPresentation: {
        displayedResultKind: 'preliminary',
        displayedResultSource: 'activeRun',
        activeRunState: 'running',
      },
    };

    render(<App />);

    expect(screen.getByText('Preliminary results')).toBeInTheDocument();
    expect(screen.getByText(/Showing partial results from the current refresh/i)).toBeInTheDocument();
  });

  it('hides the core refresh banner once the run settles', () => {
    mockStoreState.current = {
      ...mockStoreState.current!,
      data: createAnalysisResult(),
      loading: { isLoading: false, phase: '', progress: 100 },
      analysisPresentation: {
        displayedResultKind: 'final',
        displayedResultSource: 'lastCompletedRun',
        activeRunState: 'idle',
      },
    };

    const { container } = render(<App />);

    expect(container.querySelector('mock-overview-panel')).toBeTruthy();
    expect(screen.queryByText('Refresh in progress')).not.toBeInTheDocument();
    expect(screen.queryByText('Preliminary results')).not.toBeInTheDocument();
  });

  it('shows the blocking first-run loading state when no core data exists yet', () => {
    mockStoreState.current = {
      ...mockStoreState.current!,
      data: null,
      loading: { isLoading: true, phase: 'Starting analysis...', progress: 5 },
      analysisPresentation: {
        displayedResultKind: 'none',
        displayedResultSource: 'none',
        activeRunState: 'running',
      },
    };

    const { container } = render(<App />);

    expect(screen.getByText('Starting analysis...')).toBeInTheDocument();
    expect(screen.getByText(/This may take a moment for large repositories/i)).toBeInTheDocument();
    expect(container.querySelector('mock-overview-panel')).toBeNull();
    expect(screen.queryByText('Refresh in progress')).not.toBeInTheDocument();
  });
});
