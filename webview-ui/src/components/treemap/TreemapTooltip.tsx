// webview-ui/src/components/treemap/TreemapTooltip.tsx
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

export function TreemapTooltip({ visible, x, y, node, sizeMode }: TreemapTooltipProps) {
  if (!visible || !node) {return null;}

  const isFile = node.type === 'file';
  const lines = node.lines || 0;
  const fileCount = countFiles(node);

  return (
    <div
      className="treemap-tooltip"
      style={{
        left: x + 15,
        top: y + 15,
      }}
    >
      <div className="tooltip-path">{node.path}</div>
      {isFile && node.language && (
        <div className="tooltip-language">{node.language}</div>
      )}
      <div className="tooltip-size">
        {sizeMode === 'loc' ? (
          <>{formatNumber(lines)} lines</>
        ) : (
          <>{formatNumber(fileCount)} files</>
        )}
        {isFile && <> &middot; {formatNumber(Math.round(lines * 40))} bytes</>}
      </div>
      {node.lastModified && (
        <div className="tooltip-modified">
          Modified: {formatRelativeTime(node.lastModified)}
        </div>
      )}
    </div>
  );
}
