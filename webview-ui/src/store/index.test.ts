/**
 * Tests for the Zustand store.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useStore } from './index';
import type { AnalysisResult } from '../types';

const mockAnalysisResult: AnalysisResult = {
  repository: {
    name: 'test-repo',
    path: '/path/to/repo',
    branch: 'main',
    commitCount: 100,
    headSha: 'abc123',
  },
  contributors: [
    {
      name: 'Test User',
      email: 'test@example.com',
      commits: 50,
      linesAdded: 1000,
      linesDeleted: 500,
      firstCommit: '2024-01-01T00:00:00Z',
      lastCommit: '2024-12-01T00:00:00Z',
      weeklyActivity: [
        { week: '2024-W01', commits: 5, additions: 100, deletions: 50 },
      ],
    },
  ],
  codeFrequency: [
    { week: '2024-W01', additions: 100, deletions: 50, netChange: 50 },
  ],
  fileTree: {
    name: 'test-repo',
    path: '',
    type: 'directory',
    lines: 1000,
    children: [
      { name: 'src', path: 'src', type: 'directory', lines: 500, children: [] },
    ],
  },
  analyzedAt: '2024-12-01T00:00:00Z',
};

describe('useStore', () => {
  beforeEach(() => {
    // Reset store state before each test
    useStore.getState().reset();
  });

  describe('initial state', () => {
    it('should have null data initially', () => {
      expect(useStore.getState().data).toBeNull();
    });

    it('should have no error initially', () => {
      expect(useStore.getState().error).toBeNull();
    });

    it('should not be loading initially', () => {
      expect(useStore.getState().loading.isLoading).toBe(false);
    });

    it('should default to contributors view', () => {
      expect(useStore.getState().activeView).toBe('contributors');
    });
  });

  describe('setData', () => {
    it('should set data and clear error', () => {
      useStore.getState().setError('Previous error');
      useStore.getState().setData(mockAnalysisResult);

      expect(useStore.getState().data).toEqual(mockAnalysisResult);
      expect(useStore.getState().error).toBeNull();
      expect(useStore.getState().loading.isLoading).toBe(false);
    });

    it('should set currentTreemapNode to fileTree', () => {
      useStore.getState().setData(mockAnalysisResult);

      expect(useStore.getState().currentTreemapNode).toEqual(mockAnalysisResult.fileTree);
    });
  });

  describe('setError', () => {
    it('should set error and stop loading', () => {
      useStore.getState().setLoading({ isLoading: true });
      useStore.getState().setError('Test error');

      expect(useStore.getState().error).toBe('Test error');
      expect(useStore.getState().loading.isLoading).toBe(false);
    });
  });

  describe('setLoading', () => {
    it('should update loading state', () => {
      useStore.getState().setLoading({
        isLoading: true,
        phase: 'Analyzing...',
        progress: 50,
      });

      expect(useStore.getState().loading).toEqual({
        isLoading: true,
        phase: 'Analyzing...',
        progress: 50,
      });
    });

    it('should merge with existing loading state', () => {
      useStore.getState().setLoading({ isLoading: true, phase: 'Phase 1', progress: 10 });
      useStore.getState().setLoading({ progress: 50 });

      expect(useStore.getState().loading.phase).toBe('Phase 1');
      expect(useStore.getState().loading.progress).toBe(50);
    });
  });

  describe('view navigation', () => {
    it('should change active view', () => {
      useStore.getState().setActiveView('frequency');
      expect(useStore.getState().activeView).toBe('frequency');

      useStore.getState().setActiveView('treemap');
      expect(useStore.getState().activeView).toBe('treemap');
    });
  });

  describe('filter settings', () => {
    it('should change time period', () => {
      useStore.getState().setTimePeriod('year');
      expect(useStore.getState().timePeriod).toBe('year');
    });

    it('should change frequency granularity', () => {
      useStore.getState().setFrequencyGranularity('monthly');
      expect(useStore.getState().frequencyGranularity).toBe('monthly');
    });

    it('should change color mode', () => {
      useStore.getState().setColorMode('age');
      expect(useStore.getState().colorMode).toBe('age');
    });
  });

  describe('treemap navigation', () => {
    it('should navigate to treemap path', () => {
      useStore.getState().setData(mockAnalysisResult);
      useStore.getState().navigateToTreemapPath(['src']);

      expect(useStore.getState().treemapPath).toEqual(['src']);
    });

    it('should do nothing when data is null', () => {
      useStore.getState().navigateToTreemapPath(['src']);
      expect(useStore.getState().treemapPath).toEqual([]);
    });
  });

  describe('reset', () => {
    it('should reset to initial state', () => {
      useStore.getState().setData(mockAnalysisResult);
      useStore.getState().setActiveView('frequency');
      useStore.getState().setTimePeriod('year');

      useStore.getState().reset();

      expect(useStore.getState().data).toBeNull();
      expect(useStore.getState().activeView).toBe('contributors');
      expect(useStore.getState().timePeriod).toBe('all');
    });
  });
});
