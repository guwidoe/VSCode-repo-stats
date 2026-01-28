/**
 * TreeViewPanel - Collapsible hierarchical tree view above the treemap.
 * Shows folder/file metrics: LOC, Complexity, Comment %, Files.
 * Features a draggable resize handle at the bottom.
 */

import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import type { TreemapNode, ColorMode } from '../../types';
import { TreeViewRow } from './TreeViewRow';
import { InfoTooltip } from '../common/InfoTooltip';
import './TreeViewPanel.css';

interface TreeViewPanelProps {
  root: TreemapNode | null;
  colorMode: ColorMode;
  selectedPath: string | null;
  hoveredPath: string | null;
  onSelect: (node: TreemapNode | null) => void;
  onHover: (node: TreemapNode | null) => void;
  onNavigate: (path: string[]) => void;
}

const MIN_HEIGHT = 100;
const MAX_HEIGHT = 500;
const DEFAULT_HEIGHT = 200;

export function TreeViewPanel({
  root,
  selectedPath,
  hoveredPath,
  onSelect,
  onHover,
  onNavigate,
}: TreeViewPanelProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [height, setHeight] = useState(DEFAULT_HEIGHT);
  const [isResizing, setIsResizing] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const startY = useRef(0);
  const startHeight = useRef(0);

  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(() => {
    // Start with root expanded
    return new Set(['']);
  });

  // Handle resize mouse events
  useEffect(() => {
    if (!isResizing) {return;}

    const handleMouseMove = (e: MouseEvent) => {
      const delta = e.clientY - startY.current;
      const newHeight = Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, startHeight.current + delta));
      setHeight(newHeight);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    startY.current = e.clientY;
    startHeight.current = height;
    setIsResizing(true);
  }, [height]);

  const handleToggle = useCallback((path: string) => {
    setExpandedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }, []);

  const handleSelect = useCallback((node: TreemapNode) => {
    onSelect(node);
  }, [onSelect]);

  const handleDoubleClick = useCallback((node: TreemapNode) => {
    if (node.type === 'directory') {
      const pathParts = node.path.split('/').filter(Boolean);
      onNavigate(pathParts);
    }
  }, [onNavigate]);

  // Sort children: directories first, then by lines descending
  const sortedRoot = useMemo(() => {
    if (!root) {
      return null;
    }

    const sortChildren = (node: TreemapNode): TreemapNode => {
      if (!node.children) {
        return node;
      }

      const sortedChildren = [...node.children]
        .map(sortChildren)
        .sort((a, b) => {
          // Directories first
          if (a.type !== b.type) {
            return a.type === 'directory' ? -1 : 1;
          }
          // Then by lines descending
          return (b.lines || 0) - (a.lines || 0);
        });

      return { ...node, children: sortedChildren };
    };

    return sortChildren(root);
  }, [root]);

  if (!root) {
    return null;
  }

  return (
    <div
      ref={panelRef}
      className={`tree-view-panel ${isCollapsed ? 'collapsed' : ''} ${isResizing ? 'resizing' : ''}`}
      style={!isCollapsed ? { height: `${height}px` } : undefined}
    >
      <div className="tree-view-header">
        <button
          className="tree-view-collapse-btn"
          onClick={() => setIsCollapsed(!isCollapsed)}
          title={isCollapsed ? 'Expand tree view' : 'Collapse tree view'}
        >
          {isCollapsed ? '▶' : '▼'} Tree View
        </button>
      </div>

      {!isCollapsed && (
        <>
          <div className="tree-view-content">
            <div className="tree-header-row">
              <div className="tree-cell tree-name">Name</div>
              <div className="tree-cell tree-loc">
                LOC
                <InfoTooltip content="Lines of code (excluding comments and blanks)" position="bottom" />
              </div>
              <div className="tree-cell tree-complexity">
                Complexity
                <InfoTooltip content="Cyclomatic complexity. For folders: avg (max). Higher = more branching." position="bottom" />
              </div>
              <div className="tree-cell tree-comments">
                Comments
                <InfoTooltip content="Percentage of lines that are comments" position="bottom" />
              </div>
              <div className="tree-cell tree-files">
                Files
                <InfoTooltip content="Number of files in this folder" position="bottom" />
              </div>
            </div>

            <div className="tree-body">
              {sortedRoot && sortedRoot.children?.map((child) => (
                <TreeViewRow
                  key={child.path}
                  node={child}
                  depth={0}
                  expandedPaths={expandedPaths}
                  selectedPath={selectedPath}
                  hoveredPath={hoveredPath}
                  onToggle={handleToggle}
                  onSelect={handleSelect}
                  onHover={onHover}
                  onDoubleClick={handleDoubleClick}
                />
              ))}
            </div>
          </div>

          <div className="tree-view-resize-handle" onMouseDown={handleResizeStart}>
            <div className="resize-handle-bar" />
          </div>
        </>
      )}
    </div>
  );
}
