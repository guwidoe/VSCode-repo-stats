import Plot from 'react-plotly.js';
import type { ProcessedSeriesData } from './evolutionUtils';
import { getEvolutionTimeAxisConfig } from './evolutionUtils';

interface Props {
  data: ProcessedSeriesData;
  normalize: boolean;
}

const PALETTE = [
  '#4E79A7', '#F28E2B', '#59A14F', '#E15759', '#76B7B2',
  '#EDC948', '#B07AA1', '#FF9DA7', '#9C755F', '#BAB0AC',
  '#72B7E2', '#FFB55A', '#7EB26D', '#F07C7E', '#9ED9D8',
];

export function EvolutionLineChart({ data, normalize }: Props) {
  const timeAxis = getEvolutionTimeAxisConfig(data);

  return (
    <Plot
      data={data.labels.map((label, index) => ({
        type: 'scatter',
        mode: 'lines',
        name: label,
        x: timeAxis.x,
        y: data.y[index],
        customdata: timeAxis.hoverLabels,
        line: {
          width: 2,
          color: PALETTE[index % PALETTE.length],
        },
        hovertemplate: '%{customdata}<br>%{y:.2f}<extra>' + label + '</extra>',
      }))}
      layout={{
        autosize: true,
        height: 320,
        margin: { l: 60, r: 20, t: 20, b: 80 },
        paper_bgcolor: 'transparent',
        plot_bgcolor: 'transparent',
        font: {
          family: 'var(--vscode-font-family)',
          size: 11,
          color: 'var(--vscode-foreground)',
        },
        hovermode: 'x unified',
        legend: {
          orientation: 'h',
          x: 0,
          y: -0.25,
        },
        xaxis: {
          type: 'date',
          tickformat: timeAxis.tickFormat,
          gridcolor: 'var(--vscode-panel-border)',
          tickangle: -40,
        },
        yaxis: {
          title: { text: normalize ? 'Share (%)' : 'Lines of Code' },
          range: normalize ? [0, 100] : undefined,
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
