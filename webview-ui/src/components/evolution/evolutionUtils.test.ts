import { describe, expect, it } from 'vitest';
import { processEvolutionSeries } from './evolutionUtils';

describe('processEvolutionSeries', () => {
  const source = {
    ts: ['2026-01-01T00:00:00.000Z', '2026-02-01T00:00:00.000Z'],
    labels: ['Alice', 'Bob', 'Carol'],
    y: [
      [10, 15],
      [8, 5],
      [1, 1],
    ],
  };

  it('limits series and groups the rest into Other', () => {
    const processed = processEvolutionSeries(source, 2, false, 'author');

    expect(processed.labels).toEqual(['Alice', 'Bob', 'Other']);
    expect(processed.y[2]).toEqual([1, 1]);
  });

  it('normalizes series to percentages', () => {
    const processed = processEvolutionSeries(source, 3, true, 'author');

    const firstColumnTotal = processed.y.reduce((sum, series) => sum + series[0], 0);
    const secondColumnTotal = processed.y.reduce((sum, series) => sum + series[1], 0);

    expect(Math.round(firstColumnTotal)).toBe(100);
    expect(Math.round(secondColumnTotal)).toBe(100);
  });

  it('orders cohort labels chronologically', () => {
    const processed = processEvolutionSeries(
      {
        ts: ['2025-01-01T00:00:00.000Z'],
        labels: ['2026', '2022', '2023', '2025', '2024'],
        y: [[1], [100], [80], [20], [40]],
      },
      5,
      false,
      'cohort'
    );

    expect(processed.labels).toEqual(['2022', '2023', '2024', '2025', '2026']);
  });
});
