import type { SummaryStats } from './contracts.js';

export function roundBenchmarkMetric(value: number): number {
  return Math.round(value * 100) / 100;
}

export function median(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[middle - 1] + sorted[middle]) / 2;
  }
  return sorted[middle];
}

export function percentile(values: number[], percentileValue: number): number {
  if (values.length === 0) {
    return 0;
  }

  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil((percentileValue / 100) * sorted.length) - 1)
  );
  return sorted[index];
}

export function summarizeBenchmarkValues(values: number[]): SummaryStats {
  if (values.length === 0) {
    return {
      count: 0,
      min: 0,
      max: 0,
      mean: 0,
      median: 0,
      p95: 0,
    };
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  return {
    count: values.length,
    min: roundBenchmarkMetric(min),
    max: roundBenchmarkMetric(max),
    mean: roundBenchmarkMetric(mean),
    median: roundBenchmarkMetric(median(values)),
    p95: roundBenchmarkMetric(percentile(values, 95)),
  };
}
