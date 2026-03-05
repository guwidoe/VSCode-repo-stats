import type { EvolutionDimension, EvolutionTimeSeriesData } from '../../types';

export interface ProcessedSeriesData {
  ts: string[];
  labels: string[];
  y: number[][];
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

export function formatTimeLabel(isoDate: string): string {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) {
    return isoDate;
  }

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = monthNames[date.getUTCMonth()];
  const year = date.getUTCFullYear();
  return `${month} ${year}`;
}
