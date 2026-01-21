// webview-ui/src/components/treemap/utils/layout.ts
import type { TreemapNode } from '../../../types'

/**
 * Collect language counts from a treemap node.
 * Returns a Map of language -> total lines of code.
 */
export function collectLanguageCounts(node: TreemapNode): Map<string, number> {
  const counts = new Map<string, number>()

  function traverse(n: TreemapNode) {
    if (n.type === 'file' && n.language) {
      counts.set(n.language, (counts.get(n.language) || 0) + (n.lines || 0))
    }
    if (n.children) {
      n.children.forEach(traverse)
    }
  }

  traverse(node)
  return counts
}
