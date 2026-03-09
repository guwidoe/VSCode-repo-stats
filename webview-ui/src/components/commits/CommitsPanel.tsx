import { useCommitPanelState, formatCommitBucketLabel, formatCommitDate } from '../../hooks/useCommitPanelState';
import type { CommitSortDirection, CommitSortField } from '../../types';
import { CommitResultsList } from './CommitResultsList';
import './CommitsPanel.css';

export function CommitsPanel() {
  const {
    data,
    rows,
    authorOptions,
    summary,
    largestCommit,
    largestCommits,
    contributorPatterns,
    maxChangedLineBucketCount,
    maxFileBucketCount,
    maxContributorPatternAverage,
    maxLargestCommitChangedLines,
    filters,
  } = useCommitPanelState();

  if (!data || !summary) {
    return null;
  }

  return (
    <div className="commits-panel">
      <div className="panel-header">
        <h2>Commits</h2>
        <span className="commits-meta">
          Showing {rows.length.toLocaleString()} of {summary.totalCommits.toLocaleString()} commits
        </span>
      </div>

      <div className="commit-summary-grid">
        <div className="commit-summary-card">
          <span className="commit-summary-value">{summary.totalCommits.toLocaleString()}</span>
          <span className="commit-summary-label">Total commits</span>
        </div>
        <div className="commit-summary-card">
          <span className="commit-summary-value">Δ {Math.round(summary.averageChangedLines).toLocaleString()}</span>
          <span className="commit-summary-label">Average changed lines / commit</span>
        </div>
        <div className="commit-summary-card">
          <span className="commit-summary-value">Δ {Math.round(summary.medianChangedLines).toLocaleString()}</span>
          <span className="commit-summary-label">Median changed lines / commit</span>
        </div>
        <div className="commit-summary-card">
          <span className="commit-summary-value">
            {largestCommit ? `Δ ${largestCommit.changedLines.toLocaleString()}` : '—'}
          </span>
          <span className="commit-summary-label">Largest commit</span>
        </div>
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
            {largestCommits.map((record, index) => {
              const authorName = data.commitAnalytics.authorDirectory.namesById[record.authorId] ?? 'Unknown';
              return (
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
                    <div className="largest-commit-meta">{authorName} · {formatCommitDate(record.committedAt)} · {record.sha.slice(0, 8)}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      <section className="commit-filter-shell">
        <div className="commit-filter-header">
          <div>
            <h3>Filter commits</h3>
            <p>Search by message, narrow by author and date, then tune the change-size ranges.</p>
          </div>
          <button
            type="button"
            className="commit-filter-reset"
            onClick={filters.resetFilters}
            disabled={!filters.hasActiveFilters}
          >
            Reset filters
          </button>
        </div>

        <div className="commit-filter-primary">
          <label className="commit-filter-field commit-filter-field-search">
            <span>Search message</span>
            <input value={filters.messageText} onChange={(event) => filters.setMessageText(event.target.value)} placeholder="Search commit summary" />
          </label>

          <label className="commit-filter-field">
            <span>Author</span>
            <select value={filters.authorId} onChange={(event) => filters.setAuthorId(event.target.value)}>
              <option value="all">All authors</option>
              {authorOptions.map((author) => (
                <option key={author.authorId} value={author.authorId}>
                  {author.authorName}
                </option>
              ))}
            </select>
          </label>

          <div className="commit-filter-field commit-filter-sort">
            <span>Sort results</span>
            <div className="commit-filter-sort-row">
              <select value={filters.sortBy} onChange={(event) => filters.setSortBy(event.target.value as CommitSortField)}>
                <option value="timestamp">Date</option>
                <option value="additions">Additions</option>
                <option value="deletions">Deletions</option>
                <option value="changedLines">Changed lines</option>
                <option value="filesChanged">Files changed</option>
              </select>
              <div className="commit-segmented-control" role="group" aria-label="Sort direction">
                <button
                  type="button"
                  className={filters.sortDirection === 'desc' ? 'active' : ''}
                  onClick={() => filters.setSortDirection('desc' as CommitSortDirection)}
                >
                  Desc
                </button>
                <button
                  type="button"
                  className={filters.sortDirection === 'asc' ? 'active' : ''}
                  onClick={() => filters.setSortDirection('asc' as CommitSortDirection)}
                >
                  Asc
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="commit-filter-groups">
          <section className="commit-filter-group">
            <div className="commit-filter-group-header">
              <h4>Date range</h4>
              <span>Limit the timeline window</span>
            </div>
            <div className="commit-filter-range-row">
              <label className="commit-filter-field">
                <span>From</span>
                <input type="date" value={filters.committedAfter} onChange={(event) => filters.setCommittedAfter(event.target.value)} />
              </label>
              <label className="commit-filter-field">
                <span>To</span>
                <input type="date" value={filters.committedBefore} onChange={(event) => filters.setCommittedBefore(event.target.value)} />
              </label>
            </div>
          </section>

          <section className="commit-filter-group">
            <div className="commit-filter-group-header">
              <h4>Changed lines</h4>
              <span>Filter by total additions + deletions</span>
            </div>
            <div className="commit-filter-range-row">
              <label className="commit-filter-field">
                <span>Minimum</span>
                <input value={filters.minChangedLines} onChange={(event) => filters.setMinChangedLines(event.target.value)} inputMode="numeric" placeholder="0" />
              </label>
              <label className="commit-filter-field">
                <span>Maximum</span>
                <input value={filters.maxChangedLines} onChange={(event) => filters.setMaxChangedLines(event.target.value)} inputMode="numeric" placeholder="∞" />
              </label>
            </div>
          </section>

          <section className="commit-filter-group">
            <div className="commit-filter-group-header">
              <h4>Files changed</h4>
              <span>Focus on small surgical edits or wide sweeps</span>
            </div>
            <div className="commit-filter-range-row">
              <label className="commit-filter-field">
                <span>Minimum</span>
                <input value={filters.minFilesChanged} onChange={(event) => filters.setMinFilesChanged(event.target.value)} inputMode="numeric" placeholder="0" />
              </label>
              <label className="commit-filter-field">
                <span>Maximum</span>
                <input value={filters.maxFilesChanged} onChange={(event) => filters.setMaxFilesChanged(event.target.value)} inputMode="numeric" placeholder="∞" />
              </label>
            </div>
          </section>
        </div>
      </section>

      <div className="commit-table-card">
        <div className="commit-results-toolbar">
          <div>
            <strong>{rows.length.toLocaleString()}</strong> matching commits
          </div>
          <span className="commit-results-note">Virtualized list for smoother scrolling in large repositories</span>
        </div>
        <CommitResultsList
          rows={rows}
          authorNamesById={data.commitAnalytics.authorDirectory.namesById}
        />
      </div>
    </div>
  );
}
