import type { EvolutionDimension, EvolutionTimeSeriesData } from '../../types';

export interface ProcessedSeriesData {
  ts: string[];
  labels: string[];
  y: number[][];
}

export type EvolutionTimeGranularity =
  | 'daily'
  | 'weekly'
  | 'biweekly'
  | 'monthly'
  | 'quarterly'
  | 'yearly';

export interface EvolutionTimeAxisConfig {
  x: string[];
  granularity: EvolutionTimeGranularity;
  hoverLabels: string[];
  tickFormat: string;
}

export function processEvolutionSeries(
  data: EvolutionTimeSeriesData,
  maxSeries: number,
  normalize: boolean,
  dimension: EvolutionDimension
): ProcessedSeriesData {
  const ts = data.ts;
  const labels = [...data.labels];
  const y = data.y.map((series) => [...series]);

  const indexed = labels.map((label, index) => ({
    label,
    index,
    max: Math.max(...(y[index] || [0])),
    latest: y[index]?.[y[index].length - 1] ?? 0,
  }));

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
    return { ts, labels: outLabels, y: outY };
  }

  const normalized = outY.map((series) => [...series]);
  for (let i = 0; i < ts.length; i++) {
    let total = 0;
    for (const series of normalized) {
      total += series[i] ?? 0;
    }

    if (total <= 0) {
      continue;
    }

    for (const series of normalized) {
      series[i] = (100 * (series[i] ?? 0)) / total;
    }
  }

  return {
    ts,
    labels: outLabels,
    y: normalized,
  };
}

export function getEvolutionTimeAxisConfig(ts: string[]): EvolutionTimeAxisConfig {
  const granularity = inferEvolutionTimeGranularity(ts);

  return {
    x: ts,
    granularity,
    hoverLabels: ts.map((isoDate) => formatTimeLabel(isoDate, granularity)),
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
