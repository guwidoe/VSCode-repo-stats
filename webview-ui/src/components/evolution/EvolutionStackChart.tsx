import Plot from 'react-plotly.js';
import type { ProcessedSeriesData, EvolutionAxisMode } from './evolutionUtils';
import { getEvolutionTimeAxisConfig } from './evolutionUtils';

interface Props {
  data: ProcessedSeriesData;
  normalize: boolean;
  axisMode?: EvolutionAxisMode;
}

const PALETTE = [
  '#4E79A7', '#F28E2B', '#59A14F', '#E15759', '#76B7B2',
  '#EDC948', '#B07AA1', '#FF9DA7', '#9C755F', '#BAB0AC',
  '#72B7E2', '#FFB55A', '#7EB26D', '#F07C7E', '#9ED9D8',
];

export function EvolutionStackChart({ data, normalize, axisMode = 'time' }: Props) {
  const timeAxis = getEvolutionTimeAxisConfig(data, axisMode);
  const seriesValues = data.seriesValues ?? data.y;

  return (
    <Plot
      data={data.labels.map((label, index) => ({
        type: 'scatter',
        mode: 'lines',
        name: label,
        x: timeAxis.x,
        y: seriesValues[index],
        customdata: timeAxis.hoverLabels,
        stackgroup: 'one',
        stackgaps: 'interpolate',
        connectgaps: true,
        line: { width: 0.8, color: 'rgba(255,255,255,0.25)' },
        fillcolor: PALETTE[index % PALETTE.length],
        hovertemplate: `<b>${label}</b><br>%{customdata}<br>Value %{y:.2f}<extra></extra>`,
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
        hovermode: 'closest',
        hoverlabel: {
          bgcolor: 'var(--vscode-editorWidget-background)',
          bordercolor: 'var(--vscode-editorWidget-border)',
          font: { color: 'var(--vscode-editorWidget-foreground)', size: 11 },
          align: 'left',
          namelength: 48,
        },
        legend: {
          orientation: 'h',
          x: 0,
          y: -0.25,
        },
        xaxis: {
          type: timeAxis.axisType,
          title: { text: timeAxis.axisTitle },
          tickformat: timeAxis.tickFormat,
          tickprefix: timeAxis.tickPrefix,
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
