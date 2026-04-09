import { generateMonthRange, generateWeekRange } from './timeSeries';

export function fillWeeklyGaps<T extends { week: string }>(
  data: T[],
  createEmptyEntry: (week: string) => T
): T[] {
  if (data.length === 0) {return [];}

  const sorted = [...data].sort((a, b) => a.week.localeCompare(b.week));
  const firstWeek = sorted[0].week;
  const lastWeek = sorted[sorted.length - 1].week;

  const allWeeks = generateWeekRange(firstWeek, lastWeek);
  if (allWeeks.length === 0) {return sorted;}

  const dataMap = new Map<string, T>();
  for (const entry of sorted) {
    dataMap.set(entry.week, entry);
  }

  return allWeeks.map((week) => dataMap.get(week) ?? createEmptyEntry(week));
}

export function fillMonthlyGaps<T extends { week: string }>(
  data: T[],
  createEmptyEntry: (month: string) => T
): T[] {
  if (data.length === 0) {return [];}

  const sorted = [...data].sort((a, b) => a.week.localeCompare(b.week));
  const firstMonth = sorted[0].week;
  const lastMonth = sorted[sorted.length - 1].week;

  const allMonths = generateMonthRange(firstMonth, lastMonth);
  if (allMonths.length === 0) {return sorted;}

  const dataMap = new Map<string, T>();
  for (const entry of sorted) {
    dataMap.set(entry.week, entry);
  }

  return allMonths.map((month) => dataMap.get(month) ?? createEmptyEntry(month));
}
