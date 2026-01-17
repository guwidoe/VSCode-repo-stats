import React from 'react';
import Plot from 'react-plotly.js';

interface Props {
  data: Array<{ week: string; commits: number }>;
}

export const CommitsChart: React.FC<Props> = ({ data }) => {
  if (data.length === 0) {
    return null;
  }

  return (
    <div style={{ marginBottom: '24px' }}>
      <Plot
        data={[
          {
            x: data.map((d) => d.week),
            y: data.map((d) => d.commits),
            type: 'bar',
            marker: {
              color: 'var(--vscode-charts-blue, #0078d4)',
            },
            hovertemplate: '%{x}<br>%{y} commits<extra></extra>',
          },
        ]}
        layout={{
          title: {
            text: 'Commits Over Time',
            font: { size: 14 },
          },
          xaxis: {
            title: { text: 'Week' },
            tickangle: -45,
            tickfont: { size: 10 },
          },
          yaxis: {
            title: { text: 'Commits' },
          },
          margin: { l: 50, r: 20, t: 40, b: 80 },
          paper_bgcolor: 'transparent',
          plot_bgcolor: 'transparent',
          font: {
            color: 'var(--vscode-foreground, #cccccc)',
          },
          autosize: true,
        }}
        config={{
          responsive: true,
          displayModeBar: false,
        }}
        style={{ width: '100%', height: '300px' }}
      />
    </div>
  );
};
