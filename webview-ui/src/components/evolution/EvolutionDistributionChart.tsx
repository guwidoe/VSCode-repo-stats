import Plot from 'react-plotly.js';
import type { ProcessedSeriesData } from './evolutionUtils';

interface Props {
  data: ProcessedSeriesData;
}

export function EvolutionDistributionChart({ data }: Props) {
  const seriesValues = data.seriesValues ?? data.y;
  const latestValues = data.labels.map((label, index) => ({
    label: String(label),
    value: seriesValues[index]?.[seriesValues[index].length - 1] ?? 0,
  }));

  latestValues.sort((a, b) => b.value - a.value || a.label.localeCompare(b.label));
  const categoryLabels = latestValues.map((entry) => entry.label);

  return (
    <Plot
      data={[
        {
          type: 'bar',
          x: categoryLabels,
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
          type: 'category',
          categoryorder: 'array',
          categoryarray: categoryLabels,
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
