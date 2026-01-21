/**
 * TreemapContextMenu - Context menu for right-click actions on treemap nodes.
 */

import { useEffect, useRef } from 'react';
import type { TreemapNode } from '../../types';
import './TreemapContextMenu.css';

interface TreemapContextMenuProps {
  visible: boolean;
  x: number;
  y: number;
  node: TreemapNode | null;
  onOpenFile: (path: string) => void;
  onRevealInExplorer: (path: string) => void;
  onCopyPath: (path: string) => void;
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
  onClose,
}: TreemapContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

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

  return (
    <div
      ref={menuRef}
      className="treemap-context-menu"
      style={{ left: x, top: y }}
      role="menu"
    >
      {isFile && (
        <button
          className="context-menu-item"
          role="menuitem"
          onClick={() => {
            onOpenFile(node.path);
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
          onRevealInExplorer(node.path);
          onClose();
        }}
      >
        Reveal in Explorer
      </button>
      <button
        className="context-menu-item"
        role="menuitem"
        onClick={() => {
          onCopyPath(node.path);
          onClose();
        }}
      >
        Copy Path
      </button>
    </div>
  );
}
