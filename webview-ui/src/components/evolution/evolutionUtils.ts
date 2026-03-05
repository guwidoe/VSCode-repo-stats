import type { EvolutionTimeSeriesData } from '../../types';

export interface ProcessedSeriesData {
  ts: string[];
  labels: string[];
  y: number[][];
}

export function processEvolutionSeries(
  data: EvolutionTimeSeriesData,
  maxSeries: number,
  normalize: boolean
): ProcessedSeriesData {
  const ts = data.ts;
  const labels = [...data.labels];
  const y = data.y.map((series) => [...series]);

  const indexed = labels.map((label, index) => ({
    label,
    index,
    max: Math.max(...(y[index] || [0])),
    latest: y[index]?.[y[index].length - 1] || 0,
  }));

  indexed.sort((a, b) => b.max - a.max || b.latest - a.latest || a.label.localeCompare(b.label));

  const top = indexed.slice(0, Math.max(1, maxSeries));
  const rest = indexed.slice(Math.max(1, maxSeries));

  const outLabels = top.map((entry) => entry.label);
  const outY = top.map((entry) => y[entry.index] || Array(ts.length).fill(0));

  if (rest.length > 0) {
    const other = Array(ts.length).fill(0);
    for (const entry of rest) {
      const series = y[entry.index] || [];
      for (let i = 0; i < ts.length; i++) {
        other[i] += series[i] || 0;
      }
    }
    outLabels.push('Other');
    outY.push(other);
  }

  if (!normalize) {
    return { ts, labels: outLabels, y: outY };
  }

  const normalized = outY.map((series) => [...series]);
  for (let i = 0; i < ts.length; i++) {
    let total = 0;
    for (const series of normalized) {
      total += series[i] || 0;
    }

    if (total <= 0) {
      continue;
    }

    for (const series of normalized) {
      series[i] = (100 * (series[i] || 0)) / total;
    }
  }

  return {
    ts,
    labels: outLabels,
    y: normalized,
  };
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
