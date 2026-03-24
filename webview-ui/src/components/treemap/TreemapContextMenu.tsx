/**
 * TreemapContextMenu - Context menu for right-click actions on treemap nodes.
 */

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { TreemapNode } from '../../types';
import './TreemapContextMenu.css';

const VIEWPORT_PADDING = 8;

interface TreemapContextMenuProps {
  visible: boolean;
  x: number;
  y: number;
  node: TreemapNode | null;
  onOpenFile: (path: string, repositoryId?: string) => void;
  onRevealInExplorer: (path: string, repositoryId?: string) => void;
  onCopyPath: (path: string, repositoryId?: string) => void;
  onAddToRepoExcludePatterns: (node: TreemapNode) => void;
  onClose: () => void;
}

export function TreemapContextMenu({
  visible,
  x,
  y,
  node,
  onOpenFile,
  onRevealInExplorer,
  onCopyPath,
  onAddToRepoExcludePatterns,
  onClose,
}: TreemapContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ left: x, top: y });

  useLayoutEffect(() => {
    if (!visible || !node || !menuRef.current) {
      return;
    }

    const rect = menuRef.current.getBoundingClientRect();
    const maxLeft = Math.max(VIEWPORT_PADDING, window.innerWidth - rect.width - VIEWPORT_PADDING);
    const maxTop = Math.max(VIEWPORT_PADDING, window.innerHeight - rect.height - VIEWPORT_PADDING);

    setPosition({
      left: Math.min(Math.max(x, VIEWPORT_PADDING), maxLeft),
      top: Math.min(Math.max(y, VIEWPORT_PADDING), maxTop),
    });
  }, [visible, x, y, node]);

  useEffect(() => {
    if (!visible) {return;}

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [visible, onClose]);

  if (!visible || !node) {return null;}

  const isFile = node.type === 'file';
  const canExcludeNode = node.path.length > 0;

  return (
    <div
      ref={menuRef}
      className="treemap-context-menu"
      style={{ left: position.left, top: position.top }}
      role="menu"
    >
      {isFile && (
        <button
          className="context-menu-item"
          role="menuitem"
          onClick={() => {
            onOpenFile(node.path, node.repositoryId);
            onClose();
          }}
        >
          Open File
        </button>
      )}
      <button
        className="context-menu-item"
        role="menuitem"
        onClick={() => {
          onRevealInExplorer(node.path, node.repositoryId);
          onClose();
        }}
      >
        Reveal in Explorer
      </button>
      <button
        className="context-menu-item"
        role="menuitem"
        onClick={() => {
          onCopyPath(node.path, node.repositoryId);
          onClose();
        }}
      >
        Copy Path
      </button>
      {canExcludeNode && (
        <button
          className="context-menu-item"
          role="menuitem"
          onClick={() => {
            onAddToRepoExcludePatterns(node);
            onClose();
          }}
        >
          Add to Repo Exclude Patterns
        </button>
      )}
    </div>
  );
}
