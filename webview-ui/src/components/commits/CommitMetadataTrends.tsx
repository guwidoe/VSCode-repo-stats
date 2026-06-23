import { useMemo, useState } from 'react';
import { AlertTriangle, BarChart3, ListFilter } from 'lucide-react';
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
import {
  COMMIT_METADATA_METRIC_LABELS,
  CommitMetadataPlot,
  formatCommitMetadataMetric,
  getCommitMetadataPointMetric,
} from './CommitMetadataPlot';
import type { CommitTableRow } from './types';
import './CommitMetadataTrends.css';

interface CommitMetadataTrendsProps {
  analytics: NonNullable<import('../../types').AnalysisResult['commitAnalytics']>;
  settings: CommitMetadataSettings;
  rows: CommitTableRow[];
  onOpenSettings?: () => void;
}

const CALENDAR_LABELS: Record<CommitMetadataCalendarGranularity, string> = {
  day: 'Day',
  week: 'Week',
  month: 'Month',
  quarter: 'Quarter',
  year: 'Year',
};

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
          <p>Interactive chart of commit metadata over calendar time or equalized commit buckets. Use zoom/pan for dense histories and click marks to inspect commits.</p>
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
            {(Object.keys(COMMIT_METADATA_METRIC_LABELS) as CommitMetadataMetric[]).map((metricKey) => (
              <option key={metricKey} value={metricKey}>{COMMIT_METADATA_METRIC_LABELS[metricKey]}</option>
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
        <CommitMetadataPlot
          result={result}
          metric={metric}
          chartType={chartType}
          bucketMode={bucketMode}
          onSelectPoint={setSelectedPoint}
        />
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
              <p>{formatCommitMetadataMetric(getCommitMetadataPointMetric(selectedPoint, metric), metric)} {COMMIT_METADATA_METRIC_LABELS[metric].toLowerCase()} across {selectedRows.length.toLocaleString()} commits</p>
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

