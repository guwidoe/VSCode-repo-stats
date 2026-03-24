import type { MouseEvent as ReactMouseEvent } from 'react';
import { getCellContent, getCellTitle } from './fileCellFormatters';
import type { FileColumnConfig, FileRow } from './types';

interface FilesTableRowProps {
  row: FileRow;
  columns: Array<FileColumnConfig & { width: number }>;
  gridTemplateColumns: string;
  start: number;
  onOpenFile: (path: string, repositoryId?: string) => void;
  onRevealInExplorer: (path: string, repositoryId?: string) => void;
}

function getParentFolderPath(filePath: string) {
  const lastSeparatorIndex = filePath.lastIndexOf('/');
  return lastSeparatorIndex === -1 ? '' : filePath.slice(0, lastSeparatorIndex);
}

export function FilesTableRow({
  row,
  columns,
  gridTemplateColumns,
  start,
  onOpenFile,
  onRevealInExplorer,
}: FilesTableRowProps) {
  const handlePathClick = (event: ReactMouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    onRevealInExplorer(getParentFolderPath(row.path), row.repositoryId);
  };

  const handleNameClick = (event: ReactMouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    onOpenFile(row.path, row.repositoryId);
  };

  return (
    <div
      className="files-table-row"
      style={{ transform: `translateY(${start}px)`, gridTemplateColumns }}
      role="row"
      onDoubleClick={() => onOpenFile(row.path, row.repositoryId)}
      title="Double click to open file"
    >
      {columns.map((column) => {
        const isPathColumn = column.key === 'path';
        const isNameColumn = column.key === 'name';
        const folderPath = isPathColumn ? getParentFolderPath(row.path) : '';

        return (
          <div
            key={column.key}
            className={`files-cell ${column.align === 'right' ? 'numeric' : ''} ${column.key === 'path' || column.key === 'ext' ? 'monospace' : ''}`}
            title={getCellTitle(row, column.key)}
          >
            {isPathColumn ? (
              <button
                type="button"
                className="files-link"
                onClick={handlePathClick}
                onDoubleClick={(event) => event.stopPropagation()}
                title={`Reveal folder${folderPath ? `: ${folderPath}` : ''}`}
              >
                {row.path}
              </button>
            ) : isNameColumn ? (
              <button
                type="button"
                className="files-link"
                onClick={handleNameClick}
                onDoubleClick={(event) => event.stopPropagation()}
                title={`Open file: ${row.path}`}
              >
                {row.name}
              </button>
            ) : (
              getCellContent(row, column.key)
            )}
          </div>
        );
      })}
    </div>
  );
}
