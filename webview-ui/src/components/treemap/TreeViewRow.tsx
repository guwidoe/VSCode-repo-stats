/**
 * TreeViewRow - A single row in the tree view panel.
 */

import type { TreemapNode } from '../../types';
import { formatNumber } from '../../utils/colors';

interface TreeRowProps {
  node: TreemapNode;
  depth: number;
  expandedPaths: Set<string>;
  selectedPath: string | null;
  hoveredPath: string | null;
  onToggle: (path: string) => void;
  onSelect: (node: TreemapNode) => void;
  onHover: (node: TreemapNode | null) => void;
  onDoubleClick: (node: TreemapNode) => void;
}

export function TreeViewRow({
  node,
  depth,
  expandedPaths,
  selectedPath,
  hoveredPath,
  onToggle,
  onSelect,
  onHover,
  onDoubleClick,
}: TreeRowProps) {
  const isDirectory = node.type === 'directory';
  const isExpanded = expandedPaths.has(node.path);
  const isSelected = selectedPath === node.path;
  const isHovered = hoveredPath === node.path;
  const hasChildren = isDirectory && node.children && node.children.length > 0;

  // Compute metrics
  const lines = node.lines || 0;
  const complexity = node.complexity || 0;
  const fileCount = node.fileCount ?? (isDirectory ? 0 : 1);
  const commentLines = node.commentLines || 0;
  const totalLines = lines + commentLines + (node.blankLines || 0);
  const commentRatio = totalLines > 0 ? (commentLines / totalLines) * 100 : 0;

  // For directories, show avg/max complexity
  const complexityDisplay = isDirectory && node.complexityAvg !== undefined
    ? `${node.complexityAvg} (${node.complexityMax})`
    : formatNumber(complexity);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect(node);
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDoubleClick(node);
  };

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (hasChildren) {
      onToggle(node.path);
    }
  };

  return (
    <>
      <div
        className={`tree-row ${isSelected ? 'selected' : ''} ${isHovered ? 'hovered' : ''}`}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        onMouseEnter={() => onHover(node)}
        onMouseLeave={() => onHover(null)}
      >
        <div className="tree-cell tree-name">
          {hasChildren ? (
            <button className="tree-toggle" onClick={handleToggle}>
              {isExpanded ? '▼' : '▶'}
            </button>
          ) : (
            <span className="tree-toggle-spacer" />
          )}
          <span className="tree-icon">{isDirectory ? '📁' : '📄'}</span>
          <span className="tree-label" title={node.name}>
            {node.name}{isDirectory ? '/' : ''}
          </span>
        </div>
        <div className="tree-cell tree-loc">{formatNumber(lines)}</div>
        <div className="tree-cell tree-complexity">{complexityDisplay}</div>
        <div className="tree-cell tree-comments">{commentRatio.toFixed(0)}%</div>
        <div className="tree-cell tree-files">
          {isDirectory ? formatNumber(fileCount) : '—'}
        </div>
      </div>

      {/* Render children if expanded */}
      {isExpanded && hasChildren && node.children!.map((child) => (
        <TreeViewRow
          key={child.path}
          node={child}
          depth={depth + 1}
          expandedPaths={expandedPaths}
          selectedPath={selectedPath}
          hoveredPath={hoveredPath}
          onToggle={onToggle}
          onSelect={onSelect}
          onHover={onHover}
          onDoubleClick={onDoubleClick}
        />
      ))}
    </>
  );
}
