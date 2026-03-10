import { useEffect, useRef, useState } from 'react';
import {
  Activity,
  BarChart3,
  ChartColumnIncreasing,
  ChevronDown,
  ChevronRight,
  FilterX,
  GitCommitHorizontal,
  Maximize2,
  Rows3,
  type LucideIcon,
} from 'lucide-react';
import { useCommitPanelState } from '../../hooks/useCommitPanelState';
import { DataGridFrame } from '../datagrid/DataGridFrame';
import { DataGridToolbar } from '../datagrid/DataGridToolbar';
import { CommitResultsList } from './CommitResultsList';
import { CommitDistributionChart } from './CommitDistributionChart';
import { ContributorPatternsChart } from './ContributorPatternsChart';
import { LargestCommitsChart } from './LargestCommitsChart';
import { CommitsHeaderCell } from './CommitsHeaderCell';
import { DEFAULT_COMMIT_COLUMN_ORDER, getCommitColumnConfig } from './columns';
import './CommitsPanel.css';

const COMMIT_SUMMARY_ICONS: Record<'repository' | 'average' | 'median' | 'largest', LucideIcon> = {
  repository: GitCommitHorizontal,
  average: Activity,
  median: ChartColumnIncreasing,
  largest: Maximize2,
};

const COMMIT_COLUMNS = DEFAULT_COMMIT_COLUMN_ORDER.map((key) => getCommitColumnConfig(key));
const COMMIT_GRID_TEMPLATE_COLUMNS = COMMIT_COLUMNS.map((column) => `${column.width}px`).join(' ');

export function CommitsPanel() {
  const {
    data,
    rows,
    totalRows,
    activeFilterCount,
    summary,
    largestCommit,
    table,
  } = useCommitPanelState();
  const [showInsights, setShowInsights] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onWindowMouseDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!panelRef.current?.contains(target)) {
        table.setActiveFilterColumn(null);
      }
    };

    window.addEventListener('mousedown', onWindowMouseDown);
    return () => {
      window.removeEventListener('mousedown', onWindowMouseDown);
    };
  }, [table.setActiveFilterColumn]);

  if (!data || !summary) {
    return null;
  }

  const analyzedCommitCount = summary.totalCommits;
  const repositoryCommitCount = data.repository.commitCount;
  const summaryCards = [
    {
      key: 'repository' as const,
      label: 'Repository commits',
      value: repositoryCommitCount.toLocaleString(),
      caption: data.limitReached
        ? `${analyzedCommitCount.toLocaleString()} analyzed by current limit`
        : 'All commits included in analytics',
    },
    {
      key: 'average' as const,
      label: 'Average changed lines / commit',
      value: `Δ ${Math.round(summary.averageChangedLines).toLocaleString()}`,
    },
    {
      key: 'median' as const,
      label: 'Median changed lines / commit',
      value: `Δ ${Math.round(summary.medianChangedLines).toLocaleString()}`,
    },
    {
      key: 'largest' as const,
      label: 'Largest commit',
      value: largestCommit ? `Δ ${largestCommit.changedLines.toLocaleString()}` : '—',
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

      <div className="commit-summary-grid">
        {summaryCards.map((card) => {
          const Icon = COMMIT_SUMMARY_ICONS[card.key];
          return (
            <div key={card.key} className="commit-summary-card">
              <div className="commit-summary-icon" aria-hidden="true">
                <Icon className="commit-summary-icon-svg" strokeWidth={1.9} />
              </div>
              <div className="commit-summary-content">
                <span className="commit-summary-value">{card.value}</span>
                <span className="commit-summary-label">{card.label}</span>
                {card.caption && <span className="commit-summary-caption">{card.caption}</span>}
              </div>
            </div>
          );
        })}
      </div>

      <section className="commit-explorer-card">
        <div className="commit-explorer-header">
          <div>
            <h3>Commit explorer</h3>
            <p>Browse history in a Files-style table. Click a column label to sort and use the funnel icon in a header to filter that column.</p>
          </div>
          <div className="commit-explorer-actions">
            <button
              type="button"
              className="commit-action-button"
              onClick={() => setShowInsights((current) => !current)}
              aria-expanded={showInsights}
            >
              {showInsights ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              {showInsights ? 'Hide insights' : 'Show insights'}
            </button>
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
          </div>
        </div>

        {showInsights && (
          <div className="commit-insights-section">
            <div className="commit-insights-banner">
              <BarChart3 size={16} />
              <span>Insights are secondary here on purpose — the commit table stays the primary workflow.</span>
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
              <span>Table-first workflow</span>
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
          minWidth={1170}
          header={(
            <div className="commit-results-header commit-results-grid" role="row" style={{ gridTemplateColumns: COMMIT_GRID_TEMPLATE_COLUMNS }}>
              {COMMIT_COLUMNS.map((column) => (
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
          <CommitResultsList rows={rows} gridTemplateColumns={COMMIT_GRID_TEMPLATE_COLUMNS} />
        </DataGridFrame>
      </section>
    </div>
  );
}
