import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { AnalysisResult, EvolutionResult, ExtensionSettings } from '../../types';

type MockState = {
  evolutionData: EvolutionResult | null;
  evolutionStatus: 'idle' | 'loading' | 'ready' | 'error' | 'stale';
  evolutionError: string | null;
  evolutionLoading: { isLoading: boolean; phase: string; progress: number };
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
    includeSubmodules: false,
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
    evolution: {
      autoRun: false,
      samplingMode: 'time',
      snapshotIntervalDays: 30,
      snapshotIntervalCommits: 100,
      showInactivePeriods: false,
      maxSnapshots: 80,
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
    headSha: 'abc123',
    branch: 'main',
    settingsHash: 'hash1',
    cohorts: { snapshots: [snapshot], ts: ['2026-01-01T00:00:00.000Z'], labels: ['2026'], y: [[1]] },
    authors: { snapshots: [snapshot], ts: ['2026-01-01T00:00:00.000Z'], labels: ['Alice'], y: [[1]] },
    exts: { snapshots: [snapshot], ts: ['2026-01-01T00:00:00.000Z'], labels: ['.ts'], y: [[1]] },
    dirs: { snapshots: [snapshot], ts: ['2026-01-01T00:00:00.000Z'], labels: ['src/'], y: [[1]] },
    domains: { snapshots: [snapshot], ts: ['2026-01-01T00:00:00.000Z'], labels: ['example.com'], y: [[1]] },
  };
}

describe('EvolutionPanel', () => {
  beforeEach(() => {
    mockStoreState.current = {
      evolutionData: null,
      evolutionStatus: 'idle',
      evolutionError: null,
      evolutionLoading: { isLoading: false, phase: '', progress: 0 },
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

  it('renders loading state', () => {
    mockStoreState.current!.evolutionStatus = 'loading';
    mockStoreState.current!.evolutionLoading = {
      isLoading: true,
      phase: 'Analyzing snapshot 2/10',
      progress: 20,
    };

    render(<EvolutionPanel />);

    expect(screen.getByText('Analyzing repository evolution')).toBeInTheDocument();
    expect(screen.getByText('Analyzing snapshot 2/10')).toBeInTheDocument();
  });

  it('renders stale banner when evolution data is stale', () => {
    mockStoreState.current!.evolutionStatus = 'stale';
    mockStoreState.current!.evolutionData = createEvolutionResult();
    mockStoreState.current!.data = {
      repository: {
        name: 'repo',
        path: '/tmp/repo',
        branch: 'main',
        commitCount: 10,
        headSha: 'abc123',
      },
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

    render(<EvolutionPanel />);

    expect(screen.getByText(/Evolution data is stale/i)).toBeInTheDocument();
  });

  it('explains non-linear snapshot timelines when using auto sampling', () => {
    mockStoreState.current!.evolutionStatus = 'ready';
    mockStoreState.current!.evolutionData = createEvolutionResult();
    mockStoreState.current!.settings = createSettings();

    render(<EvolutionPanel />);

    expect(screen.getByText(/Sampling: Auto-distributed/i)).toBeInTheDocument();
    expect(screen.getByText(/spacing is intentionally non-linear in time/i)).toBeInTheDocument();
  });
});
