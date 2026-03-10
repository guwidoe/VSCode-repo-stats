import type {
  EvolutionDimension,
  EvolutionSnapshotPoint,
  EvolutionTimeSeriesData,
} from '../../types';

export interface ProcessedSeriesData {
  snapshots: EvolutionSnapshotPoint[];
  ts: string[];
  labels: string[];
  y: Array<Array<number | null>>;
}

export type EvolutionAxisMode = 'time' | 'commit';

export type EvolutionTimeGranularity =
  | 'daily'
  | 'weekly'
  | 'biweekly'
  | 'monthly'
  | 'quarterly'
  | 'yearly';

export interface EvolutionTimeAxisConfig {
  x: Array<string | number>;
  axisType: 'date' | 'linear';
  axisTitle: string;
  granularity: EvolutionTimeGranularity;
  hoverLabels: string[];
  tickFormat: string;
  tickPrefix?: string;
}

export function processEvolutionSeries(
  data: EvolutionTimeSeriesData,
  maxSeries: number,
  normalize: boolean,
  dimension: EvolutionDimension,
  showInactivePeriods: boolean = false
): ProcessedSeriesData {
  const baseTs = data.ts;
  const baseSnapshots = data.snapshots ?? baseTs.map((committedAt, index) => ({
    commitSha: '',
    commitIndex: index,
    totalCommitCount: baseTs.length,
    committedAt,
    samplingMode: 'time' as const,
  }));
  const labels = [...data.labels];
  const baseY = data.y.map((series) => [...series]);
  const expanded = showInactivePeriods
    ? fillInactivePeriods(baseSnapshots, baseY)
    : { snapshots: baseSnapshots, ts: baseTs, y: baseY };
  const ts = expanded.ts;
  const snapshots = expanded.snapshots;
  const y = expanded.y;

  const indexed = labels.map((label, index) => {
    const series = y[index] || [];
    return {
      label,
      index,
      max: getSeriesMax(series),
      latest: getSeriesLatestObserved(series),
    };
  });

  indexed.sort((a, b) => b.latest - a.latest || b.max - a.max || a.label.localeCompare(b.label));

  const top = indexed.slice(0, Math.max(1, maxSeries));
  const rest = indexed.slice(Math.max(1, maxSeries));

  let outLabels = top.map((entry) => entry.label);
  let outY = top.map((entry) => y[entry.index] || Array(ts.length).fill(0));

  if (rest.length > 0) {
    const other = Array(ts.length).fill(0);
    for (const entry of rest) {
      const series = y[entry.index] ?? [];
      for (let i = 0; i < ts.length; i++) {
        other[i] += series[i] ?? 0;
      }
    }
    outLabels.push('Other');
    outY.push(other);
  }

  if (dimension === 'cohort') {
    const zipped = outLabels.map((label, index) => ({
      label,
      series: outY[index],
      isOther: label === 'Other',
      key: cohortSortKey(label),
    }));

    zipped.sort((a, b) => {
      if (a.isOther && b.isOther) {
        return 0;
      }
      if (a.isOther) {
        return 1;
      }
      if (b.isOther) {
        return -1;
      }
      if (a.key !== b.key) {
        return a.key - b.key;
      }
      return a.label.localeCompare(b.label);
    });

    outLabels = zipped.map((entry) => entry.label);
    outY = zipped.map((entry) => entry.series);
  }

  if (!normalize) {
    return { snapshots, ts, labels: outLabels, y: outY };
  }

  const normalized = outY.map((series) => [...series]);
  for (let i = 0; i < ts.length; i++) {
    let total = 0;
    for (const series of normalized) {
      const value = series[i];
      if (value !== null && value !== undefined) {
        total += value;
      }
    }

    if (total <= 0) {
      continue;
    }

    for (const series of normalized) {
      const value = series[i];
      if (value !== null && value !== undefined) {
        series[i] = (100 * value) / total;
      }
    }
  }

  return {
    snapshots,
    ts,
    labels: outLabels,
    y: normalized,
  };
}

