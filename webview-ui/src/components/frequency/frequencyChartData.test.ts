import { describe, expect, it } from 'vitest';
import { prepareCodeFrequencyChartData } from './frequencyChartData';

describe('prepareCodeFrequencyChartData', () => {
  it('fills missing weekly periods when requested', () => {
    const result = prepareCodeFrequencyChartData([
      { week: '2024-W01', additions: 10, deletions: 4, netChange: 6 },
      { week: '2024-W03', additions: 8, deletions: 2, netChange: 6 },
    ], true);

    expect(result.map((point) => point.period)).toEqual(['2024-W01', '2024-W02', '2024-W03']);
    expect(result[1]).toMatchObject({
      additions: 0,
      deletions: 0,
      netChange: 0,
    });
  });

  it('keeps monthly periods and formats monthly labels', () => {
    const result = prepareCodeFrequencyChartData([
      { week: '2024-01', additions: 20, deletions: 5, netChange: 15 },
      { week: '2024-02', additions: 12, deletions: 8, netChange: 4 },
    ], false);

    expect(result).toEqual([
      {
        period: '2024-01',
        label: 'Jan 2024',
        additions: 20,
        deletions: 5,
        netChange: 15,
      },
      {
        period: '2024-02',
        label: 'Feb 2024',
        additions: 12,
        deletions: 8,
        netChange: 4,
      },
    ]);
  });
});
