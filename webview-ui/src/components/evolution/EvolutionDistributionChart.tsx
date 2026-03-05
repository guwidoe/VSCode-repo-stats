import Plot from 'react-plotly.js';
import type { ProcessedSeriesData } from './evolutionUtils';

interface Props {
  data: ProcessedSeriesData;
}

export function EvolutionDistributionChart({ data }: Props) {
  const latestValues = data.labels.map((label, index) => ({
    label,
    value: data.y[index]?.[data.y[index].length - 1] || 0,
  }));

  latestValues.sort((a, b) => b.value - a.value || a.label.localeCompare(b.label));

  return (
    <Plot
      data={[
        {
          type: 'bar',
          x: latestValues.map((entry) => entry.label),
          y: latestValues.map((entry) => entry.value),
          marker: {
            color: latestValues.map((entry) => entry.value),
            colorscale: 'Viridis',
            showscale: false,
          },
          hovertemplate: '%{x}<br>%{y:.2f}<extra></extra>',
        },
      ]}
      layout={{
        autosize: true,
        height: 320,
        margin: { l: 60, r: 20, t: 20, b: 100 },
        paper_bgcolor: 'transparent',
        plot_bgcolor: 'transparent',
        font: {
          family: 'var(--vscode-font-family)',
          size: 11,
          color: 'var(--vscode-foreground)',
        },
        xaxis: {
          tickangle: -40,
          gridcolor: 'var(--vscode-panel-border)',
        },
        yaxis: {
          title: { text: 'Latest Lines of Code' },
          gridcolor: 'var(--vscode-panel-border)',
        },
      }}
      config={{
        responsive: true,
        displayModeBar: true,
        displaylogo: false,
        modeBarButtonsToRemove: ['lasso2d', 'select2d', 'zoomOut2d'],
        scrollZoom: false,
      }}
      style={{ width: '100%' }}
    />
  );
}
