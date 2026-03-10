import Plot from 'react-plotly.js';
import type { CommitStatBucket } from '../../types';
import { formatCommitBucketLabel } from '../../hooks/useCommitPanelState';
import { getCommitPlotTheme } from './plotTheme';

interface Props {
  title: string;
  buckets: CommitStatBucket[];
  color: string;
  valueLabel: string;
}

export function CommitDistributionChart({ title, buckets, color, valueLabel }: Props) {
  const theme = getCommitPlotTheme();

  return (
    <section className="commit-insight-card commit-insight-card-plot">
      <div className="commit-insight-card-header">
        <h3>{title}</h3>
        <span className="commit-insight-caption">Distribution across analyzed commits</span>
      </div>
      <Plot
        data={[
          {
            type: 'bar',
            x: buckets.map((bucket) => formatCommitBucketLabel(bucket.minInclusive, bucket.maxInclusive)),
            y: buckets.map((bucket) => bucket.count),
            marker: {
              color,
              line: { color: theme.border, width: 1 },
            },
            hovertemplate: `${valueLabel} %{x}<br>%{y:,} commits<extra></extra>`,
          },
        ]}
        layout={{
          autosize: true,
          height: 290,
          margin: { l: 48, r: 12, t: 12, b: 72 },
          paper_bgcolor: 'transparent',
          plot_bgcolor: 'transparent',
          font: {
            family: 'var(--vscode-font-family)',
            size: 11,
            color: theme.foreground,
          },
          xaxis: {
            title: { text: valueLabel, font: { color: theme.foreground } },
            tickfont: { color: theme.foreground },
            gridcolor: 'transparent',
            tickangle: -35,
            automargin: true,
          },
          yaxis: {
            title: { text: 'Commit count', font: { color: theme.foreground } },
            tickfont: { color: theme.foreground },
            gridcolor: theme.border,
            rangemode: 'tozero',
            automargin: true,
          },
          bargap: 0.16,
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
