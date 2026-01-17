import React, { useRef, useEffect, useState, useCallback } from 'react';
import * as d3 from 'd3-hierarchy';
import { useStore, TreemapNode } from '../../store';
import { Breadcrumb } from './Breadcrumb';
import { getLanguageColor } from '../../utils/colors';
import { useVsCodeApi } from '../../hooks/useVsCodeApi';

interface TooltipData {
  x: number;
  y: number;
  node: TreemapNode;
}

export const TreemapPanel: React.FC = () => {
  const { treemapData, treemapPath, treemapColorMode, setTreemapPath, setTreemapColorMode } = useStore();
  const vscode = useVsCodeApi();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [tooltip, setTooltip] = useState<TooltipData | null>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 500 });

  // Get the current node based on the path
  const currentNode = React.useMemo(() => {
    if (!treemapData) {return null;}
    if (treemapPath.length === 0) {return treemapData;}

    let node: TreemapNode | undefined = treemapData;
    for (const segment of treemapPath) {
      node = node.children?.find((c) => c.name === segment);
      if (!node) {return treemapData;}
    }
    return node;
  }, [treemapData, treemapPath]);

  // Update dimensions on resize
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setDimensions({
          width: rect.width || 800,
          height: 500,
        });
      }
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  // Render the treemap
  useEffect(() => {
    if (!canvasRef.current || !currentNode) {return;}

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) {return;}

    const { width, height } = dimensions;
    canvas.width = width;
    canvas.height = height;

    // Clear canvas
    ctx.fillStyle = 'var(--vscode-editor-background, #1e1e1e)';
    ctx.fillRect(0, 0, width, height);

    // Create treemap layout
    const treemapLayout = d3.treemap<TreemapNode>()
      .size([width, height])
      .paddingInner(2)
      .paddingOuter(4)
      .round(true);

    const hierarchy = d3.hierarchy(currentNode)
      .sum((d) => d.lines || 0)
      .sort((a, b) => (b.value || 0) - (a.value || 0));

    const root = treemapLayout(hierarchy);

    // Draw nodes
    root.leaves().forEach((leaf) => {
      const { x0, y0, x1, y1 } = leaf as d3.HierarchyRectangularNode<TreemapNode>;
      const nodeWidth = x1 - x0;
      const nodeHeight = y1 - y0;

      if (nodeWidth < 1 || nodeHeight < 1) {return;}

      // Get color based on mode
      let color: string;
      if (treemapColorMode === 'language') {
        color = getLanguageColor(leaf.data.language);
      } else {
        // Age-based coloring (placeholder - would need lastModified data)
        color = '#4caf50'; // Default to green
      }

      // Draw rectangle
      ctx.fillStyle = color;
      ctx.fillRect(x0, y0, nodeWidth, nodeHeight);

      // Draw border
      ctx.strokeStyle = 'var(--vscode-panel-border, #333)';
      ctx.lineWidth = 1;
      ctx.strokeRect(x0, y0, nodeWidth, nodeHeight);

      // Draw label if there's enough space
      if (nodeWidth > 40 && nodeHeight > 20) {
        ctx.fillStyle = '#ffffff';
        ctx.font = '11px sans-serif';
        ctx.textBaseline = 'top';

        const label = leaf.data.name;
        const maxWidth = nodeWidth - 8;
        let displayText = label;

        // Truncate if needed
        while (ctx.measureText(displayText).width > maxWidth && displayText.length > 3) {
          displayText = displayText.slice(0, -4) + '...';
        }

        if (ctx.measureText(displayText).width <= maxWidth) {
          ctx.fillText(displayText, x0 + 4, y0 + 4);
        }
      }
    });

    // Store the hierarchy for mouse interactions
    (canvas as unknown as { __hierarchy__: d3.HierarchyRectangularNode<TreemapNode> }).__hierarchy__ = root as d3.HierarchyRectangularNode<TreemapNode>;
  }, [currentNode, dimensions, treemapColorMode]);

  // Handle mouse move for tooltip
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) {return;}

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const hierarchy = (canvas as unknown as { __hierarchy__?: d3.HierarchyRectangularNode<TreemapNode> }).__hierarchy__;
    if (!hierarchy) {return;}

    // Find the leaf node at this position
    const leaf = hierarchy.leaves().find((node) => {
      return x >= node.x0 && x <= node.x1 && y >= node.y0 && y <= node.y1;
    });

    if (leaf) {
      setTooltip({
        x: e.clientX,
        y: e.clientY,
        node: leaf.data,
      });
    } else {
      setTooltip(null);
    }
  }, []);

  // Handle click for navigation
  const handleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) {return;}

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const hierarchy = (canvas as unknown as { __hierarchy__?: d3.HierarchyRectangularNode<TreemapNode> }).__hierarchy__;
    if (!hierarchy) {return;}

    // Find the node at this position
    const clicked = hierarchy.leaves().find((node) => {
      return x >= node.x0 && x <= node.x1 && y >= node.y0 && y <= node.y1;
    });

    if (clicked) {
      if (clicked.data.type === 'file') {
        // Open file in editor
        vscode.postMessage({
          type: 'openFile',
          payload: { path: clicked.data.path },
        });
      } else {
        // Navigate into directory
        setTreemapPath([...treemapPath, clicked.data.name]);
      }
    }
  }, [vscode, treemapPath, setTreemapPath]);

  if (!treemapData) {
    return (
      <div className="panel">
        <p>No treemap data available.</p>
      </div>
    );
  }

  return (
    <div className="panel">
      <div className="frequency-controls" style={{ marginBottom: '8px' }}>
        <button
          className={`toggle-button ${treemapColorMode === 'language' ? 'active' : ''}`}
          onClick={() => setTreemapColorMode('language')}
        >
          By Language
        </button>
        <button
          className={`toggle-button ${treemapColorMode === 'age' ? 'active' : ''}`}
          onClick={() => setTreemapColorMode('age')}
        >
          By Age
        </button>
      </div>

      <Breadcrumb
        path={treemapPath}
        rootName={treemapData.name}
        onNavigate={(index) => setTreemapPath(treemapPath.slice(0, index))}
      />

      <div className="treemap-container" ref={containerRef}>
        <canvas
          ref={canvasRef}
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setTooltip(null)}
          onClick={handleClick}
          style={{ cursor: 'pointer' }}
        />
      </div>

      {tooltip && (
        <div
          className="tooltip"
          style={{
            left: tooltip.x + 10,
            top: tooltip.y + 10,
          }}
        >
          <div className="tooltip-title">{tooltip.node.name}</div>
          <div className="tooltip-row">
            <span>Path:</span>
            <span>{tooltip.node.path}</span>
          </div>
          {tooltip.node.lines !== undefined && (
            <div className="tooltip-row">
              <span>Lines:</span>
              <span>{tooltip.node.lines.toLocaleString()}</span>
            </div>
          )}
          {tooltip.node.language && (
            <div className="tooltip-row">
              <span>Language:</span>
              <span>{tooltip.node.language}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
