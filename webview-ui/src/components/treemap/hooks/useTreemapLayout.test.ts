// webview-ui/src/components/treemap/hooks/useTreemapLayout.test.ts
import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useTreemapLayout } from './useTreemapLayout';
import type { TreemapNode } from '../../../types';

const mockTree: TreemapNode = {
  name: 'root',
  path: '',
  type: 'directory',
  lines: 1000,
  children: [
    { name: 'file1.ts', path: 'file1.ts', type: 'file', lines: 600 },
    { name: 'file2.ts', path: 'file2.ts', type: 'file', lines: 400 },
  ],
};

describe('useTreemapLayout', () => {
  it('should return null layout when node is null', () => {
    const { result } = renderHook(() =>
      useTreemapLayout(null, 500, 400, { maxNestingDepth: 3, labelMinWidth: 80, labelHeight: 18 })
    );
    expect(result.current.layout).toBeNull();
  });

  it('should return null layout when dimensions are zero', () => {
    const { result } = renderHook(() =>
      useTreemapLayout(mockTree, 0, 0, { maxNestingDepth: 3, labelMinWidth: 80, labelHeight: 18 })
    );
    expect(result.current.layout).toBeNull();
  });

  it('should calculate layout for valid tree', () => {
    const { result } = renderHook(() =>
      useTreemapLayout(mockTree, 500, 400, { maxNestingDepth: 3, labelMinWidth: 80, labelHeight: 18 })
    );
    expect(result.current.layout).not.toBeNull();
    expect(result.current.layout?.x0).toBe(0);
    expect(result.current.layout?.y0).toBe(0);
    expect(result.current.layout?.x1).toBe(500);
    expect(result.current.layout?.y1).toBe(400);
  });

  it('should provide findNodeAtPoint function', () => {
    const { result } = renderHook(() =>
      useTreemapLayout(mockTree, 500, 400, { maxNestingDepth: 3, labelMinWidth: 80, labelHeight: 18 })
    );
    expect(typeof result.current.findNodeAtPoint).toBe('function');
  });

  it('should return allNodes array', () => {
    const { result } = renderHook(() =>
      useTreemapLayout(mockTree, 500, 400, { maxNestingDepth: 3, labelMinWidth: 80, labelHeight: 18 })
    );
    expect(Array.isArray(result.current.allNodes)).toBe(true);
    expect(result.current.allNodes.length).toBeGreaterThan(0);
  });
});
