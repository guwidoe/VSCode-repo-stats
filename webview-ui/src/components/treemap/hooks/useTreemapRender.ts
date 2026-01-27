// webview-ui/src/components/treemap/hooks/useTreemapRender.ts
import { useCallback } from 'react';
import type { TreemapNode, ColorMode } from '../../../types';
import type { LayoutNode, SizeDisplayMode } from '../types';
import { drawVignetteTile, type Bounds } from '../utils/vignette';
import {
  getContrastColor,
  DIRECTORY_COLOR,
  HOVER_OVERLAY_COLOR,
  SELECTION_BORDER_COLOR,
  HOVER_BORDER_COLOR,
} from '../utils/colors';
import {
  getLanguageColor,
  getAgeColor,
  getComplexityColor,
  getCodeDensityColor,
  formatNumber,
  formatBytes,
} from '../../../utils/colors';

interface RenderOptions {
  colorMode: ColorMode
  sizeMode: SizeDisplayMode
  hoveredNode: TreemapNode | null
  selectedNode: TreemapNode | null
  devicePixelRatio: number
}

const LABEL_HEIGHT = 18;
const MIN_LABEL_WIDTH = 60;
const MIN_LABEL_HEIGHT = 20;

function getNodeColor(node: TreemapNode, colorMode: ColorMode): string {
  if (node.type === 'directory') {
    return DIRECTORY_COLOR;
  }

  switch (colorMode) {
    case 'age':
      return getAgeColor(node.lastModified);
    case 'complexity':
      return getComplexityColor(node.complexity);
    case 'density':
      return getCodeDensityColor(
        node.lines || 0,
        node.commentLines || 0,
        node.blankLines || 0
      );
    case 'language':
    default:
      return getLanguageColor(node.language || 'Unknown');
  }
}

function truncateText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string {
  const ellipsis = '...';
  let width = ctx.measureText(text).width;
  if (width <= maxWidth) {
    return text;
  }

  let truncated = text;
  while (width > maxWidth && truncated.length > 0) {
    truncated = truncated.slice(0, -1);
    width = ctx.measureText(truncated + ellipsis).width;
  }
  return truncated + ellipsis;
}

function countFiles(node: TreemapNode): number {
  if (node.type === 'file') {
    return 1;
  }
  return (node.children || []).reduce((sum, child) => sum + countFiles(child), 0);
}

export function useTreemapRender() {
  const render = useCallback(
    (
      canvas: HTMLCanvasElement,
      allNodes: LayoutNode[],
      options: RenderOptions
    ) => {
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        return;
      }

      const { colorMode, sizeMode, hoveredNode, selectedNode, devicePixelRatio } =
        options;
      const dpr = devicePixelRatio;

      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.save();
      ctx.scale(dpr, dpr);

      // Sort nodes by depth (back to front)
      const sortedNodes = [...allNodes].sort((a, b) => a.depth - b.depth);

      // Pass 1: Draw all tiles with vignette (center offset toward parent)
      for (const node of sortedNodes) {
        const color = getNodeColor(node.data, colorMode);
        // Get parent bounds for WizTree-style vignette center offset
        let parentBounds: Bounds | undefined;
        if (node.parent) {
          parentBounds = {
            x0: node.parent.x0,
            y0: node.parent.y0,
            x1: node.parent.x1,
            y1: node.parent.y1,
          };
        }
        drawVignetteTile(ctx, node.x0, node.y0, node.x1, node.y1, color, parentBounds);
      }

      // Pass 2: Draw labels
      ctx.font = '11px var(--vscode-font-family, sans-serif)';
      ctx.textBaseline = 'middle';

      for (const node of sortedNodes) {
        const width = node.x1 - node.x0;
        const height = node.y1 - node.y0;

        // Directory label (in label strip)
        if (!node.isLeaf && node.hasLabelStrip && width >= MIN_LABEL_WIDTH) {
          const color = getNodeColor(node.data, colorMode);
          ctx.fillStyle = getContrastColor(color);

          const lines = node.data.lines || 0;
          const bytes = node.data.bytes || 0;
          const complexity = node.data.complexity || 0;
          let sizeText: string;
          if (sizeMode === 'loc') {
            sizeText = `(${formatNumber(lines)})`;
          } else if (sizeMode === 'bytes') {
            sizeText = `(${formatBytes(bytes)})`;
          } else if (sizeMode === 'complexity') {
            sizeText = `(${formatNumber(complexity)} cx)`;
          } else {
            sizeText = `(${formatNumber(countFiles(node.data))} files)`;
          }
          const label = `${node.data.name}/ ${sizeText}`;
          const truncated = truncateText(ctx, label, width - 8);

          ctx.fillText(truncated, node.x0 + 4, node.y0 + LABEL_HEIGHT / 2);
        }

        // File label (centered if space permits)
        if (
          node.isLeaf &&
          width >= MIN_LABEL_WIDTH &&
          height >= MIN_LABEL_HEIGHT
        ) {
          const color = getNodeColor(node.data, colorMode);
          ctx.fillStyle = getContrastColor(color);

          const truncated = truncateText(ctx, node.data.name, width - 8);
          const textY = node.y0 + height / 2;
          ctx.fillText(truncated, node.x0 + 4, textY);
        }
      }

      // Pass 3: Draw hover highlight
      if (hoveredNode) {
        const hovered = allNodes.find((n) => n.data.path === hoveredNode.path);
        if (hovered) {
          // Brightness overlay
          ctx.fillStyle = HOVER_OVERLAY_COLOR;
          ctx.fillRect(
            hovered.x0,
            hovered.y0,
            hovered.x1 - hovered.x0,
            hovered.y1 - hovered.y0
          );

          // Border
          ctx.strokeStyle = HOVER_BORDER_COLOR;
          ctx.lineWidth = 2;
          ctx.strokeRect(
            hovered.x0 + 1,
            hovered.y0 + 1,
            hovered.x1 - hovered.x0 - 2,
            hovered.y1 - hovered.y0 - 2
          );
        }
      }

      // Pass 4: Draw selection
      if (selectedNode) {
        const selected = allNodes.find((n) => n.data.path === selectedNode.path);
        if (selected) {
          ctx.strokeStyle = SELECTION_BORDER_COLOR;
          ctx.lineWidth = 2;
          ctx.strokeRect(
            selected.x0 + 1,
            selected.y0 + 1,
            selected.x1 - selected.x0 - 2,
            selected.y1 - selected.y0 - 2
          );
        }
      }

      ctx.restore();
    },
    []
  );

  return { render };
}
