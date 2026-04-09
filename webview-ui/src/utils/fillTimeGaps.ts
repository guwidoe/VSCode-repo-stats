/**
 * Utility functions for filling time gaps in chart data.
 * Ensures that empty weeks/months are shown in visualizations.
 */

import { generateMonthRange, generateWeekRange } from './timeSeries';

/**
 * Fills in missing weeks in a sparse data array.
 * Returns a new array with zero-valued entries for missing weeks.
 */
export function fillWeeklyGaps<T extends { week: string }>(
  data: T[],
  createEmptyEntry: (week: string) => T
): T[] {
  if (data.length === 0) {return [];}

  // Sort by week
  const sorted = [...data].sort((a, b) => a.week.localeCompare(b.week));
  const firstWeek = sorted[0].week;
  const lastWeek = sorted[sorted.length - 1].week;

  // Generate full week range
  const allWeeks = generateWeekRange(firstWeek, lastWeek);
  if (allWeeks.length === 0) {return sorted;}

  // Create a map for quick lookup
  const dataMap = new Map<string, T>();
  for (const entry of sorted) {
    dataMap.set(entry.week, entry);
  }

  // Fill gaps
  return allWeeks.map((week) => dataMap.get(week) ?? createEmptyEntry(week));
}

/**
 * Fills in missing months in a sparse data array.
 * Returns a new array with zero-valued entries for missing months.
 */
export function fillMonthlyGaps<T extends { week: string }>(
  data: T[],
  createEmptyEntry: (month: string) => T
): T[] {
  if (data.length === 0) {return [];}

  // Sort by month (week field contains month key in monthly mode)
  const sorted = [...data].sort((a, b) => a.week.localeCompare(b.week));
  const firstMonth = sorted[0].week;
  const lastMonth = sorted[sorted.length - 1].week;

  // Generate full month range
  const allMonths = generateMonthRange(firstMonth, lastMonth);
  if (allMonths.length === 0) {return sorted;}

  // Create a map for quick lookup
  const dataMap = new Map<string, T>();
  for (const entry of sorted) {
    dataMap.set(entry.week, entry);
  }

  // Fill gaps
  return allMonths.map((month) => dataMap.get(month) ?? createEmptyEntry(month));
}
