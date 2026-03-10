import Plot from 'react-plotly.js';
import type { CommitTableRow } from './types';
import { formatCommitDate } from '../../hooks/useCommitPanelState';

interface Props {
  rows: CommitTableRow[];
}

function truncateSummary(summary: string): string {
  return summary.length > 40 ? `${summary.slice(0, 37)}…` : summary;
}

export function LargestCommitsChart({ rows }: Props) {
  const ranked = [...rows]
    .sort((a, b) => b.changedLines - a.changedLines || b.timestamp - a.timestamp)
    .slice(0, 6);

  if (ranked.length === 0) {
    return (
      <section className="commit-insight-card commit-insight-card-plot">
        <div className="commit-insight-card-header">
          <h3>Largest Commits</h3>
          <span className="commit-insight-caption">Biggest outliers by total changed lines</span>
        </div>
        <div className="commit-empty-state commit-empty-state-compact">No commits match the active filters.</div>
      </section>
    );
  }

  return (
    <section className="commit-insight-card commit-insight-card-plot">
      <div className="commit-insight-card-header">
        <h3>Largest Commits</h3>
        <span className="commit-insight-caption">Biggest outliers by total changed lines</span>
      </div>
      <Plot
        data={[
          {
            type: 'bar',
            orientation: 'h',
            y: ranked.map((entry) => truncateSummary(entry.summary)),
            x: ranked.map((entry) => entry.changedLines),
            text: ranked.map((entry) => `Δ ${entry.changedLines.toLocaleString()}`),
            textposition: 'outside',
            cliponaxis: false,
            marker: {
              color: ranked.map((_, index) => [
                'rgba(242, 157, 73, 0.95)',
                'rgba(244, 133, 72, 0.9)',
                'rgba(246, 109, 79, 0.88)',
                'rgba(248, 81, 73, 0.85)',
                'rgba(223, 89, 122, 0.83)',
                'rgba(191, 103, 171, 0.82)',
              ][index] ?? 'rgba(242, 157, 73, 0.85)'),
            },
            customdata: ranked.map((entry) => [entry.authorName, formatCommitDate(entry.committedAt), entry.sha.slice(0, 8)]),
            hovertemplate: '<b>%{y}</b><br>Δ %{x:,} lines<br>%{customdata[0]}<br>%{customdata[1]}<br>SHA %{customdata[2]}<extra></extra>',
          },
        ]}
        layout={{
          autosize: true,
          height: 320,
          margin: { l: 180, r: 24, t: 12, b: 44 },
          paper_bgcolor: 'transparent',
          plot_bgcolor: 'transparent',
          font: {
            family: 'var(--vscode-font-family)',
            size: 11,
            color: 'var(--vscode-foreground)',
          },
          xaxis: {
            title: { text: 'Changed lines' },
            gridcolor: 'var(--vscode-panel-border)',
            rangemode: 'tozero',
          },
          yaxis: {
            autorange: 'reversed',
            gridcolor: 'transparent',
          },
        }}
        config={{
          responsive: true,
          displaylogo: false,
          displayModeBar: false,
          scrollZoom: false,
        }}
        style={{ width: '100%' }}
      />
    </section>
  );
}