export function getEvolutionTimeAxisConfig(
  data: {
    ts: string[];
    snapshots?: EvolutionSnapshotPoint[];
  },
  axisMode: EvolutionAxisMode = 'time'
): EvolutionTimeAxisConfig {
  const granularity = inferEvolutionTimeGranularity(data.ts);
  const snapshots = data.snapshots ?? [];
  const hoverLabels = data.ts.map((isoDate, index) => formatSnapshotHoverLabel(snapshots[index], isoDate, granularity));

  if (axisMode === 'commit') {
    return {
      x: snapshots.map((snapshot, index) => {
        if (snapshot && snapshot.totalCommitCount > 0) {
          return snapshot.commitIndex + 1;
        }
        return index + 1;
      }),
      axisType: 'linear',
      axisTitle: 'Commit progression',
      granularity,
      hoverLabels,
      tickFormat: ',d',
      tickPrefix: '#',
    };
  }

  return {
    x: data.ts,
    axisType: 'date',
    axisTitle: 'Time',
    granularity,
    hoverLabels,
    tickFormat: getPlotlyTickFormat(granularity),
  };
}

export function inferEvolutionTimeGranularity(ts: string[]): EvolutionTimeGranularity {
  const timestamps = ts
    .map((value) => new Date(value).getTime())
    .filter((value) => Number.isFinite(value))
    .sort((a, b) => a - b);

  if (timestamps.length < 2) {
    return 'daily';
  }

  const gapDays: number[] = [];
  for (let i = 1; i < timestamps.length; i++) {
    const diffMs = timestamps[i] - timestamps[i - 1];
    if (diffMs > 0) {
      gapDays.push(diffMs / 86400000);
    }
  }

  if (gapDays.length === 0) {
    return 'daily';
  }

  const sortedGapDays = [...gapDays].sort((a, b) => a - b);
  const mid = Math.floor(sortedGapDays.length / 2);
  const medianGapDays =
    sortedGapDays.length % 2 === 0
      ? (sortedGapDays[mid - 1] + sortedGapDays[mid]) / 2
      : sortedGapDays[mid];

  if (medianGapDays <= 3) {
    return 'daily';
  }
  if (medianGapDays <= 10) {
    return 'weekly';
  }
  if (medianGapDays <= 21) {
    return 'biweekly';
  }
  if (medianGapDays <= 60) {
    return 'monthly';
  }
  if (medianGapDays <= 180) {
    return 'quarterly';
  }
  return 'yearly';
}

function getSeriesMax(series: Array<number | null>): number {
  let max = 0;
  for (const value of series) {
    if (value !== null && value !== undefined && value > max) {
      max = value;
    }
  }
  return max;
}

function getSeriesLatestObserved(series: Array<number | null>): number {
  for (let index = series.length - 1; index >= 0; index--) {
    const value = series[index];
    if (value !== null && value !== undefined) {
      return value;
    }
  }
  return 0;
}

function cohortSortKey(label: string): number {
  const yearWeekMatch = label.match(/^(\d{4})-W(\d{2})$/);
  if (yearWeekMatch) {
    const year = parseInt(yearWeekMatch[1], 10);
    const week = parseInt(yearWeekMatch[2], 10);
    return year * 100 + week;
  }

  const yearMonthMatch = label.match(/^(\d{4})-(\d{2})$/);
  if (yearMonthMatch) {
    const year = parseInt(yearMonthMatch[1], 10);
    const month = parseInt(yearMonthMatch[2], 10);
    return year * 100 + month;
  }

  const yearMatch = label.match(/^(\d{4})$/);
  if (yearMatch) {
    return parseInt(yearMatch[1], 10) * 100;
  }

  return Number.MAX_SAFE_INTEGER;
}

export function formatTimeLabel(
  isoDate: string,
  granularity: EvolutionTimeGranularity = 'monthly'
): string {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) {
    return isoDate;
  }

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = monthNames[date.getUTCMonth()];
  const year = date.getUTCFullYear();
  const day = `${date.getUTCDate()}`.padStart(2, '0');

  switch (granularity) {
    case 'daily':
    case 'weekly':
    case 'biweekly':
      return `${day} ${month} ${year}`;
    case 'quarterly':
      return `Q${Math.floor(date.getUTCMonth() / 3) + 1} ${year}`;
    case 'yearly':
      return `${year}`;
    case 'monthly':
    default:
      return `${month} ${year}`;
  }
}

