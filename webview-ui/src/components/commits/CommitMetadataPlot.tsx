import Plot from 'react-plotly.js';
import type {
  CommitMetadataBucketMode,
  CommitMetadataChartType,
  CommitMetadataMetric,
  CommitMetadataSeriesPoint,
  CommitMetadataTrendResult,
} from '../../types';

interface CommitMetadataPlotProps {
  result: CommitMetadataTrendResult;
  metric: CommitMetadataMetric;
  chartType: CommitMetadataChartType;
  bucketMode: CommitMetadataBucketMode;
  onSelectPoint: (point: CommitMetadataSeriesPoint) => void;
}

interface PlotClickEvent {
  points?: Array<{
    customdata?: unknown;
  }>;
}

export const COMMIT_METADATA_SERIES_COLORS = [
  '#58a6ff',
  '#a371f7',
  '#3fb950',
  '#d29922',
  '#f85149',
  '#39c5cf',
  '#ff7b72',
  '#bc8cff',
  '#56d364',
  '#db61a2',
  '#79c0ff',
  '#a5d6ff',
];

export const COMMIT_METADATA_METRIC_LABELS: Record<CommitMetadataMetric, string> = {
  commits: 'Commits',
  additions: 'Additions',
  deletions: 'Deletions',
  changedLines: 'Changed lines',
  filesChanged: 'Files changed',
};

export function getCommitMetadataPointMetric(point: CommitMetadataSeriesPoint, metric: CommitMetadataMetric): number {
  return point[metric];
}

export function formatCommitMetadataMetric(value: number, metric: CommitMetadataMetric): string {
  const rounded = metric === 'commits' ? Number(value.toFixed(2)) : Math.round(value);
  return rounded.toLocaleString();
}

function getSeriesValues(series: CommitMetadataSeriesPoint[]): string[] {
  return Array.from(new Set(series.map((point) => point.value))).sort((a, b) => a.localeCompare(b));
}

function createPointKey(point: CommitMetadataSeriesPoint): string {
  return `${point.bucketId}\u0000${point.value}`;
}

function getChartHeight(bucketCount: number, seriesCount: number, chartType: CommitMetadataChartType): number {
  if (chartType === 'heatmap') {
    return Math.min(620, Math.max(360, 170 + seriesCount * 30));
  }

  return bucketCount > 36 ? 500 : 430;
}

export function CommitMetadataPlot({ result, metric, chartType, bucketMode, onSelectPoint }: CommitMetadataPlotProps) {
  const seriesValues = getSeriesValues(result.series);
  const colorByValue = new Map(seriesValues.map((value, index) => [
    value,
    COMMIT_METADATA_SERIES_COLORS[index % COMMIT_METADATA_SERIES_COLORS.length],
  ]));
  const pointByKey = new Map(result.series.map((point) => [createPointKey(point), point]));

  const handlePlotClick = (event: PlotClickEvent) => {
    const key = event.points?.[0]?.customdata;
    if (typeof key !== 'string') {
      return;
    }

    const point = pointByKey.get(key);
    if (point) {
      onSelectPoint(point);
    }
  };

  return (
    <div className="commit-metadata-plot-shell">
      <Plot
        data={buildPlotData(result, metric, chartType, seriesValues, colorByValue)}
        layout={{
          autosize: true,
          height: getChartHeight(result.buckets.length, seriesValues.length, chartType),
          margin: { l: chartType === 'heatmap' ? 120 : 58, r: 24, t: 18, b: 78 },
          paper_bgcolor: 'transparent',
          plot_bgcolor: 'transparent',
          font: {
            family: 'var(--vscode-font-family)',
            size: 11,
            color: 'var(--vscode-foreground)',
          },
          barmode: 'stack',
          bargap: 0.12,
          hovermode: 'closest',
          dragmode: 'pan',
          xaxis: {
            type: 'category',
            title: { text: bucketMode === 'calendar' ? 'Calendar bucket' : 'Commit bucket' },
            tickangle: -45,
            gridcolor: 'var(--vscode-panel-border)',
            zerolinecolor: 'var(--vscode-panel-border)',
            showgrid: false,
            automargin: true,
            nticks: 14,
          },
          yaxis: {
            title: { text: chartType === 'normalizedStackedBar' ? 'Share of bucket' : COMMIT_METADATA_METRIC_LABELS[metric] },
            gridcolor: 'var(--vscode-panel-border)',
            zerolinecolor: 'var(--vscode-panel-border)',
            ticksuffix: chartType === 'normalizedStackedBar' ? '%' : undefined,
            automargin: true,
          },
          legend: {
            orientation: 'h',
            x: 0,
            y: 1.16,
            xanchor: 'left',
            yanchor: 'bottom',
          },
        }}
        config={{
          responsive: true,
          displayModeBar: true,
          displaylogo: false,
          modeBarButtonsToRemove: ['lasso2d', 'select2d', 'zoomOut2d'],
          scrollZoom: true,
        }}
        style={{ width: '100%' }}
        onClick={handlePlotClick}
      />
    </div>
  );
}

