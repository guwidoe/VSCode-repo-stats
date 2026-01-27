// webview-ui/src/components/treemap/utils/layout.ts
import type { TreemapNode } from '../../../types';

/**
 * Calculate the maximum depth of a treemap node tree.
 * Root is depth 1, its children are depth 2, etc.
 */
export function calculateMaxDepth(node: TreemapNode): number {
  if (!node.children || node.children.length === 0) {
    return 1;
  }
  return 1 + Math.max(...node.children.map(calculateMaxDepth));
}

/**
 * Collect language counts from a treemap node.
 * Returns a Map of language -> total lines of code.
 */
export function collectLanguageCounts(node: TreemapNode): Map<string, number> {
  const counts = new Map<string, number>();

  function traverse(n: TreemapNode) {
    if (n.type === 'file' && n.language) {
      counts.set(n.language, (counts.get(n.language) || 0) + (n.lines || 0));
    }
    if (n.children) {
      n.children.forEach(traverse);
    }
  }

  traverse(node);
  return counts;
}
