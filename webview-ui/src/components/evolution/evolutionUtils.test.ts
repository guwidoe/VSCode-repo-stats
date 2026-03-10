import { describe, expect, it } from 'vitest';
import {
  formatTimeLabel,
  getEvolutionTimeAxisConfig,
  inferEvolutionTimeGranularity,
  processEvolutionSeries,
} from './evolutionUtils';

describe('processEvolutionSeries', () => {
  const source = {
    snapshots: [
      {
        commitSha: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        commitIndex: 0,
        totalCommitCount: 2,
        committedAt: '2026-01-01T00:00:00.000Z',
        samplingMode: 'time' as const,
      },
      {
        commitSha: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
        commitIndex: 1,
        totalCommitCount: 2,
        committedAt: '2026-02-01T00:00:00.000Z',
        samplingMode: 'time' as const,
      },
    ],
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
    expect(processed.snapshots).toEqual(source.snapshots);
  });

  it('normalizes series to percentages', () => {
    const processed = processEvolutionSeries(source, 3, true, 'author');

    const firstColumnTotal = processed.y.reduce((sum, series) => sum + (series[0] ?? 0), 0);
    const secondColumnTotal = processed.y.reduce((sum, series) => sum + (series[1] ?? 0), 0);

    expect(Math.round(firstColumnTotal)).toBe(100);
    expect(Math.round(secondColumnTotal)).toBe(100);
  });

  it('fills inactive periods with synthetic gap points when requested', () => {
    const processed = processEvolutionSeries(
      {
        snapshots: [
          {
            commitSha: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
            commitIndex: 0,
            totalCommitCount: 3,
            committedAt: '2026-01-01T00:00:00.000Z',
            samplingMode: 'time',
          },
          {
            commitSha: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
            commitIndex: 1,
            totalCommitCount: 3,
            committedAt: '2026-01-03T00:00:00.000Z',
            samplingMode: 'time',
          },
          {
            commitSha: 'cccccccccccccccccccccccccccccccccccccccc',
            commitIndex: 2,
            totalCommitCount: 3,
            committedAt: '2026-01-07T00:00:00.000Z',
            samplingMode: 'time',
          },
        ],
        ts: [
          '2026-01-01T00:00:00.000Z',
          '2026-01-03T00:00:00.000Z',
          '2026-01-07T00:00:00.000Z',
        ],
        labels: ['Alice'],
        y: [[10, 20, 30]],
      },
      1,
      false,
      'author',
      true
    );

    expect(processed.ts).toEqual([
      '2026-01-01T00:00:00.000Z',
      '2026-01-02T00:00:00.000Z',
      '2026-01-03T00:00:00.000Z',
      '2026-01-04T00:00:00.000Z',
      '2026-01-05T00:00:00.000Z',
      '2026-01-06T00:00:00.000Z',
      '2026-01-07T00:00:00.000Z',
    ]);
    expect(processed.y[0]).toEqual([10, null, 20, null, null, null, 30]);
    expect(processed.snapshots.filter((snapshot) => snapshot.synthetic)).toHaveLength(4);
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

  it('keeps Other as last entry for cohort dimension', () => {
    const processed = processEvolutionSeries(
      {
        ts: ['2025-01-01T00:00:00.000Z'],
        labels: ['2022', '2023', '2024', '2025', '2026', '2027'],
        y: [[50], [40], [30], [20], [10], [5]],
      },
      3,
      false,
      'cohort'
    );

    expect(processed.labels[processed.labels.length - 1]).toBe('Other');
  });
});

describe('evolution time axis formatting', () => {
  it('infers weekly granularity from weekly snapshots', () => {
    expect(
      inferEvolutionTimeGranularity([
        '2026-01-01T00:00:00.000Z',
        '2026-01-08T00:00:00.000Z',
        '2026-01-15T00:00:00.000Z',
      ])
    ).toBe('weekly');
  });

  it('formats fine-grained snapshots with day detail', () => {
    expect(formatTimeLabel('2026-01-08T00:00:00.000Z', 'weekly')).toBe('08 Jan 2026');
  });

  it('keeps date axes on raw timestamps and chooses a weekly tick format', () => {
    const axis = getEvolutionTimeAxisConfig({
      ts: [
        '2026-01-01T00:00:00.000Z',
        '2026-01-08T00:00:00.000Z',
        '2026-01-15T00:00:00.000Z',
      ],
    });

    expect(axis.x).toEqual([
      '2026-01-01T00:00:00.000Z',
      '2026-01-08T00:00:00.000Z',
      '2026-01-15T00:00:00.000Z',
    ]);
    expect(axis.axisType).toBe('date');
    expect(axis.hoverLabels).toEqual(['01 Jan 2026', '08 Jan 2026', '15 Jan 2026']);
    expect(axis.tickFormat).toBe('%d %b\n%Y');
  });

  it('can switch the x-axis to commit progression without recomputing snapshots', () => {
    const axis = getEvolutionTimeAxisConfig({
      ts: [
        '2026-01-01T00:00:00.000Z',
        '2026-01-08T00:00:00.000Z',
      ],
      snapshots: [
        {
          commitSha: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
          commitIndex: 4,
          totalCommitCount: 20,
          committedAt: '2026-01-01T00:00:00.000Z',
          samplingMode: 'commit',
        },
        {
          commitSha: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
          commitIndex: 9,
          totalCommitCount: 20,
          committedAt: '2026-01-08T00:00:00.000Z',
          samplingMode: 'commit',
        },
      ],
    }, 'commit');

    expect(axis.x).toEqual([5, 10]);
    expect(axis.axisType).toBe('linear');
    expect(axis.tickPrefix).toBe('#');
    expect(axis.axisTitle).toBe('Commit progression');
  });

  it('includes snapshot metadata in hover labels when available', () => {
    const axis = getEvolutionTimeAxisConfig({
      ts: ['2026-01-01T00:00:00.000Z'],
      snapshots: [
        {
          commitSha: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
          commitIndex: 4,
          totalCommitCount: 20,
          committedAt: '2026-01-01T00:00:00.000Z',
          samplingMode: 'auto',
        },
      ],
    });

    expect(axis.hoverLabels[0]).toContain('Commit 5 of 20');
    expect(axis.hoverLabels[0]).toContain('Auto-distributed snapshot');
    expect(axis.hoverLabels[0]).toContain('SHA aaaaaaaa');
  });
});
