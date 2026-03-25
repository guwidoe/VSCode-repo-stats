import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { AnalysisResult, EvolutionResult, ExtensionSettings } from '../../types';

type MockState = {
  evolutionData: EvolutionResult | null;
  evolutionStatus: 'idle' | 'loading' | 'ready' | 'error' | 'stale';
  evolutionError: string | null;
  evolutionLoading: { isLoading: boolean; phase: string; progress: number };
  evolutionPresentation: {
    displayedResultKind: 'none' | 'preliminary' | 'final';
    displayedResultSource: 'none' | 'lastCompletedRun' | 'activeRun';
    activeRunState: 'idle' | 'running' | 'cancelled';
  };
  settings: ExtensionSettings | null;
  data: AnalysisResult | null;
};

const { mockStoreState, useStoreMock } = vi.hoisted(() => {
  const stateRef: { current: MockState | null } = { current: null };
  const storeFn = vi.fn((selector?: (state: MockState) => unknown) => {
    const current = stateRef.current as MockState;
    if (selector) {
      return selector(current);
    }
    return current;
  });

  return {
    mockStoreState: stateRef,
    useStoreMock: storeFn,
  };
});

vi.mock('../../store', () => ({
  useStore: useStoreMock,
}));

vi.mock('../../hooks/useVsCodeApi', () => ({
  useVsCodeApi: () => ({
    requestEvolutionAnalysis: vi.fn(),
    requestEvolutionRefresh: vi.fn(),
    cancelEvolutionAnalysis: vi.fn(),
  }),
}));

vi.mock('./EvolutionControls', () => ({
  EvolutionControls: vi.fn(() => null),
}));

vi.mock('./EvolutionStackChart', () => ({
  EvolutionStackChart: vi.fn(() => null),
}));

vi.mock('./EvolutionLineChart', () => ({
  EvolutionLineChart: vi.fn(() => null),
}));

vi.mock('./EvolutionDistributionChart', () => ({
  EvolutionDistributionChart: vi.fn(() => null),
}));

import { EvolutionPanel } from './EvolutionPanel';

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
      snapshotIntervalDays: 30,
      showInactivePeriods: false,
      maxSnapshots: 20,
      maxSeries: 20,
      cohortFormat: '%Y',
    },
  };
}

function createEvolutionResult(): EvolutionResult {
  const snapshot = {
    commitSha: 'abc123abc123abc123abc123abc123abc123abcd',
    commitIndex: 4,
    totalCommitCount: 20,
    committedAt: '2026-01-01T00:00:00.000Z',
    samplingMode: 'auto' as const,
  };

  return {
    generatedAt: '2026-03-05T00:00:00.000Z',
    targetId: 'workspace',
    historyMode: 'mergedMembers',
    revisionHash: 'rev-1',
    settingsHash: 'hash1',
    memberHeads: [
      {
        repositoryId: 'repo-1',
        repositoryName: 'repo',
        branch: 'main',
        headSha: 'abc123',
      },
    ],
    cohorts: {
      snapshots: [snapshot],
      timestamps: ['2026-01-01T00:00:00.000Z'],
      labels: ['2026'],
      seriesValues: [[1]],
      ts: ['2026-01-01T00:00:00.000Z'],
      y: [[1]],
    },
    authors: {
      snapshots: [snapshot],
      timestamps: ['2026-01-01T00:00:00.000Z'],
      labels: ['Alice'],
      seriesValues: [[1]],
      ts: ['2026-01-01T00:00:00.000Z'],
      y: [[1]],
    },
    extensions: {
      snapshots: [snapshot],
      timestamps: ['2026-01-01T00:00:00.000Z'],
      labels: ['.ts'],
      seriesValues: [[1]],
      ts: ['2026-01-01T00:00:00.000Z'],
      y: [[1]],
    },
    directories: {
      snapshots: [snapshot],
      timestamps: ['2026-01-01T00:00:00.000Z'],
      labels: ['src/'],
      seriesValues: [[1]],
      ts: ['2026-01-01T00:00:00.000Z'],
      y: [[1]],
    },
    exts: {
      snapshots: [snapshot],
      timestamps: ['2026-01-01T00:00:00.000Z'],
      labels: ['.ts'],
      seriesValues: [[1]],
      ts: ['2026-01-01T00:00:00.000Z'],
      y: [[1]],
    },
    dirs: {
      snapshots: [snapshot],
      timestamps: ['2026-01-01T00:00:00.000Z'],
      labels: ['src/'],
      seriesValues: [[1]],
      ts: ['2026-01-01T00:00:00.000Z'],
      y: [[1]],
    },
    domains: {
      snapshots: [snapshot],
      timestamps: ['2026-01-01T00:00:00.000Z'],
      labels: ['example.com'],
      seriesValues: [[1]],
      ts: ['2026-01-01T00:00:00.000Z'],
      y: [[1]],
    },
  };
}

