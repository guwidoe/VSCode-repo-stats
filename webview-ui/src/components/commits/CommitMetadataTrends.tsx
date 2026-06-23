import { Fragment, useMemo, useState } from 'react';
import { AlertTriangle, BarChart3, Grid3X3, ListFilter } from 'lucide-react';
import { analyzeCommitMetadataTrends } from '@analyzers/commitMetadata.js';
import type {
  CommitMetadataBucketMode,
  CommitMetadataCalendarGranularity,
  CommitMetadataChartType,
  CommitMetadataCommitBucketStrategy,
  CommitMetadataMetric,
  CommitMetadataSeriesPoint,
  CommitMetadataSettings,
} from '../../types';
import type { CommitTableRow } from './types';
import './CommitMetadataTrends.css';

interface CommitMetadataTrendsProps {
  analytics: NonNullable<import('../../types').AnalysisResult['commitAnalytics']>;
  settings: CommitMetadataSettings;
  rows: CommitTableRow[];
  onOpenSettings?: () => void;
}

const SERIES_COLORS = [
  '#60a5fa',
  '#a78bfa',
  '#34d399',
  '#fbbf24',
  '#fb7185',
  '#22d3ee',
  '#f97316',
  '#c084fc',
  '#4ade80',
  '#f472b6',
  '#93c5fd',
  '#d9f99d',
];

const METRIC_LABELS: Record<CommitMetadataMetric, string> = {
  commits: 'Commits',
  additions: 'Additions',
  deletions: 'Deletions',
  changedLines: 'Changed lines',
  filesChanged: 'Files changed',
};

const CALENDAR_LABELS: Record<CommitMetadataCalendarGranularity, string> = {
  day: 'Day',
  week: 'Week',
  month: 'Month',
  quarter: 'Quarter',
  year: 'Year',
};

function getPointMetric(point: CommitMetadataSeriesPoint, metric: CommitMetadataMetric): number {
  return point[metric];
}

function formatMetric(value: number, metric: CommitMetadataMetric): string {
  const rounded = metric === 'commits' ? Number(value.toFixed(2)) : Math.round(value);
  return rounded.toLocaleString();
}

function getSeriesValues(series: CommitMetadataSeriesPoint[]): string[] {
  return Array.from(new Set(series.map((point) => point.value))).sort((a, b) => a.localeCompare(b));
}

