// webview-ui/src/components/treemap/TreemapTooltip.tsx
import { useRef, useLayoutEffect, useState } from 'react';
import type { TreemapNode } from '../../types';
import type { SizeDisplayMode } from './types';
import { formatNumber, formatRelativeTime } from '../../utils/colors';
import './TreemapTooltip.css';

interface TreemapTooltipProps {
  visible: boolean;
  x: number;
  y: number;
  node: TreemapNode | null;
  sizeMode: SizeDisplayMode;
}

function countFiles(node: TreemapNode): number {
  if (node.type === 'file') {return 1;}
  return (node.children || []).reduce((sum, child) => sum + countFiles(child), 0);
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) {return `${bytes} B`;}
  if (bytes < 1024 * 1024) {return `${(bytes / 1024).toFixed(1)} KB`;}
  if (bytes < 1024 * 1024 * 1024) {return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;}
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

const TOOLTIP_OFFSET = 15;
const VIEWPORT_PADDING = 8;

export function TreemapTooltip({ visible, x, y, node, sizeMode }: TreemapTooltipProps) {
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ left: 0, top: 0 });

  useLayoutEffect(() => {
    if (!visible || !tooltipRef.current) {return;}

    const tooltip = tooltipRef.current;
    const rect = tooltip.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let left = x + TOOLTIP_OFFSET;
    let top = y + TOOLTIP_OFFSET;

    // Flip horizontally if tooltip would overflow right edge
    if (left + rect.width > viewportWidth - VIEWPORT_PADDING) {
      left = x - rect.width - TOOLTIP_OFFSET;
    }

    // Flip vertically if tooltip would overflow bottom edge
    if (top + rect.height > viewportHeight - VIEWPORT_PADDING) {
      top = y - rect.height - TOOLTIP_OFFSET;
    }

    // Ensure tooltip doesn't go off left edge
    if (left < VIEWPORT_PADDING) {
      left = VIEWPORT_PADDING;
    }

    // Ensure tooltip doesn't go off top edge
    if (top < VIEWPORT_PADDING) {
      top = VIEWPORT_PADDING;
    }

    setPosition({ left, top });
  }, [visible, x, y, node]);

  if (!visible || !node) {return null;}

  const isFile = node.type === 'file';
  const lines = node.lines || 0;
  const bytes = node.bytes || 0;
  const fileCount = countFiles(node);

  // Determine primary size display based on mode
  const getSizeDisplay = () => {
    switch (sizeMode) {
      case 'loc':
        return `${formatNumber(lines)} lines`;
      case 'bytes':
        return formatBytes(bytes);
      case 'files':
        return `${formatNumber(fileCount)} files`;
    }
  };

  return (
    <div
      ref={tooltipRef}
      className="treemap-tooltip"
      style={{
        left: position.left,
        top: position.top,
      }}
    >
      <div className="tooltip-path">{node.path}</div>
      {isFile && node.language && (
        <div className="tooltip-language">{node.language}</div>
      )}
      <div className="tooltip-size">
        {getSizeDisplay()}
        {/* Show secondary info based on mode */}
        {sizeMode !== 'loc' && lines > 0 && <> &middot; {formatNumber(lines)} lines</>}
        {sizeMode !== 'bytes' && bytes > 0 && <> &middot; {formatBytes(bytes)}</>}
      </div>
      {node.lastModified && (
        <div className="tooltip-modified">
          Modified: {formatRelativeTime(node.lastModified)}
        </div>
      )}
    </div>
  );
}
