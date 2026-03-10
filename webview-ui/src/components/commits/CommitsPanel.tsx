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
import { useCommitPanelState, formatCommitBucketLabel, formatCommitDate } from '../../hooks/useCommitPanelState';
import { DataGridFrame } from '../datagrid/DataGridFrame';
import { DataGridToolbar } from '../datagrid/DataGridToolbar';
import { CommitResultsList } from './CommitResultsList';
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
    largestCommits,
    contributorPatterns,
    maxChangedLineBucketCount,
    maxFileBucketCount,
    maxContributorPatternAverage,
    maxLargestCommitChangedLines,
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
              <section className="commit-insight-card">
                <h3>Changed Lines Distribution</h3>
                <div className="commit-bar-list">
                  {data.commitAnalytics.changedLineBuckets.map((bucket) => (
                    <div key={`${bucket.minInclusive}-${bucket.maxInclusive}`} className="commit-bar-row">
                      <span className="commit-bar-label">{formatCommitBucketLabel(bucket.minInclusive, bucket.maxInclusive)}</span>
                      <div className="commit-bar-track">
                        <div
                          className="commit-bar-fill"
                          style={{ width: `${(bucket.count / maxChangedLineBucketCount) * 100}%` }}
                        />
                      </div>
                      <span className="commit-bar-value">{bucket.count.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </section>

              <section className="commit-insight-card">
                <h3>Files Changed Distribution</h3>
                <div className="commit-bar-list">
                  {data.commitAnalytics.fileChangeBuckets.map((bucket) => (
                    <div key={`${bucket.minInclusive}-${bucket.maxInclusive}`} className="commit-bar-row">
                      <span className="commit-bar-label">{formatCommitBucketLabel(bucket.minInclusive, bucket.maxInclusive)}</span>
                      <div className="commit-bar-track">
                        <div
                          className="commit-bar-fill files"
                          style={{ width: `${(bucket.count / maxFileBucketCount) * 100}%` }}
                        />
                      </div>
                      <span className="commit-bar-value">{bucket.count.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </section>

              <section className="commit-insight-card">
                <h3>Contributor Commit-Size Patterns</h3>
                <div className="commit-pattern-list">
                  {contributorPatterns.map((pattern, index) => (
                    <div key={pattern.authorEmail} className="commit-rank-row">
                      <div className="commit-rank-index">{index + 1}</div>
                      <div className="commit-rank-body">
                        <div className="commit-rank-header">
                          <div className="commit-pattern-name">{pattern.authorName}</div>
                          <span className="commit-metric-pill">{pattern.totalCommits.toLocaleString()} commits</span>
                        </div>
                        <div className="commit-rank-meter">
                          <div
                            className="commit-rank-meter-fill"
                            style={{ width: `${(pattern.averageChangedLines / maxContributorPatternAverage) * 100}%` }}
                          />
                        </div>
                        <div className="commit-rank-meta">
                          <span>avg Δ {Math.round(pattern.averageChangedLines).toLocaleString()}</span>
                          <span>median Δ {Math.round(pattern.medianChangedLines).toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <section className="commit-insight-card">
                <h3>Largest Commits</h3>
                <div className="largest-commit-list">
                  {largestCommits.map((record, index) => (
                    <div key={record.sha} className="commit-rank-row largest">
                      <div className="commit-rank-index">{index + 1}</div>
                      <div className="commit-rank-body">
                        <div className="commit-rank-header">
                          <div className="largest-commit-summary">{record.summary}</div>
                          <span className="commit-metric-pill strong">Δ {record.changedLines.toLocaleString()}</span>
                        </div>
                        <div className="commit-rank-meter">
                          <div
                            className="commit-rank-meter-fill large"
                            style={{ width: `${(record.changedLines / maxLargestCommitChangedLines) * 100}%` }}
                          />
                        </div>
                        <div className="largest-commit-meta">{record.authorName} · {formatCommitDate(record.committedAt)} · {record.sha.slice(0, 8)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
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
          <CommitResultsList rows={rows} />
        </DataGridFrame>
      </section>
    </div>
  );
}
