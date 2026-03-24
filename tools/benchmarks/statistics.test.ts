import { describe, expect, it } from 'vitest';
import {
  median,
  percentile,
  roundBenchmarkMetric,
  summarizeBenchmarkValues,
} from './statistics.js';

describe('benchmark statistics helpers', () => {
  it('returns zeroed summary stats for empty input', () => {
    expect(summarizeBenchmarkValues([])).toEqual({
      count: 0,
      min: 0,
      max: 0,
      mean: 0,
      median: 0,
      p95: 0,
    });
  });

  it('computes median and percentile from sorted copies', () => {
    expect(median([5, 1, 3])).toBe(3);
    expect(median([10, 2, 4, 6])).toBe(5);
    expect(percentile([1, 10, 5, 3], 95)).toBe(10);
  });

  it('rounds benchmark metrics to two decimals in the summary', () => {
    expect(roundBenchmarkMetric(10.126)).toBe(10.13);
    expect(summarizeBenchmarkValues([10.111, 10.222, 10.333])).toEqual({
      count: 3,
      min: 10.11,
      max: 10.33,
      mean: 10.22,
      median: 10.22,
      p95: 10.33,
    });
  });
});
