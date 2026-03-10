import type { RefObject } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { CommitColumnKey, CommitTableRow } from './types';
import { formatCommitDate } from '../../hooks/useCommitPanelState';

interface CommitResultsListProps {
  rows: CommitTableRow[];
  gridTemplateColumns: string;
  visibleColumnKeys: CommitColumnKey[];
  scrollRef: RefObject<HTMLDivElement | null>;
}

function getCellClass(columnKey: CommitColumnKey): string {
  if (columnKey === 'additions' || columnKey === 'deletions' || columnKey === 'changedLines' || columnKey === 'filesChanged') {
    return 'commit-results-cell numeric';
  }

  return 'commit-results-cell';
}

function renderCellContent(record: CommitTableRow, columnKey: CommitColumnKey) {
  switch (columnKey) {
    case 'committedAt':
      return formatCommitDate(record.committedAt);
    case 'authorName':
      return record.authorName;
    case 'summary':
      return <span className="commit-summary-cell" title={record.summary}>{record.summary}</span>;
    case 'sha':
      return <code>{record.sha.slice(0, 8)}</code>;
    case 'additions':
      return <span className="commit-positive">+{record.additions.toLocaleString()}</span>;
    case 'deletions':
      return <span className="commit-negative">-{record.deletions.toLocaleString()}</span>;
    case 'changedLines':
      return record.changedLines.toLocaleString();
    case 'filesChanged':
      return record.filesChanged.toLocaleString();
    default:
      return null;
  }
}

export function CommitResultsList({
  rows,
  gridTemplateColumns,
  visibleColumnKeys,
  scrollRef,
}: CommitResultsListProps) {
  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 48,
    overscan: 12,
  });

  if (rows.length === 0) {
    return <div className="commit-empty-state">No commits match the active column filters.</div>;
  }

  return (
    <div
      className="commit-results-inner"
      style={{ height: `${rowVirtualizer.getTotalSize()}px` }}
    >
      {rowVirtualizer.getVirtualItems().map((virtualRow) => {
        const record = rows[virtualRow.index];
        if (!record) {
          return null;
        }

        return (
          <div
            key={record.sha}
            className="commit-results-row commit-results-grid"
            role="row"
            style={{
              transform: `translateY(${virtualRow.start}px)`,
              gridTemplateColumns,
            }}
          >
            {visibleColumnKeys.map((columnKey) => (
              <span key={`${record.sha}-${columnKey}`} className={getCellClass(columnKey)}>
                {renderCellContent(record, columnKey)}
              </span>
            ))}
          </div>
        );
      })}
    </div>
  );
}
