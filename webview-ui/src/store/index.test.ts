/**
 * Tests for the Zustand store.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useStore, selectFilteredTreemapNode } from './index';
import type { AnalysisResult, TreemapNode } from '../types';

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
  analyzedCommitCount: 50,
  maxCommitsLimit: 10000,
  limitReached: false,
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

  describe('treemap filter', () => {
    it('should set filter preset', () => {
      useStore.getState().setTreemapFilterPreset('hide-binary');
      expect(useStore.getState().treemapFilter.preset).toBe('hide-binary');
    });

    it('should toggle language selection', () => {
      useStore.getState().toggleTreemapLanguage('TypeScript');
      expect(useStore.getState().treemapFilter.selectedLanguages.has('TypeScript')).toBe(true);

      useStore.getState().toggleTreemapLanguage('TypeScript');
      expect(useStore.getState().treemapFilter.selectedLanguages.has('TypeScript')).toBe(false);
    });
  });
});

describe('selectFilteredTreemapNode', () => {
  const treeWithMixedFiles: TreemapNode = {
    name: 'root',
    path: '',
    type: 'directory',
    lines: 1800,
    children: [
      { name: 'app.tsx', path: 'app.tsx', type: 'file', lines: 500, language: 'TypeScript' },
      { name: 'config.json', path: 'config.json', type: 'file', lines: 100, language: 'JSON' },
      { name: 'logo.png', path: 'logo.png', type: 'file', lines: 0, language: 'Unknown' },
      { name: 'README.md', path: 'README.md', type: 'file', lines: 200, language: 'Markdown' },
      {
        name: 'assets',
        path: 'assets',
        type: 'directory',
        lines: 1000,
        children: [
          { name: 'image.jpg', path: 'assets/image.jpg', type: 'file', lines: 0, language: 'Unknown' },
          { name: 'styles.css', path: 'assets/styles.css', type: 'file', lines: 700, language: 'CSS' },
          { name: 'data.yaml', path: 'assets/data.yaml', type: 'file', lines: 300, language: 'YAML' },
        ],
      },
    ],
  };

  beforeEach(() => {
    useStore.getState().reset();
  });

  it('should return null when currentTreemapNode is null', () => {
    const result = selectFilteredTreemapNode(useStore.getState());
    expect(result).toBeNull();
  });

  it('should return unfiltered node when preset is "all"', () => {
    useStore.setState({
      currentTreemapNode: treeWithMixedFiles,
      treemapFilter: { preset: 'all', selectedLanguages: new Set() },
    });

    const result = selectFilteredTreemapNode(useStore.getState());
    expect(result).toBe(treeWithMixedFiles);
  });

  it('should exclude binary files when preset is "hide-binary"', () => {
    useStore.setState({
      currentTreemapNode: treeWithMixedFiles,
      treemapFilter: { preset: 'hide-binary', selectedLanguages: new Set() },
    });

    const result = selectFilteredTreemapNode(useStore.getState());
    expect(result).not.toBeNull();

    // Check root children - logo.png should be filtered out
    const rootChildren = result!.children || [];
    expect(rootChildren.some(c => c.name === 'logo.png')).toBe(false);
    expect(rootChildren.some(c => c.name === 'app.tsx')).toBe(true);
    expect(rootChildren.some(c => c.name === 'config.json')).toBe(true);

    // Check assets children - image.jpg should be filtered out
    const assetsDir = rootChildren.find(c => c.name === 'assets');
    expect(assetsDir).toBeDefined();
    expect(assetsDir!.children?.some(c => c.name === 'image.jpg')).toBe(false);
    expect(assetsDir!.children?.some(c => c.name === 'styles.css')).toBe(true);
  });

  it('should only include code files when preset is "code-only"', () => {
    useStore.setState({
      currentTreemapNode: treeWithMixedFiles,
      treemapFilter: { preset: 'code-only', selectedLanguages: new Set() },
    });

    const result = selectFilteredTreemapNode(useStore.getState());
    expect(result).not.toBeNull();

    const rootChildren = result!.children || [];
    // JSON, Markdown, Unknown are NOT code
    expect(rootChildren.some(c => c.name === 'config.json')).toBe(false);
    expect(rootChildren.some(c => c.name === 'README.md')).toBe(false);
    expect(rootChildren.some(c => c.name === 'logo.png')).toBe(false);
    // TypeScript is code
    expect(rootChildren.some(c => c.name === 'app.tsx')).toBe(true);

    // assets dir should only have styles.css (YAML is not code)
    const assetsDir = rootChildren.find(c => c.name === 'assets');
    expect(assetsDir).toBeDefined();
    expect(assetsDir!.children?.some(c => c.name === 'styles.css')).toBe(true);
    expect(assetsDir!.children?.some(c => c.name === 'data.yaml')).toBe(false);
  });

  it('should recalculate directory line counts after filtering', () => {
    useStore.setState({
      currentTreemapNode: treeWithMixedFiles,
      treemapFilter: { preset: 'code-only', selectedLanguages: new Set() },
    });

    const result = selectFilteredTreemapNode(useStore.getState());
    // Only TypeScript (500) and CSS (700) should remain
    expect(result?.lines).toBe(1200);

    // assets dir should only count CSS (700), not YAML
    const assetsDir = result!.children?.find(c => c.name === 'assets');
    expect(assetsDir?.lines).toBe(700);
  });

  it('should prune empty directories', () => {
    const treeWithEmptyDir: TreemapNode = {
      name: 'root',
      path: '',
      type: 'directory',
      lines: 100,
      children: [
        { name: 'app.tsx', path: 'app.tsx', type: 'file', lines: 100, language: 'TypeScript' },
        {
          name: 'images',
          path: 'images',
          type: 'directory',
          lines: 0,
          children: [
            { name: 'logo.png', path: 'images/logo.png', type: 'file', lines: 0, language: 'Unknown' },
            { name: 'icon.jpg', path: 'images/icon.jpg', type: 'file', lines: 0, language: 'Unknown' },
          ],
        },
      ],
    };

    useStore.setState({
      currentTreemapNode: treeWithEmptyDir,
      treemapFilter: { preset: 'hide-binary', selectedLanguages: new Set() },
    });

    const result = selectFilteredTreemapNode(useStore.getState());
    // images dir should be pruned because all its children are binary
    expect(result!.children?.some(c => c.name === 'images')).toBe(false);
    expect(result!.children?.some(c => c.name === 'app.tsx')).toBe(true);
  });

  it('should filter by custom language selection', () => {
    useStore.setState({
      currentTreemapNode: treeWithMixedFiles,
      treemapFilter: {
        preset: 'custom',
        selectedLanguages: new Set(['TypeScript', 'CSS']),
      },
    });

    const result = selectFilteredTreemapNode(useStore.getState());
    expect(result).not.toBeNull();

    const rootChildren = result!.children || [];
    expect(rootChildren.some(c => c.name === 'app.tsx')).toBe(true);
    expect(rootChildren.some(c => c.name === 'config.json')).toBe(false);

    const assetsDir = rootChildren.find(c => c.name === 'assets');
    expect(assetsDir!.children?.some(c => c.name === 'styles.css')).toBe(true);
    expect(assetsDir!.children?.some(c => c.name === 'data.yaml')).toBe(false);
  });
});

describe('treemap new state', () => {
  beforeEach(() => {
    useStore.setState({
      sizeDisplayMode: 'loc',
      maxNestingDepth: 3,
      hoveredNode: null,
      selectedNode: null,
    });
  });

  it('should have default sizeDisplayMode of loc', () => {
    const state = useStore.getState();
    expect(state.sizeDisplayMode).toBe('loc');
  });

  it('should have default maxNestingDepth of 3', () => {
    const state = useStore.getState();
    expect(state.maxNestingDepth).toBe(3);
  });

  it('should update sizeDisplayMode', () => {
    useStore.getState().setSizeDisplayMode('files');
    expect(useStore.getState().sizeDisplayMode).toBe('files');
  });

  it('should update maxNestingDepth', () => {
    useStore.getState().setMaxNestingDepth(5);
    expect(useStore.getState().maxNestingDepth).toBe(5);
  });

  it('should track hoveredNode', () => {
    const mockNode = { name: 'test', path: 'test', type: 'file' as const, lines: 100 };
    useStore.getState().setHoveredNode(mockNode);
    expect(useStore.getState().hoveredNode).toEqual(mockNode);
  });

  it('should track selectedNode', () => {
    const mockNode = { name: 'test', path: 'test', type: 'file' as const, lines: 100 };
    useStore.getState().setSelectedNode(mockNode);
    expect(useStore.getState().selectedNode).toEqual(mockNode);
  });

  it('should clear selection', () => {
    const mockNode = { name: 'test', path: 'test', type: 'file' as const, lines: 100 };
    useStore.getState().setSelectedNode(mockNode);
    useStore.getState().clearSelection();
    expect(useStore.getState().selectedNode).toBeNull();
  });
});