export function CommitMetadataTrends({ analytics, settings, rows, onOpenSettings }: CommitMetadataTrendsProps) {
  const enabledExtractors = useMemo(
    () => settings.extractors.filter((extractor) => extractor.enabled),
    [settings.extractors]
  );
  const [extractorId, setExtractorId] = useState(settings.defaultExtractorId);
  const [bucketMode, setBucketMode] = useState<CommitMetadataBucketMode>(settings.defaultBucketMode);
  const [calendarGranularity, setCalendarGranularity] = useState<CommitMetadataCalendarGranularity>(settings.defaultCalendarGranularity);
  const [commitBucketStrategy, setCommitBucketStrategy] = useState<CommitMetadataCommitBucketStrategy>(settings.defaultCommitBucketStrategy);
  const [commitBucketSize, setCommitBucketSize] = useState(settings.defaultCommitBucketSize);
  const [commitBucketCount, setCommitBucketCount] = useState(settings.defaultCommitBucketCount);
  const [metric, setMetric] = useState<CommitMetadataMetric>(settings.defaultMetric);
  const [chartType, setChartType] = useState<CommitMetadataChartType>(settings.defaultChartType);
  const [maxSeries, setMaxSeries] = useState(settings.maxSeries);
  const [includeUncategorized, setIncludeUncategorized] = useState(settings.includeUncategorized);
  const [selectedPoint, setSelectedPoint] = useState<CommitMetadataSeriesPoint | null>(null);

  const result = useMemo(() => {
    if (enabledExtractors.length === 0) {
      return null;
    }

    return analyzeCommitMetadataTrends(analytics, settings, {
      extractorId,
      bucketMode,
      calendarGranularity,
      commitBucketStrategy,
      commitBucketSize,
      commitBucketCount,
      metric,
      maxSeries,
      includeUncategorized,
      includeOtherSeries: settings.includeOtherSeries,
      multiValueMode: settings.multiValueMode,
    });
  }, [
    analytics,
    bucketMode,
    calendarGranularity,
    commitBucketCount,
    commitBucketSize,
    commitBucketStrategy,
    enabledExtractors.length,
    extractorId,
    includeUncategorized,
    maxSeries,
    metric,
    settings,
  ]);

  const selectedRows = useMemo(() => {
    if (!selectedPoint) {
      return [];
    }

    const selectedShas = new Set(selectedPoint.commitShas);
    return rows.filter((row) => selectedShas.has(row.sha));
  }, [rows, selectedPoint]);

  const seriesValues = useMemo(() => getSeriesValues(result?.series ?? []), [result?.series]);
  const colorByValue = useMemo(() => new Map(seriesValues.map((value, index) => [
    value,
    SERIES_COLORS[index % SERIES_COLORS.length],
  ])), [seriesValues]);

  if (enabledExtractors.length === 0) {
    return (
      <section className="commit-metadata-card">
        <div className="commit-metadata-empty">
          <BarChart3 size={28} />
          <h3>No metadata extractors enabled</h3>
          <p>Enable built-in extractors or add a custom regex extractor in Commit Metadata settings.</p>
          {onOpenSettings && (
            <button type="button" className="commit-metadata-primary" onClick={onOpenSettings}>Open settings</button>
          )}
        </div>
      </section>
    );
  }

  return (
    <section className="commit-metadata-card">
      <div className="commit-metadata-header">
        <div>
          <h3>Metadata Trends</h3>
          <p>Explore commit message categories, authors, repositories, size buckets, directories, and extensions over calendar or commit-count buckets.</p>
        </div>
        {result?.diagnostics.availability !== 'available' && (
          <div className="commit-metadata-diagnostic" role="status">
            <AlertTriangle size={15} />
            <span>{result?.diagnostics.availability === 'partial' ? 'Partial metadata' : 'Metadata unavailable'}</span>
          </div>
        )}
      </div>

      <div className="commit-metadata-controls">
        <label>
          <span>Analyze</span>
          <select value={extractorId} onChange={(event) => setExtractorId(event.target.value)}>
            {enabledExtractors.map((extractor) => (
              <option key={extractor.id} value={extractor.id}>{extractor.name}</option>
            ))}
          </select>
        </label>

        <label>
          <span>Bucket by</span>
          <select value={bucketMode} onChange={(event) => setBucketMode(event.target.value as CommitMetadataBucketMode)}>
            <option value="calendar">Calendar</option>
            <option value="commitCount">Commit count</option>
          </select>
        </label>

        {bucketMode === 'calendar' ? (
          <label>
            <span>Granularity</span>
            <select value={calendarGranularity} onChange={(event) => setCalendarGranularity(event.target.value as CommitMetadataCalendarGranularity)}>
              {(Object.keys(CALENDAR_LABELS) as CommitMetadataCalendarGranularity[]).map((granularity) => (
                <option key={granularity} value={granularity}>{CALENDAR_LABELS[granularity]}</option>
              ))}
            </select>
          </label>
        ) : (
          <>
            <label>
              <span>Commit buckets</span>
              <select value={commitBucketStrategy} onChange={(event) => setCommitBucketStrategy(event.target.value as CommitMetadataCommitBucketStrategy)}>
                <option value="fixedSize">Every N commits</option>
                <option value="equalBuckets">Equal buckets</option>
              </select>
            </label>
            <label>
              <span>{commitBucketStrategy === 'fixedSize' ? 'Bucket size' : 'Bucket count'}</span>
              <input
                type="number"
                min={1}
                value={commitBucketStrategy === 'fixedSize' ? commitBucketSize : commitBucketCount}
                onChange={(event) => {
                  const value = Math.max(1, Number(event.target.value) || 1);
                  if (commitBucketStrategy === 'fixedSize') {
                    setCommitBucketSize(value);
                  } else {
                    setCommitBucketCount(value);
                  }
                }}
              />
            </label>
          </>
        )}

        <label>
          <span>Metric</span>
          <select value={metric} onChange={(event) => setMetric(event.target.value as CommitMetadataMetric)}>
            {(Object.keys(METRIC_LABELS) as CommitMetadataMetric[]).map((metricKey) => (
              <option key={metricKey} value={metricKey}>{METRIC_LABELS[metricKey]}</option>
            ))}
          </select>
        </label>

        <label>
          <span>Chart</span>
          <select value={chartType} onChange={(event) => setChartType(event.target.value as CommitMetadataChartType)}>
            <option value="stackedBar">Stacked bar</option>
            <option value="normalizedStackedBar">100% stacked</option>
            <option value="heatmap">Heatmap</option>
          </select>
        </label>

        <label>
          <span>Series</span>
          <input type="number" min={1} max={100} value={maxSeries} onChange={(event) => setMaxSeries(Math.max(1, Number(event.target.value) || 1))} />
        </label>

        <label className="commit-metadata-checkbox">
          <input type="checkbox" checked={includeUncategorized} onChange={(event) => setIncludeUncategorized(event.target.checked)} />
          <span>Uncategorized</span>
        </label>
      </div>

      {result && result.series.length > 0 ? (
        <>
          {chartType === 'heatmap'
            ? renderCommitMetadataHeatmap({ result, metric, colorByValue, onSelectPoint: setSelectedPoint })
            : renderCommitMetadataStackedBars({
                result,
                metric,
                normalized: chartType === 'normalizedStackedBar',
                colorByValue,
                onSelectPoint: setSelectedPoint,
              })}

          <div className="commit-metadata-legend">
            {seriesValues.map((value) => (
              <span key={value} className="commit-metadata-legend-item">
                <span style={{ background: colorByValue.get(value) }} />
                {value}
              </span>
            ))}
          </div>
        </>
      ) : (
        <div className="commit-metadata-empty commit-metadata-empty-inline">
          <ListFilter size={24} />
          <h3>No matching metadata</h3>
          <p>Try another extractor, include uncategorized commits, or configure a custom regex extractor.</p>
          {onOpenSettings && <button type="button" onClick={onOpenSettings}>Configure extractors</button>}
        </div>
      )}

      {result?.diagnostics.notes.length ? (
        <ul className="commit-metadata-notes">
          {result.diagnostics.notes.map((note) => <li key={note}>{note}</li>)}
        </ul>
      ) : null}

      {selectedPoint && (
        <div className="commit-metadata-drilldown">
          <div className="commit-metadata-drilldown-header">
            <div>
              <h4>{selectedPoint.value} in {result?.buckets.find((bucket) => bucket.id === selectedPoint.bucketId)?.label ?? selectedPoint.bucketId}</h4>
              <p>{formatMetric(getPointMetric(selectedPoint, metric), metric)} {METRIC_LABELS[metric].toLowerCase()} across {selectedRows.length.toLocaleString()} commits</p>
            </div>
            <button type="button" onClick={() => setSelectedPoint(null)}>Clear</button>
          </div>
          <div className="commit-metadata-drilldown-list">
            {selectedRows.slice(0, 25).map((row) => (
              <div key={row.sha} className="commit-metadata-drilldown-row">
                <code>{row.sha.slice(0, 8)}</code>
                <span>{row.summary}</span>
                <small>{row.authorName} • {new Date(row.committedAt).toLocaleDateString()}</small>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function renderCommitMetadataStackedBars({
  result,
  metric,
  normalized,
  colorByValue,
  onSelectPoint,
}: {
  result: NonNullable<ReturnType<typeof analyzeCommitMetadataTrends>>;
  metric: CommitMetadataMetric;
  normalized: boolean;
  colorByValue: Map<string, string>;
  onSelectPoint: (point: CommitMetadataSeriesPoint) => void;
}) {
  const maxBucketTotal = Math.max(1, ...result.buckets.map((bucket) => result.series
    .filter((point) => point.bucketId === bucket.id)
    .reduce((sum, point) => sum + getPointMetric(point, metric), 0)));

  return (
    <div className="commit-metadata-bars" role="img" aria-label="Commit metadata stacked bar chart">
      {result.buckets.map((bucket) => {
        const points = result.series.filter((point) => point.bucketId === bucket.id);
        const total = points.reduce((sum, point) => sum + getPointMetric(point, metric), 0);
        const denominator = normalized ? Math.max(1, total) : maxBucketTotal;
        return (
          <div key={bucket.id} className="commit-metadata-bar-row">
            <span className="commit-metadata-bucket-label">{bucket.label}</span>
            <div className="commit-metadata-bar-track">
              {points.map((point) => {
                const value = getPointMetric(point, metric);
                const width = total === 0 ? 0 : (value / denominator) * 100;
                return (
                  <button
                    key={`${point.bucketId}-${point.value}`}
                    type="button"
                    className="commit-metadata-bar-segment"
                    style={{ width: `${width}%`, background: colorByValue.get(point.value) }}
                    title={`${point.value}: ${formatMetric(value, metric)}`}
                    onClick={() => onSelectPoint(point)}
                  />
                );
              })}
            </div>
            <span className="commit-metadata-total">{formatMetric(total, metric)}</span>
          </div>
        );
      })}
    </div>
  );
}

function renderCommitMetadataHeatmap({
  result,
  metric,
  colorByValue,
  onSelectPoint,
}: {
  result: NonNullable<ReturnType<typeof analyzeCommitMetadataTrends>>;
  metric: CommitMetadataMetric;
  colorByValue: Map<string, string>;
  onSelectPoint: (point: CommitMetadataSeriesPoint) => void;
}) {
  const values = getSeriesValues(result.series);
  const maxValue = Math.max(1, ...result.series.map((point) => getPointMetric(point, metric)));

  return (
    <div className="commit-metadata-heatmap">
      <div className="commit-metadata-heatmap-title"><Grid3X3 size={15} /> Heatmap by bucket</div>
      <div className="commit-metadata-heatmap-grid" style={{ gridTemplateColumns: `minmax(120px, 1fr) repeat(${result.buckets.length}, minmax(64px, 1fr))` }}>
        <div className="commit-metadata-heatmap-corner" />
        {result.buckets.map((bucket) => <div key={bucket.id} className="commit-metadata-heatmap-axis">{bucket.label}</div>)}
        {values.map((value) => (
          <Fragment key={value}>
            {renderHeatmapRow({ value, result, metric, maxValue, color: colorByValue.get(value) ?? '#60a5fa', onSelectPoint })}
          </Fragment>
        ))}
      </div>
    </div>
  );
}

function renderHeatmapRow({
  value,
  result,
  metric,
  maxValue,
  color,
  onSelectPoint,
}: {
  value: string;
  result: NonNullable<ReturnType<typeof analyzeCommitMetadataTrends>>;
  metric: CommitMetadataMetric;
  maxValue: number;
  color: string;
  onSelectPoint: (point: CommitMetadataSeriesPoint) => void;
}) {
  return (
    <>
      <div className="commit-metadata-heatmap-label">{value}</div>
      {result.buckets.map((bucket) => {
        const point = result.series.find((candidate) => candidate.bucketId === bucket.id && candidate.value === value);
        const metricValue = point ? getPointMetric(point, metric) : 0;
        const opacity = metricValue === 0 ? 0.08 : Math.max(0.2, metricValue / maxValue);
        return (
          <button
            key={`${value}-${bucket.id}`}
            type="button"
            className="commit-metadata-heatmap-cell"
            style={{ background: color, opacity }}
            title={`${value} / ${bucket.label}: ${formatMetric(metricValue, metric)}`}
            disabled={!point}
            onClick={() => point && onSelectPoint(point)}
          >
            {metricValue > 0 ? formatMetric(metricValue, metric) : ''}
          </button>
        );
      })}
    </>
  );
}
