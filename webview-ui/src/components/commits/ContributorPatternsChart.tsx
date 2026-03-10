import Plot from 'react-plotly.js';
import type { CommitContributorSummary } from '../../types';

interface Props {
  contributors: CommitContributorSummary[];
}

export function ContributorPatternsChart({ contributors }: Props) {
  const ranked = [...contributors]
    .sort((a, b) => b.averageChangedLines - a.averageChangedLines || b.totalCommits - a.totalCommits)
    .slice(0, 8);

  if (ranked.length === 0) {
    return (
      <section className="commit-insight-card commit-insight-card-plot">
        <div className="commit-insight-card-header">
          <h3>Contributor Commit-Size Patterns</h3>
          <span className="commit-insight-caption">Compare average vs median commit size for the heaviest contributors</span>
        </div>
        <div className="commit-empty-state commit-empty-state-compact">No contributor pattern data available.</div>
      </section>
    );
  }

  return (
    <section className="commit-insight-card commit-insight-card-plot">
      <div className="commit-insight-card-header">
        <h3>Contributor Commit-Size Patterns</h3>
        <span className="commit-insight-caption">Compare average vs median commit size for the heaviest contributors</span>
      </div>
      <Plot
        data={[
          {
            type: 'bar',
            orientation: 'h',
            name: 'Average Δ lines',
            y: ranked.map((entry) => entry.authorName),
            x: ranked.map((entry) => Math.round(entry.averageChangedLines)),
            text: ranked.map((entry) => `${entry.totalCommits.toLocaleString()} commits`),
            textposition: 'outside',
            cliponaxis: false,
            marker: {
              color: 'rgba(122, 162, 247, 0.92)',
            },
            customdata: ranked.map((entry) => [entry.totalCommits.toLocaleString(), Math.round(entry.medianChangedLines).toLocaleString()]),
            hovertemplate: '<b>%{y}</b><br>Average Δ %{x:,}<br>Median Δ %{customdata[1]}<br>%{customdata[0]} commits<extra></extra>',
          },
          {
            type: 'bar',
            orientation: 'h',
            name: 'Median Δ lines',
            y: ranked.map((entry) => entry.authorName),
            x: ranked.map((entry) => Math.round(entry.medianChangedLines)),
            marker: {
              color: 'rgba(95, 215, 140, 0.9)',
            },
            hovertemplate: '<b>%{y}</b><br>Median Δ %{x:,}<extra></extra>',
          },
        ]}
        layout={{
          autosize: true,
          height: 320,
          margin: { l: 116, r: 24, t: 12, b: 44 },
          paper_bgcolor: 'transparent',
          plot_bgcolor: 'transparent',
          font: {
            family: 'var(--vscode-font-family)',
            size: 11,
            color: 'var(--vscode-foreground)',
          },
          barmode: 'group',
          legend: {
            orientation: 'h',
            x: 0,
            y: 1.15,
          },
          xaxis: {
            title: { text: 'Changed lines per commit' },
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
