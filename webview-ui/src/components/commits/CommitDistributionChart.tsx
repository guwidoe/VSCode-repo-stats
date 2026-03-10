import Plot from 'react-plotly.js';
import type { CommitStatBucket } from '../../types';
import { formatCommitBucketLabel } from '../../hooks/useCommitPanelState';

interface Props {
  title: string;
  buckets: CommitStatBucket[];
  color: string;
  valueLabel: string;
}

export function CommitDistributionChart({ title, buckets, color, valueLabel }: Props) {
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
              line: { color: 'rgba(255,255,255,0.18)', width: 1 },
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
            color: 'var(--vscode-foreground)',
          },
          xaxis: {
            title: { text: valueLabel },
            gridcolor: 'transparent',
            tickangle: -35,
          },
          yaxis: {
            title: { text: 'Commit count' },
            gridcolor: 'var(--vscode-panel-border)',
            rangemode: 'tozero',
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
