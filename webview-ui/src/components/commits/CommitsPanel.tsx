import { useEffect, useMemo, useRef, useState } from 'react';
import {
  BarChart3,
  ChevronDown,
  ChevronRight,
  Columns3,
  FilterX,
  Rows3,
} from 'lucide-react';
import { useCommitPanelState } from '../../hooks/useCommitPanelState';
import { DataGridFrame } from '../datagrid/DataGridFrame';
import { DataGridToolbar } from '../datagrid/DataGridToolbar';
import { CommitResultsList } from './CommitResultsList';
import { CommitDistributionChart } from './CommitDistributionChart';
import { ContributorPatternsChart } from './ContributorPatternsChart';
import { LargestCommitsChart } from './LargestCommitsChart';
import { CommitsHeaderCell } from './CommitsHeaderCell';
import { CommitColumnManagerPopover } from './CommitColumnManagerPopover';
import { DEFAULT_COMMIT_COLUMN_ORDER, getCommitColumnConfig } from './columns';
import type { CommitColumnKey } from './types';
import './CommitsPanel.css';

const COMMIT_COLUMNS = DEFAULT_COMMIT_COLUMN_ORDER.map((key) => getCommitColumnConfig(key));

export function CommitsPanel() {
  const {
    data,
    rows,
    totalRows,
    activeFilterCount,
    summary,
    table,
  } = useCommitPanelState();
  const [showInsights, setShowInsights] = useState(false);
  const [showColumnManager, setShowColumnManager] = useState(false);
  const [columnOrder, setColumnOrder] = useState<CommitColumnKey[]>(DEFAULT_COMMIT_COLUMN_ORDER);
  const [hiddenColumns, setHiddenColumns] = useState<Set<CommitColumnKey>>(() => new Set());

  const panelRef = useRef<HTMLDivElement | null>(null);
  const tableContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onWindowMouseDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!panelRef.current?.contains(target)) {
        setShowColumnManager(false);
        table.setActiveFilterColumn(null);
      }
    };

    window.addEventListener('mousedown', onWindowMouseDown);
    return () => {
      window.removeEventListener('mousedown', onWindowMouseDown);
    };
  }, [table.setActiveFilterColumn]);

  const visibleColumns = useMemo(
    () => columnOrder
      .filter((key) => !hiddenColumns.has(key))
      .map((key) => getCommitColumnConfig(key)),
    [columnOrder, hiddenColumns]
  );

  const commitGridTemplateColumns = useMemo(
    () => visibleColumns.map((column) => `${column.width}px`).join(' '),
    [visibleColumns]
  );

  const minTableWidth = useMemo(
    () => visibleColumns.reduce((sum, column) => sum + column.width, 0),
    [visibleColumns]
  );

  const toggleColumnVisibility = (key: CommitColumnKey) => {
    const isCurrentlyHidden = hiddenColumns.has(key);

    setHiddenColumns((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
        return next;
      }

      const visibleCount = columnOrder.length - next.size;
      if (visibleCount <= 1) {
        return prev;
      }

      next.add(key);
      return next;
    });

    if (!isCurrentlyHidden) {
      table.clearFilter(key);
      if (table.activeFilterColumn === key) {
        table.setActiveFilterColumn(null);
      }
    }
  };

  const moveColumn = (key: CommitColumnKey, direction: 'up' | 'down') => {
    setColumnOrder((prev) => {
      const index = prev.indexOf(key);
      if (index === -1) {
        return prev;
      }

      const target = direction === 'up' ? index - 1 : index + 1;
      if (target < 0 || target >= prev.length) {
        return prev;
      }

      const next = [...prev];
      const [item] = next.splice(index, 1);
      next.splice(target, 0, item);
      return next;
    });
  };

  const resetColumns = () => {
    setColumnOrder(DEFAULT_COMMIT_COLUMN_ORDER);
    setHiddenColumns(new Set());
  };

  if (!data || !summary) {
    return null;
  }

  const analyzedCommitCount = summary.totalCommits;
  const repositoryCommitCount = data.repository.commitCount;

  const summaryCards = [
    {
      key: 'repository',
      label: 'Repository commits',
      value: repositoryCommitCount.toLocaleString(),
      caption: data.limitReached
        ? `${analyzedCommitCount.toLocaleString()} analyzed by current limit`
        : 'All commits included in analytics',
    },
    {
      key: 'average',
      label: 'Average changed lines / commit',
      value: `Δ ${Math.round(summary.averageChangedLines).toLocaleString()}`,
    },
    {
      key: 'median',
      label: 'Median changed lines / commit',
      value: `Δ ${Math.round(summary.medianChangedLines).toLocaleString()}`,
    },
    {
      key: 'largest',
      label: 'Average files changed / commit',
      value: Math.round(summary.averageFilesChanged).toLocaleString(),
    },
  ];

  const sortLabel = getCommitColumnConfig(table.sortState.key).label;

  return (
    <div className="commits-panel" ref={panelRef}>
      <div className="panel-header">
        <div>
          <h2>Commits</h2>
          <span className="commits-meta">
            Showing {rows.length.toLocaleString()} of {analyzedCommitCount.toLocaleString()} analyzed commits
            {data.limitReached && ` • repository has ${repositoryCommitCount.toLocaleString()} total`}
          </span>
        </div>
      </div>

      <section className="commit-explorer-card">
        <div className="commit-explorer-header">
          <div>
            <h3>Commit explorer</h3>
            <p>Browse history in a Files-style table. Click a column label to sort and use the funnel icon in a header to filter that column.</p>
          </div>
          <div className="commit-explorer-actions">
            <div className="commit-action-anchor">
              <button
                type="button"
                className="commit-action-button commit-column-selector-button"
                onClick={() => {
                  setShowColumnManager((current) => !current);
                  table.setActiveFilterColumn(null);
                }}
              >
                <Columns3 size={15} />
                <span>Columns</span>
                <ChevronDown size={14} />
              </button>

              {showColumnManager && (
                <CommitColumnManagerPopover
                  columnOrder={columnOrder}
                  hiddenColumns={hiddenColumns}
                  onToggleColumn={toggleColumnVisibility}
                  onMoveColumn={moveColumn}
                  onResetColumns={resetColumns}
                  onClose={() => setShowColumnManager(false)}
                />
              )}
            </div>

            <button
              type="button"
              className="commit-action-button"
              onClick={table.clearAllFilters}
              disabled={activeFilterCount === 0}
            >
              <FilterX size={16} />
              Clear filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
            </button>
            <button
              type="button"
              className="commit-action-button"
              onClick={table.resetSort}
              disabled={table.sortState.key === 'committedAt' && table.sortState.direction === 'desc'}
            >
              Reset sort
            </button>
            <button
              type="button"
              className="commit-action-button"
              onClick={() => setShowInsights((current) => !current)}
              aria-expanded={showInsights}
            >
              {showInsights ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              {showInsights ? 'Hide insights' : 'Show insights'}
            </button>
          </div>
        </div>

        {showInsights && (
          <div className="commit-insights-section">
            <div className="commit-summary-grid">
              {summaryCards.map((card) => (
                <div key={card.key} className="commit-summary-card">
                  <div className="commit-summary-content">
                    <span className="commit-summary-value">{card.value}</span>
                    <span className="commit-summary-label">{card.label}</span>
                    {card.caption && <span className="commit-summary-caption">{card.caption}</span>}
                  </div>
                </div>
              ))}
            </div>

            <div className="commit-insights-banner">
              <BarChart3 size={16} />
              <span>Insights are optional — keep them hidden when you want maximum table space.</span>
            </div>

            <div className="commit-insight-grid">
              <CommitDistributionChart
                title="Changed Lines Distribution"
                buckets={data.commitAnalytics.changedLineBuckets}
                color="rgba(99, 179, 237, 0.92)"
                valueLabel="Changed lines"
              />
              <CommitDistributionChart
                title="Files Changed Distribution"
                buckets={data.commitAnalytics.fileChangeBuckets}
                color="rgba(129, 140, 248, 0.9)"
                valueLabel="Files changed"
              />
              <ContributorPatternsChart contributors={data.commitAnalytics.contributorSummaries} />
              <LargestCommitsChart rows={rows} />
            </div>
          </div>
        )}

        <DataGridToolbar
          className="commit-grid-toolbar"
          start={(
            <div className="commit-grid-hint">
              <Rows3 size={16} />
              <span>{visibleColumns.length} of {COMMIT_COLUMNS.length} columns visible</span>
            </div>
          )}
          end={(
            <div className="commit-grid-sort-state">
              Sorted by <strong>{sortLabel}</strong> ({table.sortState.direction})
            </div>
          )}
          summary={(
            <div>
              Showing <strong>{rows.length.toLocaleString()}</strong> of <strong>{totalRows.toLocaleString()}</strong> analyzed commits
            </div>
          )}
        />

        <DataGridFrame
          className="commit-results-frame"
          tableClassName="commit-results-shell"
          bodyClassName="commit-results-body"
          bodyRef={tableContainerRef}
          minWidth={minTableWidth}
          header={(
            <div className="commit-results-header commit-results-grid" role="row" style={{ gridTemplateColumns: commitGridTemplateColumns }}>
              {visibleColumns.map((column) => (
                <CommitsHeaderCell
                  key={column.key}
                  column={column}
                  sortState={table.sortState}
                  activeFilterColumn={table.activeFilterColumn}
                  filter={table.columnFilters[column.key]}
                  onSort={table.toggleSort}
                  onSetActiveFilterColumn={table.setActiveFilterColumn}
                  onFilterChange={table.setFilter}
                  onFilterClear={table.clearFilter}
                />
              ))}
            </div>
          )}
        >
          <CommitResultsList
            rows={rows}
            gridTemplateColumns={commitGridTemplateColumns}
            visibleColumnKeys={visibleColumns.map((column) => column.key)}
            scrollRef={tableContainerRef}
          />
        </DataGridFrame>
      </section>
    </div>
  );
}
