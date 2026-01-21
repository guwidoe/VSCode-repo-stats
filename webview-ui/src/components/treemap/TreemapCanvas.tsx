// webview-ui/src/components/treemap/TreemapCanvas.tsx
import { useRef, useEffect, useState, useCallback } from 'react';
import type { TreemapNode, ColorMode } from '../../types';
import type { TreemapConfig, SizeDisplayMode } from './types';
import { DEFAULT_TREEMAP_CONFIG } from './types';
import { useTreemapLayout } from './hooks/useTreemapLayout';
import { useTreemapRender } from './hooks/useTreemapRender';
import { TreemapTooltip } from './TreemapTooltip';
import { TreemapContextMenu } from './TreemapContextMenu';

interface TreemapCanvasProps {
  root: TreemapNode | null;
  colorMode: ColorMode;
  sizeMode: SizeDisplayMode;
  maxNestingDepth: number;
  hoveredNode: TreemapNode | null;
  selectedNode: TreemapNode | null;
  currentPath: string[];
  onHover: (node: TreemapNode | null) => void;
  onSelect: (node: TreemapNode | null) => void;
  onNavigate: (path: string[]) => void;
  onOpenFile: (path: string) => void;
  onRevealInExplorer: (path: string) => void;
  onCopyPath: (path: string) => void;
}

interface TooltipState {
  visible: boolean;
  x: number;
  y: number;
  node: TreemapNode | null;
}

interface ContextMenuState {
  visible: boolean;
  x: number;
  y: number;
  node: TreemapNode | null;
}

export function TreemapCanvas({
  root,
  colorMode,
  sizeMode,
  maxNestingDepth,
  hoveredNode,
  selectedNode,
  currentPath,
  onHover,
  onSelect,
  onNavigate,
  onOpenFile,
  onRevealInExplorer,
  onCopyPath,
}: TreemapCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [tooltipState, setTooltipState] = useState<TooltipState>({
    visible: false,
    x: 0,
    y: 0,
    node: null,
  });
  const [contextMenuState, setContextMenuState] = useState<ContextMenuState>({
    visible: false,
    x: 0,
    y: 0,
    node: null,
  });

  const config: TreemapConfig = {
    ...DEFAULT_TREEMAP_CONFIG,
    maxNestingDepth,
  };

  const { allNodes, findNodeAtPoint } = useTreemapLayout(
    root,
    dimensions.width,
    dimensions.height,
    config
  );
  const { render } = useTreemapRender();

  // Resize observer
  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        setDimensions({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
      }
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // Canvas setup
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || dimensions.width === 0 || dimensions.height === 0) {
      return;
    }

    const dpr = window.devicePixelRatio || 1;
    canvas.width = dimensions.width * dpr;
    canvas.height = dimensions.height * dpr;
    canvas.style.width = `${dimensions.width}px`;
    canvas.style.height = `${dimensions.height}px`;
  }, [dimensions]);

  // Render
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || allNodes.length === 0) {
      return;
    }

    render(canvas, allNodes, {
      colorMode,
      sizeMode,
      hoveredNode,
      selectedNode,
      devicePixelRatio: window.devicePixelRatio || 1,
    });
  }, [allNodes, colorMode, sizeMode, hoveredNode, selectedNode, render]);

  // Mouse move handler (throttled)
  const lastMoveTime = useRef(0);
  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      const now = performance.now();
      if (now - lastMoveTime.current < 16) {
        return;
      }
      lastMoveTime.current = now;

      const canvas = canvasRef.current;
      if (!canvas) {
        return;
      }

      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const node = findNodeAtPoint(x, y);
      onHover(node?.data || null);

      setTooltipState({
        visible: !!node,
        x: e.clientX,
        y: e.clientY,
        node: node?.data || null,
      });
    },
    [findNodeAtPoint, onHover]
  );

  const handleMouseLeave = useCallback(() => {
    onHover(null);
    setTooltipState((prev) => ({ ...prev, visible: false }));
  }, [onHover]);

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) {
        return;
      }

      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const node = findNodeAtPoint(x, y);
      onSelect(node?.data || null);
    },
    [findNodeAtPoint, onSelect]
  );

  const handleDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) {
        return;
      }

      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const node = findNodeAtPoint(x, y);
      if (!node) {
        return;
      }

      if (node.data.type === 'file') {
        onOpenFile(node.data.path);
      } else {
        const pathParts = node.data.path.split('/').filter(Boolean);
        onNavigate(pathParts);
      }
    },
    [findNodeAtPoint, onOpenFile, onNavigate]
  );

  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      const canvas = canvasRef.current;
      if (!canvas) {
        return;
      }

      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const node = findNodeAtPoint(x, y);
      if (node) {
        setContextMenuState({
          visible: true,
          x: e.clientX,
          y: e.clientY,
          node: node.data,
        });
      }
    },
    [findNodeAtPoint]
  );

  // Keyboard handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onSelect(null);
        setContextMenuState((prev) => ({ ...prev, visible: false }));
      } else if (e.key === 'Backspace' && currentPath.length > 0) {
        e.preventDefault();
        onNavigate(currentPath.slice(0, -1));
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [currentPath, onNavigate, onSelect]);

  return (
    <div ref={containerRef} className="treemap-canvas-container">
      <canvas
        ref={canvasRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        onContextMenu={handleContextMenu}
      />
      <TreemapTooltip
        visible={tooltipState.visible}
        x={tooltipState.x}
        y={tooltipState.y}
        node={tooltipState.node}
        sizeMode={sizeMode}
      />
      <TreemapContextMenu
        visible={contextMenuState.visible}
        x={contextMenuState.x}
        y={contextMenuState.y}
        node={contextMenuState.node}
        onOpenFile={onOpenFile}
        onRevealInExplorer={onRevealInExplorer}
        onCopyPath={onCopyPath}
        onClose={() => setContextMenuState((prev) => ({ ...prev, visible: false }))}
      />
    </div>
  );
}
