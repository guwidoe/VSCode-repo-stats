import type { CodeFrequency } from '../../types';
import { fillMonthlyGaps, fillWeeklyGaps } from '../../utils/fillTimeGaps';
import { formatMonthLabel, formatWeekLabel } from '../../utils/timeSeries';

export interface CodeFrequencyChartPoint {
  period: string;
  label: string;
  additions: number;
  deletions: number;
  netChange: number;
}

function isMonthlyPeriod(value: string): boolean {
  return /^\d{4}-\d{2}$/.test(value);
}

export function prepareCodeFrequencyChartData(
  frequency: CodeFrequency[],
  showEmptyTimePeriods: boolean
): CodeFrequencyChartPoint[] {
  if (frequency.length === 0) {
    return [];
  }

  const isMonthly = isMonthlyPeriod(frequency[0].week);
  let data = frequency;

  if (showEmptyTimePeriods) {
    const createEmptyEntry = (week: string): CodeFrequency => ({
      week,
      additions: 0,
      deletions: 0,
      netChange: 0,
    });

    data = isMonthly
      ? fillMonthlyGaps(frequency, createEmptyEntry)
      : fillWeeklyGaps(frequency, createEmptyEntry);
  }

  return data.map((entry) => ({
    period: entry.week,
    label: isMonthly ? formatMonthLabel(entry.week) : (formatWeekLabel(entry.week) ?? entry.week),
    additions: entry.additions,
    deletions: entry.deletions,
    netChange: entry.netChange,
  }));
}
