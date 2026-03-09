import { useMemo, useState } from 'react';
import { queryCommitAnalytics } from '../../../../src/analyzers/commitAnalytics';
import { useStore } from '../../store';
import type { CommitAnalyticsQuery, CommitSortDirection, CommitSortField } from '../../types';
import './CommitsPanel.css';

function parseOptionalNumber(value: string): number | undefined {
  if (!value.trim()) {
    return undefined;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function formatDate(isoDate: string): string {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) {
    return isoDate;
  }

  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  }).format(date);
}

function formatBucketLabel(minInclusive: number, maxInclusive: number): string {
  if (maxInclusive === Number.MAX_SAFE_INTEGER) {
    return `${minInclusive.toLocaleString()}+`;
  }
  if (minInclusive === maxInclusive) {
    return minInclusive.toLocaleString();
  }
  return `${minInclusive.toLocaleString()}-${maxInclusive.toLocaleString()}`;
}

export function CommitsPanel() {
  const data = useStore((state) => state.data);

  const [messageText, setMessageText] = useState('');
  const [authorId, setAuthorId] = useState<string>('all');
  const [committedAfter, setCommittedAfter] = useState('');
  const [committedBefore, setCommittedBefore] = useState('');
  const [minChangedLines, setMinChangedLines] = useState('');
  const [maxChangedLines, setMaxChangedLines] = useState('');
  const [minFilesChanged, setMinFilesChanged] = useState('');
  const [maxFilesChanged, setMaxFilesChanged] = useState('');
  const [sortBy, setSortBy] = useState<CommitSortField>('timestamp');
  const [sortDirection, setSortDirection] = useState<CommitSortDirection>('desc');

  if (!data) {
    return null;
  }

  const query = useMemo<CommitAnalyticsQuery>(() => ({
    messageText: messageText.trim() || undefined,
    authorIds: authorId === 'all' ? undefined : [Number(authorId)],
    committedAfter: committedAfter || undefined,
    committedBefore: committedBefore || undefined,
    minChangedLines: parseOptionalNumber(minChangedLines),
    maxChangedLines: parseOptionalNumber(maxChangedLines),
    minFilesChanged: parseOptionalNumber(minFilesChanged),
    maxFilesChanged: parseOptionalNumber(maxFilesChanged),
    sortBy,
    sortDirection,
  }), [
    messageText,
    authorId,
    committedAfter,
    committedBefore,
    minChangedLines,
    maxChangedLines,
    minFilesChanged,
    maxFilesChanged,
    sortBy,
    sortDirection,
  ]);

  const rows = useMemo(
    () => queryCommitAnalytics(data.commitAnalytics, query),
    [data.commitAnalytics, query]
  );

  const authorOptions = data.commitAnalytics.contributorSummaries;
  const summary = data.commitAnalytics.summary;
  const largestCommit = queryCommitAnalytics(data.commitAnalytics, {
    sortBy: 'changedLines',
    sortDirection: 'desc',
    limit: 1,
  })[0] ?? null;
  const largestCommits = queryCommitAnalytics(data.commitAnalytics, {
    sortBy: 'changedLines',
    sortDirection: 'desc',
    limit: 5,
  });
  const contributorPatterns = [...data.commitAnalytics.contributorSummaries]
    .sort((a, b) => b.averageChangedLines - a.averageChangedLines || b.totalCommits - a.totalCommits)
    .slice(0, 8);
  const maxChangedLineBucketCount = Math.max(
    1,
    ...data.commitAnalytics.changedLineBuckets.map((bucket) => bucket.count)
  );
  const maxFileBucketCount = Math.max(
    1,
    ...data.commitAnalytics.fileChangeBuckets.map((bucket) => bucket.count)
  );

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
                <span className="commit-bar-label">{formatBucketLabel(bucket.minInclusive, bucket.maxInclusive)}</span>
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
                <span className="commit-bar-label">{formatBucketLabel(bucket.minInclusive, bucket.maxInclusive)}</span>
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
                    <div className="largest-commit-meta">{authorName} · {formatDate(record.committedAt)} · {record.sha.slice(0, 8)}</div>
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
          <input value={messageText} onChange={(event) => setMessageText(event.target.value)} placeholder="Search commit summary" />
        </label>

        <label>
          <span>Author</span>
          <select value={authorId} onChange={(event) => setAuthorId(event.target.value)}>
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
          <input type="date" value={committedAfter} onChange={(event) => setCommittedAfter(event.target.value)} />
        </label>

        <label>
          <span>To date</span>
          <input type="date" value={committedBefore} onChange={(event) => setCommittedBefore(event.target.value)} />
        </label>

        <label>
          <span>Min Δ lines</span>
          <input value={minChangedLines} onChange={(event) => setMinChangedLines(event.target.value)} inputMode="numeric" placeholder="0" />
        </label>

        <label>
          <span>Max Δ lines</span>
          <input value={maxChangedLines} onChange={(event) => setMaxChangedLines(event.target.value)} inputMode="numeric" placeholder="∞" />
        </label>

        <label>
          <span>Min files changed</span>
          <input value={minFilesChanged} onChange={(event) => setMinFilesChanged(event.target.value)} inputMode="numeric" placeholder="0" />
        </label>

        <label>
          <span>Max files changed</span>
          <input value={maxFilesChanged} onChange={(event) => setMaxFilesChanged(event.target.value)} inputMode="numeric" placeholder="∞" />
        </label>

        <label>
          <span>Sort by</span>
          <select value={sortBy} onChange={(event) => setSortBy(event.target.value as CommitSortField)}>
            <option value="timestamp">Date</option>
            <option value="additions">Additions</option>
            <option value="deletions">Deletions</option>
            <option value="changedLines">Changed lines</option>
            <option value="filesChanged">Files changed</option>
          </select>
        </label>

        <label>
          <span>Direction</span>
          <select value={sortDirection} onChange={(event) => setSortDirection(event.target.value as CommitSortDirection)}>
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
                  <td>{formatDate(record.committedAt)}</td>
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
