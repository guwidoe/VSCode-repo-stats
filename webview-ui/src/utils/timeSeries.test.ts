import { describe, expect, it } from 'vitest';
import {
  dateToISOWeek,
  formatMonthLabel,
  formatWeekLabel,
  formatWeekTooltipLabel,
  generateMonthRange,
  generateWeekRange,
  isValidISOWeek,
  parseISOWeek,
  weekToMonthKey,
} from './timeSeries';

describe('timeSeries utilities', () => {
  it('parses valid ISO weeks and rejects malformed values', () => {
    expect(parseISOWeek('2025-W03')).toEqual(new Date(2025, 0, 13));
    expect(parseISOWeek('2025-W00')).toBeNull();
    expect(parseISOWeek('bad-value')).toBeNull();
    expect(isValidISOWeek('2025-W03')).toBe(true);
    expect(isValidISOWeek('bad-value')).toBe(false);
  });

  it('formats week and month labels consistently', () => {
    expect(formatWeekLabel('2025-W03')).toBe("Jan 13 '25");
    expect(formatWeekTooltipLabel('2025-W03')).toBe('Jan 13, 2025');
    expect(formatWeekLabel('bad-value')).toBeNull();
    expect(formatMonthLabel('2025-01')).toBe('Jan 2025');
    expect(formatMonthLabel('bad-value')).toBe('bad-value');
  });

  it('converts between weeks and month keys', () => {
    expect(dateToISOWeek(new Date(2025, 0, 13))).toBe('2025-W03');
    expect(weekToMonthKey('2025-W03')).toBe('2025-01');
    expect(weekToMonthKey('bad-value')).toBeNull();
  });

  it('generates week and month ranges', () => {
    expect(generateWeekRange('2025-W03', '2025-W05')).toEqual(['2025-W03', '2025-W04', '2025-W05']);
    expect(generateWeekRange('bad-value', '2025-W05')).toEqual([]);
    expect(generateMonthRange('2025-01', '2025-03')).toEqual(['2025-01', '2025-02', '2025-03']);
    expect(generateMonthRange('bad-value', '2025-03')).toEqual([]);
  });
});