function createAnalysisResult(): AnalysisResult {
  return {
    target: {
      id: 'workspace',
      kind: 'workspace',
      label: 'Workspace',
      memberCount: 1,
    },
    repositories: [
      {
        id: 'repo-1',
        role: 'workspaceRepo',
        logicalRoot: 'repo',
        pathPrefix: 'repo',
        name: 'repo',
        path: '/tmp/repo',
        branch: 'main',
        commitCount: 10,
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
      indexes: { byTimestampAsc: [], byAdditionsDesc: [], byDeletionsDesc: [], byChangedLinesDesc: [], byFilesChangedDesc: [] },
    },
    fileTree: {
      name: 'repo',
      path: '',
      type: 'directory',
      children: [],
    },
    analyzedAt: '2026-03-05T00:00:00.000Z',
    analyzedCommitCount: 10,
    maxCommitsLimit: 1000,
    limitReached: false,
    sccInfo: { version: '1.0.0', source: 'system' },
    blameMetrics: {
      analyzedAt: '2026-03-05T00:00:00.000Z',
      maxAgeDays: 14,
      ageByDay: [10, 5],
      ownershipByAuthor: [],
      totals: { totalBlamedLines: 15, filesAnalyzed: 1, filesSkipped: 0, cacheHits: 0 },
    },
  };
}

describe('EvolutionPanel', () => {
  beforeEach(() => {
    mockStoreState.current = {
      evolutionData: null,
      evolutionStatus: 'idle',
      evolutionError: null,
      evolutionLoading: { isLoading: false, phase: '', progress: 0 },
      evolutionPresentation: {
        displayedResultKind: 'none',
        displayedResultSource: 'none',
        activeRunState: 'idle',
      },
      settings: createSettings(),
      data: null,
    };

    useStoreMock.mockClear();
  });

  it('renders idle CTA state', () => {
    render(<EvolutionPanel />);

    expect(screen.getByText('Evolution analysis is on-demand')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Run Evolution Analysis' })).toBeInTheDocument();
  });

  it('renders loading state with stage, repository, snapshot, and eta details', () => {
    mockStoreState.current!.evolutionStatus = 'loading';
    mockStoreState.current!.evolutionLoading = {
      isLoading: true,
      phase: 'Analyzing snapshots for repo-a',
      progress: 20,
      stage: 'analyzing',
      currentRepositoryLabel: 'repo-a',
      currentRepositoryIndex: 2,
      totalRepositories: 5,
      currentSnapshotIndex: 11,
      totalSnapshots: 42,
      etaSeconds: 95,
    };

    render(<EvolutionPanel />);

    expect(screen.getByText('Analyzing repository evolution')).toBeInTheDocument();
    expect(screen.getByText('Analyzing snapshots for repo-a')).toBeInTheDocument();
    expect(screen.getByText('Analyzing snapshots')).toBeInTheDocument();
    expect(screen.getByText('2 / 5 — repo-a')).toBeInTheDocument();
    expect(screen.getByText('11 / 42')).toBeInTheDocument();
    expect(screen.getByText('~1m 35s remaining')).toBeInTheDocument();
  });

  it('keeps charts visible during recompute when prior evolution data exists', () => {
    mockStoreState.current!.evolutionStatus = 'loading';
    mockStoreState.current!.evolutionData = createEvolutionResult();
    mockStoreState.current!.evolutionPresentation = {
      displayedResultKind: 'final',
      displayedResultSource: 'lastCompletedRun',
      activeRunState: 'running',
    };
    mockStoreState.current!.evolutionLoading = {
      isLoading: true,
      phase: 'Recomputing evolution for repo-a',
      progress: 20,
      stage: 'analyzing',
      currentRepositoryLabel: 'repo-a',
      currentRepositoryIndex: 2,
      totalRepositories: 5,
      currentSnapshotIndex: 11,
      totalSnapshots: 42,
      etaSeconds: 95,
    };
    mockStoreState.current!.data = createAnalysisResult();

    render(<EvolutionPanel />);

    expect(screen.getByText('Recompute in progress')).toBeInTheDocument();
    expect(screen.getByText(/Showing the last completed evolution charts/i)).toBeInTheDocument();
    expect(screen.getByText('Stacked Ownership Over Time')).toBeInTheDocument();
    expect(screen.queryByText('Analyzing repository evolution')).not.toBeInTheDocument();
  });

  it('renders stale banner when evolution data is stale', () => {
    mockStoreState.current!.evolutionStatus = 'stale';
    mockStoreState.current!.evolutionData = createEvolutionResult();
    mockStoreState.current!.data = createAnalysisResult();

    render(<EvolutionPanel />);

    expect(screen.getByText(/Evolution data is stale/i)).toBeInTheDocument();
  });

  it('explains non-linear snapshot timelines when using auto sampling', () => {
    mockStoreState.current!.evolutionStatus = 'ready';
    mockStoreState.current!.evolutionData = createEvolutionResult();
    mockStoreState.current!.settings = createSettings();

    render(<EvolutionPanel />);

    expect(screen.getByText(/Sampling: Auto-distributed/i)).toBeInTheDocument();
    expect(screen.getByText(/X-axis: Calendar time/i)).toBeInTheDocument();
    expect(screen.getByText(/spacing is intentionally non-linear/i)).toBeInTheDocument();
  });
});