function buildPlotData(
  result: CommitMetadataTrendResult,
  metric: CommitMetadataMetric,
  chartType: CommitMetadataChartType,
  seriesValues: string[],
  colorByValue: Map<string, string>
) {
  if (chartType === 'heatmap') {
    return buildHeatmapPlotData(result, metric, seriesValues);
  }

  return buildStackedBarPlotData(result, metric, chartType === 'normalizedStackedBar', seriesValues, colorByValue);
}

function buildStackedBarPlotData(
  result: CommitMetadataTrendResult,
  metric: CommitMetadataMetric,
  normalized: boolean,
  seriesValues: string[],
  colorByValue: Map<string, string>
) {
  const bucketLabels = result.buckets.map((bucket) => bucket.label);
  const bucketTotals = new Map(result.buckets.map((bucket) => [
    bucket.id,
    result.series
      .filter((point) => point.bucketId === bucket.id)
      .reduce((sum, point) => sum + getCommitMetadataPointMetric(point, metric), 0),
  ]));

  return seriesValues.map((seriesValue) => ({
    type: 'bar' as const,
    name: seriesValue,
    x: bucketLabels,
    y: result.buckets.map((bucket) => {
      const point = result.series.find((candidate) => candidate.bucketId === bucket.id && candidate.value === seriesValue);
      const value = point ? getCommitMetadataPointMetric(point, metric) : 0;
      const total = bucketTotals.get(bucket.id) ?? 0;
      return normalized && total > 0 ? (value / total) * 100 : value;
    }),
    marker: {
      color: colorByValue.get(seriesValue),
    },
    customdata: result.buckets.map((bucket) => {
      const point = result.series.find((candidate) => candidate.bucketId === bucket.id && candidate.value === seriesValue);
      return point ? createPointKey(point) : '';
    }),
    text: result.buckets.map((bucket) => {
      const point = result.series.find((candidate) => candidate.bucketId === bucket.id && candidate.value === seriesValue);
      return point ? formatCommitMetadataMetric(getCommitMetadataPointMetric(point, metric), metric) : '0';
    }),
    hovertemplate: normalized
      ? `%{x}<br>${seriesValue}: %{text} (${COMMIT_METADATA_METRIC_LABELS[metric]})<br>%{y:.1f}% of bucket<extra></extra>`
      : `%{x}<br>${seriesValue}: %{text} ${COMMIT_METADATA_METRIC_LABELS[metric].toLowerCase()}<extra></extra>`,
  }));
}

function buildHeatmapPlotData(
  result: CommitMetadataTrendResult,
  metric: CommitMetadataMetric,
  seriesValues: string[]
) {
  const bucketLabels = result.buckets.map((bucket) => bucket.label);
  return [{
    type: 'heatmap' as const,
    x: bucketLabels,
    y: seriesValues,
    z: seriesValues.map((seriesValue) => result.buckets.map((bucket) => {
      const point = result.series.find((candidate) => candidate.bucketId === bucket.id && candidate.value === seriesValue);
      return point ? getCommitMetadataPointMetric(point, metric) : 0;
    })),
    customdata: seriesValues.map((seriesValue) => result.buckets.map((bucket) => {
      const point = result.series.find((candidate) => candidate.bucketId === bucket.id && candidate.value === seriesValue);
      return point ? createPointKey(point) : '';
    })),
    colorscale: 'Blues',
    colorbar: {
      title: { text: COMMIT_METADATA_METRIC_LABELS[metric] },
      thickness: 12,
    },
    hovertemplate: `%{x}<br>%{y}: %{z} ${COMMIT_METADATA_METRIC_LABELS[metric].toLowerCase()}<extra></extra>`,
  }];
}
