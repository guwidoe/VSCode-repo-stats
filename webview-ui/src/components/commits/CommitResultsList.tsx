import { useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { CommitTableRow } from './types';
import { formatCommitDate } from '../../hooks/useCommitPanelState';

interface CommitResultsListProps {
  rows: CommitTableRow[];
  gridTemplateColumns: string;
}

export function CommitResultsList({ rows, gridTemplateColumns }: CommitResultsListProps) {
  const parentRef = useRef<HTMLDivElement | null>(null);
  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 48,
    overscan: 12,
  });

  if (rows.length === 0) {
    return <div className="commit-empty-state">No commits match the active column filters.</div>;
  }

  return (
    <div className="commit-results-viewport" ref={parentRef}>
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
              <span className="commit-results-cell">{formatCommitDate(record.committedAt)}</span>
              <span className="commit-results-cell">{record.authorName}</span>
              <span className="commit-results-cell commit-summary-cell" title={record.summary}>{record.summary}</span>
              <span className="commit-results-cell"><code>{record.sha.slice(0, 8)}</code></span>
              <span className="commit-results-cell numeric commit-positive">+{record.additions.toLocaleString()}</span>
              <span className="commit-results-cell numeric commit-negative">-{record.deletions.toLocaleString()}</span>
              <span className="commit-results-cell numeric">{record.changedLines.toLocaleString()}</span>
              <span className="commit-results-cell numeric">{record.filesChanged.toLocaleString()}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
