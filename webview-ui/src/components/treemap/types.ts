// webview-ui/src/components/treemap/types.ts
import type { TreemapNode } from '../../types';

export interface TreemapConfig {
  maxNestingDepth: number      // Default: 3
  labelMinWidth: number        // Default: 80px
  labelHeight: number          // Default: 18px
}

export const DEFAULT_TREEMAP_CONFIG: TreemapConfig = {
  maxNestingDepth: 3,
  labelMinWidth: 80,
  labelHeight: 18,
};

export type SizeDisplayMode = 'loc' | 'bytes' | 'files';

export interface LayoutNode {
  data: TreemapNode
  x0: number
  y0: number
  x1: number
  y1: number
  depth: number
  children?: LayoutNode[]
  parent?: LayoutNode
  hasLabelStrip: boolean
  isLeaf: boolean
}

export interface TooltipState {
  visible: boolean
  x: number
  y: number
  node: TreemapNode | null
}

export interface ContextMenuState {
  visible: boolean
  x: number
  y: number
  node: TreemapNode | null
}

export interface TreemapDimensions {
  width: number
  height: number
  devicePixelRatio: number
}
