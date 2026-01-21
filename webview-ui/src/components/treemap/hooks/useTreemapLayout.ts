// webview-ui/src/components/treemap/hooks/useTreemapLayout.ts
import { useMemo, useCallback } from 'react';
import * as d3 from 'd3-hierarchy';
import type { TreemapNode } from '../../../types';
import type { TreemapConfig, LayoutNode } from '../types';

interface TreemapLayoutResult {
  layout: LayoutNode | null;
  allNodes: LayoutNode[];
  findNodeAtPoint: (x: number, y: number) => LayoutNode | null;
}

function createLayoutNode(
  d3Node: d3.HierarchyRectangularNode<TreemapNode>,
  config: TreemapConfig,
  depth: number = 0
): LayoutNode {
  const width = d3Node.x1 - d3Node.x0;
  const isLeaf = !d3Node.children || depth >= config.maxNestingDepth;
  const hasLabelStrip = !isLeaf && width >= config.labelMinWidth;

  const node: LayoutNode = {
    data: d3Node.data,
    x0: d3Node.x0,
    y0: d3Node.y0,
    x1: d3Node.x1,
    y1: d3Node.y1,
    depth,
    hasLabelStrip,
    isLeaf,
  };

  if (!isLeaf && d3Node.children) {
    // Adjust children bounds if this node has a label strip
    const childY0 = hasLabelStrip ? d3Node.y0 + config.labelHeight : d3Node.y0;
    const childHeight = d3Node.y1 - childY0;
    const childWidth = width;

    if (childHeight > 0 && childWidth > 0) {
      // Re-layout children within the adjusted bounds
      const childRoot = d3.hierarchy(d3Node.data)
        .sum(n => n.type === 'file' ? (n.lines || 1) : 0)
        .sort((a, b) => (b.value || 0) - (a.value || 0));

      const childTreemap = d3.treemap<TreemapNode>()
        .size([childWidth, childHeight])
        .paddingInner(0)
        .round(true);

      childTreemap(childRoot);

      node.children = (childRoot.children || []).map(child => {
        const childNode = createLayoutNode(
          {
            ...child,
            x0: d3Node.x0 + child.x0,
            y0: childY0 + child.y0,
            x1: d3Node.x0 + child.x1,
            y1: childY0 + child.y1,
          } as d3.HierarchyRectangularNode<TreemapNode>,
          config,
          depth + 1
        );
        childNode.parent = node;
        return childNode;
      });
    }
  }

  return node;
}

function collectAllNodes(node: LayoutNode): LayoutNode[] {
  const nodes: LayoutNode[] = [node];
  if (node.children) {
    for (const child of node.children) {
      nodes.push(...collectAllNodes(child));
    }
  }
  return nodes;
}

export function useTreemapLayout(
  root: TreemapNode | null,
  width: number,
  height: number,
  config: TreemapConfig
): TreemapLayoutResult {
  const layout = useMemo(() => {
    if (!root || width <= 0 || height <= 0) {
      return null;
    }

    const hierarchy = d3.hierarchy(root)
      .sum(n => n.type === 'file' ? (n.lines || 1) : 0)
      .sort((a, b) => (b.value || 0) - (a.value || 0));

    const treemap = d3.treemap<TreemapNode>()
      .size([width, height])
      .paddingInner(0)
      .round(true);

    const d3Layout = treemap(hierarchy);
    return createLayoutNode(d3Layout, config, 0);
  }, [root, width, height, config]);

  const allNodes = useMemo(() => {
    if (!layout) {
      return [];
    }
    return collectAllNodes(layout);
  }, [layout]);

  const findNodeAtPoint = useCallback((x: number, y: number): LayoutNode | null => {
    // Search from deepest to shallowest to find the most specific node
    const sortedByDepth = [...allNodes].sort((a, b) => b.depth - a.depth);

    for (const node of sortedByDepth) {
      if (x >= node.x0 && x < node.x1 && y >= node.y0 && y < node.y1) {
        // For non-leaf nodes, only match if in label strip area
        if (!node.isLeaf && node.hasLabelStrip) {
          const labelY1 = node.y0 + config.labelHeight;
          if (y < labelY1) {
            return node;
          }
        } else if (node.isLeaf) {
          return node;
        }
      }
    }

    return null;
  }, [allNodes, config.labelHeight]);

  return { layout, allNodes, findNodeAtPoint };
}
