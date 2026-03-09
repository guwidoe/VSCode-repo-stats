import { useCommitPanelState, formatCommitBucketLabel, formatCommitDate } from '../../hooks/useCommitPanelState';
import type { CommitSortDirection, CommitSortField } from '../../types';
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
            {contributorPatterns.map((pattern) => (
              <div key={pattern.authorEmail} className="commit-pattern-row">
                <div>
                  <div className="commit-pattern-name">{pattern.authorName}</div>
                  <div className="commit-pattern-meta">{pattern.totalCommits.toLocaleString()} commits</div>
                </div>
                <div className="commit-pattern-metrics">
                  <span>avg Δ {Math.round(pattern.averageChangedLines).toLocaleString()}</span>
                  <span>median Δ {Math.round(pattern.medianChangedLines).toLocaleString()}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="commit-insight-card">
          <h3>Largest Commits</h3>
          <div className="largest-commit-list">
            {largestCommits.map((record) => {
              const authorName = data.commitAnalytics.authorDirectory.namesById[record.authorId] ?? 'Unknown';
              return (
                <div key={record.sha} className="largest-commit-row">
                  <div>
                    <div className="largest-commit-summary">{record.summary}</div>
                    <div className="largest-commit-meta">{authorName} · {formatCommitDate(record.committedAt)} · {record.sha.slice(0, 8)}</div>
                  </div>
                  <strong>Δ {record.changedLines.toLocaleString()}</strong>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      <div className="commit-filter-grid">
        <label>
          <span>Message</span>
          <input value={filters.messageText} onChange={(event) => filters.setMessageText(event.target.value)} placeholder="Search commit summary" />
        </label>

        <label>
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

        <label>
          <span>From date</span>
          <input type="date" value={filters.committedAfter} onChange={(event) => filters.setCommittedAfter(event.target.value)} />
        </label>

        <label>
          <span>To date</span>
          <input type="date" value={filters.committedBefore} onChange={(event) => filters.setCommittedBefore(event.target.value)} />
        </label>

        <label>
          <span>Min Δ lines</span>
          <input value={filters.minChangedLines} onChange={(event) => filters.setMinChangedLines(event.target.value)} inputMode="numeric" placeholder="0" />
        </label>

        <label>
          <span>Max Δ lines</span>
          <input value={filters.maxChangedLines} onChange={(event) => filters.setMaxChangedLines(event.target.value)} inputMode="numeric" placeholder="∞" />
        </label>

        <label>
          <span>Min files changed</span>
          <input value={filters.minFilesChanged} onChange={(event) => filters.setMinFilesChanged(event.target.value)} inputMode="numeric" placeholder="0" />
        </label>

        <label>
          <span>Max files changed</span>
          <input value={filters.maxFilesChanged} onChange={(event) => filters.setMaxFilesChanged(event.target.value)} inputMode="numeric" placeholder="∞" />
        </label>

        <label>
          <span>Sort by</span>
          <select value={filters.sortBy} onChange={(event) => filters.setSortBy(event.target.value as CommitSortField)}>
            <option value="timestamp">Date</option>
            <option value="additions">Additions</option>
            <option value="deletions">Deletions</option>
            <option value="changedLines">Changed lines</option>
            <option value="filesChanged">Files changed</option>
          </select>
        </label>

        <label>
          <span>Direction</span>
          <select value={filters.sortDirection} onChange={(event) => filters.setSortDirection(event.target.value as CommitSortDirection)}>
            <option value="desc">Descending</option>
            <option value="asc">Ascending</option>
          </select>
        </label>
      </div>

      <div className="commit-table-card">
        <table className="commit-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Author</th>
              <th>Summary</th>
              <th>SHA</th>
              <th>+Add</th>
              <th>-Del</th>
              <th>Δ Lines</th>
              <th>Files</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((record) => {
              const authorName = data.commitAnalytics.authorDirectory.namesById[record.authorId] ?? 'Unknown';
              return (
                <tr key={record.sha}>
                  <td>{formatCommitDate(record.committedAt)}</td>
                  <td>{authorName}</td>
                  <td className="commit-summary-cell" title={record.summary}>{record.summary}</td>
                  <td><code>{record.sha.slice(0, 8)}</code></td>
                  <td className="commit-positive">+{record.additions.toLocaleString()}</td>
                  <td className="commit-negative">-{record.deletions.toLocaleString()}</td>
                  <td>{record.changedLines.toLocaleString()}</td>
                  <td>{record.filesChanged.toLocaleString()}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {rows.length === 0 && (
          <div className="commit-empty-state">No commits match the current filters.</div>
        )}
      </div>
    </div>
  );
}
