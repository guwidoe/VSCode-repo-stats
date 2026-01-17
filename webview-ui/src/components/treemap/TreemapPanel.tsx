/**
 * Treemap Panel - D3-based treemap visualization with canvas rendering.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { hierarchy, treemap, treemapSquarify, HierarchyRectangularNode } from 'd3-hierarchy';
import { useStore } from '../../store';
import { useVsCodeApi } from '../../hooks/useVsCodeApi';
import { getLanguageColor, getAgeColor, formatNumber, formatRelativeTime } from '../../utils/colors';
import type { TreemapNode, ColorMode } from '../../types';
import './TreemapPanel.css';

interface TooltipData {
  x: number;
  y: number;
  node: TreemapNode;
}

export function TreemapPanel() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { currentTreemapNode, treemapPath, navigateToTreemapPath, colorMode, setColorMode } = useStore();
  const { openFile, revealInExplorer, copyPath } = useVsCodeApi();

  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [tooltip, setTooltip] = useState<TooltipData | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; node: TreemapNode } | null>(null);
  const [nodes, setNodes] = useState<HierarchyRectangularNode<TreemapNode>[]>([]);

  // Update dimensions on resize
  useEffect(() => {
    const container = containerRef.current;
    if (!container) {return;}

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        setDimensions({
          width: entry.contentRect.width,
          height: Math.max(400, entry.contentRect.height),
        });
      }
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // Build treemap layout
  useEffect(() => {
    if (!currentTreemapNode) {return;}

    const root = hierarchy<TreemapNode>(currentTreemapNode)
      .sum((d) => (d.type === 'file' ? d.lines || 0 : 0))
      .sort((a, b) => (b.value || 0) - (a.value || 0));

    const treemapLayout = treemap<TreemapNode>()
      .size([dimensions.width, dimensions.height])
      .padding(2)
      .tile(treemapSquarify);

    const layoutRoot = treemapLayout(root);

    // Get leaf nodes and directories with children
    const layoutNodes = layoutRoot.descendants().filter((d) => {
      // Show files (leaves) and directories at depth 1
      if (d.depth === 0) {return false;}
      if (d.data.type === 'file') {return true;}
      if (d.depth === 1 && d.children) {return true;}
      return false;
    });

    setNodes(layoutNodes);
  }, [currentTreemapNode, dimensions]);

  // Render treemap to canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {return;}

    const ctx = canvas.getContext('2d');
    if (!ctx) {return;}

    // Set canvas size for high DPI
    const dpr = window.devicePixelRatio || 1;
    canvas.width = dimensions.width * dpr;
    canvas.height = dimensions.height * dpr;
    ctx.scale(dpr, dpr);

    // Clear canvas
    ctx.clearRect(0, 0, dimensions.width, dimensions.height);

    // Draw nodes
    for (const node of nodes) {
      const x = node.x0;
      const y = node.y0;
      const width = node.x1 - node.x0;
      const height = node.y1 - node.y0;

      if (width < 1 || height < 1) {continue;}

      // Get color based on mode
      const color = colorMode === 'language'
        ? getLanguageColor(node.data.language || 'Unknown')
        : getAgeColor(node.data.lastModified);

      // Draw rectangle
      ctx.fillStyle = color;
      ctx.fillRect(x, y, width, height);

      // Draw border
      ctx.strokeStyle = 'var(--vscode-editor-background)';
      ctx.lineWidth = 1;
      ctx.strokeRect(x, y, width, height);

      // Draw label if there's enough space
      if (width > 40 && height > 20) {
        const label = node.data.name;
        ctx.fillStyle = getContrastColor(color);
        ctx.font = '11px var(--vscode-font-family)';
        ctx.textBaseline = 'middle';

        const maxWidth = width - 8;
        const truncatedLabel = truncateText(ctx, label, maxWidth);
        ctx.fillText(truncatedLabel, x + 4, y + height / 2);
      }
    }
  }, [nodes, colorMode, dimensions]);

  // Handle mouse move for tooltip
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) {return;}

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Find node under cursor
    const node = nodes.find((n) =>
      x >= n.x0 && x <= n.x1 && y >= n.y0 && y <= n.y1
    );

    if (node) {
      setTooltip({ x: e.clientX, y: e.clientY, node: node.data });
    } else {
      setTooltip(null);
    }
  }, [nodes]);

  // Handle click
  const handleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) {return;}

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const node = nodes.find((n) =>
      x >= n.x0 && x <= n.x1 && y >= n.y0 && y <= n.y1
    );

    if (node) {
      if (node.data.type === 'file') {
        openFile(node.data.path);
      } else {
        // Navigate into directory
        const newPath = [...treemapPath, node.data.name];
        navigateToTreemapPath(newPath);
      }
    }

    setContextMenu(null);
  }, [nodes, openFile, treemapPath, navigateToTreemapPath]);

  // Handle right click
  const handleContextMenu = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    e.preventDefault();

    const canvas = canvasRef.current;
    if (!canvas) {return;}

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const node = nodes.find((n) =>
      x >= n.x0 && x <= n.x1 && y >= n.y0 && y <= n.y1
    );

    if (node) {
      setContextMenu({ x: e.clientX, y: e.clientY, node: node.data });
    }
  }, [nodes]);

  // Close context menu on click outside
  useEffect(() => {
    const handleClickOutside = () => setContextMenu(null);
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, []);

  if (!currentTreemapNode) {
    return (
      <div className="treemap-panel">
        <div className="empty-state">
          <p>No file tree data available.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="treemap-panel">
      <div className="panel-header">
        <h2>Repository Treemap</h2>
        <ColorModeToggle value={colorMode} onChange={setColorMode} />
      </div>

      <Breadcrumb path={treemapPath} onNavigate={navigateToTreemapPath} />

      <div className="treemap-container" ref={containerRef}>
        <canvas
          ref={canvasRef}
          style={{ width: dimensions.width, height: dimensions.height }}
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setTooltip(null)}
          onClick={handleClick}
          onContextMenu={handleContextMenu}
        />

        {tooltip && (
          <Tooltip x={tooltip.x} y={tooltip.y} node={tooltip.node} />
        )}

        {contextMenu && (
          <ContextMenu
            x={contextMenu.x}
            y={contextMenu.y}
            node={contextMenu.node}
            onOpenFile={() => { openFile(contextMenu.node.path); setContextMenu(null); }}
            onRevealInExplorer={() => { revealInExplorer(contextMenu.node.path); setContextMenu(null); }}
            onCopyPath={() => { copyPath(contextMenu.node.path); setContextMenu(null); }}
          />
        )}
      </div>

      <div className="legend">
        {colorMode === 'language' ? <LanguageLegend nodes={nodes} /> : <AgeLegend />}
      </div>
    </div>
  );
}

// ============================================================================
// Color Mode Toggle
// ============================================================================

interface ColorModeToggleProps {
  value: ColorMode;
  onChange: (mode: ColorMode) => void;
}

function ColorModeToggle({ value, onChange }: ColorModeToggleProps) {
  return (
    <div className="color-mode-toggle">
      <button
        className={`toggle-button ${value === 'language' ? 'active' : ''}`}
        onClick={() => onChange('language')}
      >
        By Language
      </button>
      <button
        className={`toggle-button ${value === 'age' ? 'active' : ''}`}
        onClick={() => onChange('age')}
      >
        By Age
      </button>
    </div>
  );
}

// ============================================================================
// Breadcrumb
// ============================================================================

interface BreadcrumbProps {
  path: string[];
  onNavigate: (path: string[]) => void;
}

function Breadcrumb({ path, onNavigate }: BreadcrumbProps) {
  return (
    <div className="breadcrumb">
      <button className="breadcrumb-item" onClick={() => onNavigate([])}>
        root
      </button>
      {path.map((segment, index) => (
        <span key={index}>
          <span className="breadcrumb-separator">/</span>
          <button
            className="breadcrumb-item"
            onClick={() => onNavigate(path.slice(0, index + 1))}
          >
            {segment}
          </button>
        </span>
      ))}
    </div>
  );
}

// ============================================================================
// Tooltip
// ============================================================================

interface TooltipProps {
  x: number;
  y: number;
  node: TreemapNode;
}

function Tooltip({ x, y, node }: TooltipProps) {
  return (
    <div
      className="treemap-tooltip"
      style={{
        left: x + 10,
        top: y + 10,
      }}
    >
      <div className="tooltip-name">{node.name}</div>
      <div className="tooltip-path">{node.path}</div>
      <div className="tooltip-info">
        <span>{formatNumber(node.lines || 0)} lines</span>
        {node.language && <span>{node.language}</span>}
        {node.lastModified && (
          <span>{formatRelativeTime(node.lastModified)}</span>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Context Menu
// ============================================================================

interface ContextMenuProps {
  x: number;
  y: number;
  node: TreemapNode;
  onOpenFile: () => void;
  onRevealInExplorer: () => void;
  onCopyPath: () => void;
}

function ContextMenu({ x, y, onOpenFile, onRevealInExplorer, onCopyPath }: ContextMenuProps) {
  return (
    <div
      className="context-menu"
      style={{ left: x, top: y }}
      onClick={(e) => e.stopPropagation()}
    >
      <button onClick={onOpenFile}>Open File</button>
      <button onClick={onRevealInExplorer}>Reveal in Explorer</button>
      <button onClick={onCopyPath}>Copy Path</button>
    </div>
  );
}

// ============================================================================
// Legends
// ============================================================================

function LanguageLegend({ nodes }: { nodes: HierarchyRectangularNode<TreemapNode>[] }) {
  // Get unique languages with their line counts
  const languageCounts = new Map<string, number>();
  for (const node of nodes) {
    if (node.data.type === 'file' && node.data.language) {
      languageCounts.set(
        node.data.language,
        (languageCounts.get(node.data.language) || 0) + (node.data.lines || 0)
      );
    }
  }

  const sorted = Array.from(languageCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);

  return (
    <div className="language-legend">
      {sorted.map(([language, lines]) => (
        <div key={language} className="legend-item">
          <span
            className="legend-color"
            style={{ backgroundColor: getLanguageColor(language) }}
          />
          <span className="legend-label">{language}</span>
          <span className="legend-value">{formatNumber(lines)}</span>
        </div>
      ))}
    </div>
  );
}

function AgeLegend() {
  const ageRanges = [
    { label: '< 1 month', color: '#4caf50' },
    { label: '1-3 months', color: '#8bc34a' },
    { label: '3-6 months', color: '#ffeb3b' },
    { label: '6-12 months', color: '#ff9800' },
    { label: '> 1 year', color: '#f44336' },
  ];

  return (
    <div className="age-legend">
      {ageRanges.map((range) => (
        <div key={range.label} className="legend-item">
          <span className="legend-color" style={{ backgroundColor: range.color }} />
          <span className="legend-label">{range.label}</span>
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// Utility Functions
// ============================================================================

function truncateText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  const ellipsis = '...';
  let width = ctx.measureText(text).width;

  if (width <= maxWidth) {return text;}

  let truncated = text;
  while (width > maxWidth && truncated.length > 0) {
    truncated = truncated.slice(0, -1);
    width = ctx.measureText(truncated + ellipsis).width;
  }

  return truncated + ellipsis;
}

function getContrastColor(hexColor: string): string {
  // Convert hex to RGB
  const hex = hexColor.replace('#', '');
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);

  // Calculate luminance
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

  return luminance > 0.5 ? '#000000' : '#ffffff';
}
