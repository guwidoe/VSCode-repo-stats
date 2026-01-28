// webview-ui/src/components/treemap/TreemapTooltip.tsx
import { useRef, useLayoutEffect, useState } from 'react';
import type { TreemapNode, TooltipSettings, ColorMode } from '../../types';
import type { SizeDisplayMode } from './types';
import { useStore } from '../../store';
import { formatNumber, formatRelativeTime } from '../../utils/colors';
import './TreemapTooltip.css';

interface TreemapTooltipProps {
  visible: boolean;
  x: number;
  y: number;
  node: TreemapNode | null;
  sizeMode: SizeDisplayMode;
  colorMode: ColorMode;
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

// Default tooltip settings if not loaded yet
const DEFAULT_TOOLTIP_SETTINGS: TooltipSettings = {
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
};

const TOOLTIP_OFFSET = 15;
const VIEWPORT_PADDING = 8;

export function TreemapTooltip({ visible, x, y, node, sizeMode, colorMode }: TreemapTooltipProps) {
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ left: 0, top: 0 });
  const settings = useStore((state) => state.settings);
  const tooltipSettings = settings?.tooltipSettings ?? DEFAULT_TOOLTIP_SETTINGS;

  // Always show metrics relevant to current color/size mode
  const needsComplexity = colorMode === 'complexity' || sizeMode === 'complexity';
  const needsDensity = colorMode === 'density';
  const needsAge = colorMode === 'age';

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
  const isDirectory = node.type === 'directory';
  const lines = node.lines || 0;
  const bytes = node.bytes || 0;
  const fileCount = node.fileCount ?? countFiles(node);

  // Compute derived metrics
  const totalLines = lines + (node.commentLines || 0) + (node.blankLines || 0);
  const commentRatio = totalLines > 0 ? ((node.commentLines || 0) / totalLines) * 100 : 0;
  const codeDensity = totalLines > 0 ? (lines / totalLines) * 100 : 0;

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

      {/* Language */}
      {tooltipSettings.showLanguage && isFile && node.language && (
        <div className="tooltip-language">{node.language}</div>
      )}

      {/* Size info */}
      <div className="tooltip-size">
        {getSizeDisplay()}
        {/* Show secondary info based on mode */}
        {tooltipSettings.showLinesOfCode && sizeMode !== 'loc' && lines > 0 && (
          <> &middot; {formatNumber(lines)} lines</>
        )}
        {tooltipSettings.showFileSize && sizeMode !== 'bytes' && bytes > 0 && (
          <> &middot; {formatBytes(bytes)}</>
        )}
      </div>

      {/* Extended metrics */}
      {(tooltipSettings.showComplexity || needsComplexity) && node.complexity !== undefined && (
        <div className="tooltip-metric tooltip-metric-active">
          Complexity: {formatNumber(node.complexity)}
          {isDirectory && node.complexityAvg !== undefined && (
            <span className="tooltip-metric-secondary">
              {' '}(avg: {node.complexityAvg}, max: {node.complexityMax})
            </span>
          )}
        </div>
      )}

      {tooltipSettings.showCommentLines && node.commentLines !== undefined && (
        <div className="tooltip-metric">
          Comments: {formatNumber(node.commentLines)} lines
        </div>
      )}

      {tooltipSettings.showCommentRatio && node.commentLines !== undefined && (
        <div className="tooltip-metric">
          Comment ratio: {commentRatio.toFixed(1)}%
        </div>
      )}

      {tooltipSettings.showBlankLines && node.blankLines !== undefined && (
        <div className="tooltip-metric">
          Blank lines: {formatNumber(node.blankLines)}
        </div>
      )}

      {(tooltipSettings.showCodeDensity || needsDensity) && totalLines > 0 && (
        <div className="tooltip-metric tooltip-metric-active">
          Code density: {codeDensity.toFixed(1)}%
        </div>
      )}

      {tooltipSettings.showFileCount && isDirectory && (
        <div className="tooltip-metric">
          Files: {formatNumber(fileCount)}
        </div>
      )}

      {/* Last modified */}
      {(tooltipSettings.showLastModified || needsAge) && node.lastModified && (
        <div className={`tooltip-modified ${needsAge ? 'tooltip-metric-active' : ''}`}>
          Modified: {formatRelativeTime(node.lastModified)}
        </div>
      )}
    </div>
  );
}