function fillInactivePeriods(
  snapshots: EvolutionSnapshotPoint[],
  y: Array<Array<number | null>>
): { snapshots: EvolutionSnapshotPoint[]; ts: string[]; y: Array<Array<number | null>> } {
  if (snapshots.length < 2) {
    return {
      snapshots,
      ts: snapshots.map((snapshot) => snapshot.committedAt),
      y,
    };
  }

  const granularity = inferEvolutionTimeGranularity(snapshots.map((snapshot) => snapshot.committedAt));
  const expandedSnapshots: EvolutionSnapshotPoint[] = [snapshots[0]];
  const expandedY: Array<Array<number | null>> = y.map((series) => [series[0] ?? 0]);

  for (let snapshotIndex = 1; snapshotIndex < snapshots.length; snapshotIndex++) {
    const previousSnapshot = snapshots[snapshotIndex - 1];
    const currentSnapshot = snapshots[snapshotIndex];
    let cursor = addGranularity(previousSnapshot.committedAt, granularity);
    const currentTime = new Date(currentSnapshot.committedAt).getTime();

    while (cursor !== null && cursor.getTime() < currentTime) {
      const committedAt = cursor.toISOString();
      expandedSnapshots.push({
        ...previousSnapshot,
        committedAt,
        synthetic: true,
      });
      for (let seriesIndex = 0; seriesIndex < expandedY.length; seriesIndex++) {
        expandedY[seriesIndex].push(null);
      }
      cursor = addGranularity(committedAt, granularity);
    }

    expandedSnapshots.push(currentSnapshot);
    for (let seriesIndex = 0; seriesIndex < expandedY.length; seriesIndex++) {
      expandedY[seriesIndex].push(y[seriesIndex]?.[snapshotIndex] ?? 0);
    }
  }

  return {
    snapshots: expandedSnapshots,
    ts: expandedSnapshots.map((snapshot) => snapshot.committedAt),
    y: expandedY,
  };
}

function addGranularity(
  isoDate: string,
  granularity: EvolutionTimeGranularity
): Date | null {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  const next = new Date(date);
  switch (granularity) {
    case 'daily':
      next.setUTCDate(next.getUTCDate() + 1);
      break;
    case 'weekly':
      next.setUTCDate(next.getUTCDate() + 7);
      break;
    case 'biweekly':
      next.setUTCDate(next.getUTCDate() + 14);
      break;
    case 'quarterly':
      next.setUTCMonth(next.getUTCMonth() + 3);
      break;
    case 'yearly':
      next.setUTCFullYear(next.getUTCFullYear() + 1);
      break;
    case 'monthly':
    default:
      next.setUTCMonth(next.getUTCMonth() + 1);
      break;
  }

  return next.getTime() > date.getTime() ? next : null;
}

function formatSnapshotHoverLabel(
  snapshot: EvolutionSnapshotPoint | undefined,
  isoDate: string,
  granularity: EvolutionTimeGranularity
): string {
  const dateLabel = formatTimeLabel(isoDate, granularity);
  if (!snapshot) {
    return dateLabel;
  }

  const shaLabel = snapshot.commitSha ? snapshot.commitSha.slice(0, 8) : 'unknown';
  const commitPosition = snapshot.totalCommitCount > 0
    ? `Commit ${snapshot.commitIndex + 1} of ${snapshot.totalCommitCount}`
    : `Commit ${snapshot.commitIndex + 1}`;
  const samplingLabel = describeSamplingMode(snapshot.samplingMode);
  const syntheticLabel = snapshot.synthetic ? '<br>Synthetic filled point' : '';

  return `${dateLabel}<br>${commitPosition}<br>${samplingLabel}<br>SHA ${shaLabel}${syntheticLabel}`;
}

function describeSamplingMode(mode: EvolutionSnapshotPoint['samplingMode']): string {
  switch (mode) {
    case 'commit':
      return 'Commit-based snapshot';
    case 'auto':
      return 'Auto-distributed snapshot';
    case 'time':
    default:
      return 'Time-based snapshot';
  }
}

function getPlotlyTickFormat(granularity: EvolutionTimeGranularity): string {
  switch (granularity) {
    case 'daily':
    case 'weekly':
    case 'biweekly':
      return '%d %b\n%Y';
    case 'yearly':
      return '%Y';
    case 'monthly':
    case 'quarterly':
    default:
      return '%b\n%Y';
  }
}
