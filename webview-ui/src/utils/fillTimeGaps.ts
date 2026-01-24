/**
 * Utility functions for filling time gaps in chart data.
 * Ensures that empty weeks/months are shown in visualizations.
 */

/**
 * Parses an ISO week string (YYYY-Www) to a Date object.
 * Returns null for invalid formats.
 */
export function parseISOWeek(isoWeek: string): Date | null {
  const match = isoWeek.match(/^(\d{4})-W(\d{2})$/);
  if (!match) {return null;}

  const year = parseInt(match[1], 10);
  const week = parseInt(match[2], 10);

  if (year < 1970 || year > 2100 || week < 1 || week > 53) {
    return null;
  }

  const jan4 = new Date(year, 0, 4);
  const dayOfWeek = jan4.getDay() || 7;
  const week1Monday = new Date(jan4);
  week1Monday.setDate(jan4.getDate() - dayOfWeek + 1);
  const weekStart = new Date(week1Monday);
  weekStart.setDate(week1Monday.getDate() + (week - 1) * 7);

  return weekStart;
}

/**
 * Converts a Date to an ISO week string (YYYY-Www).
 */
export function dateToISOWeek(date: Date): string {
  const year = date.getFullYear();
  const jan4 = new Date(year, 0, 4);
  const dayOfWeek = jan4.getDay() || 7;
  const week1Monday = new Date(jan4);
  week1Monday.setDate(jan4.getDate() - dayOfWeek + 1);

  // If date is before week 1 Monday, it's in the previous year's last week
  if (date < week1Monday) {
    return dateToISOWeek(new Date(year - 1, 11, 28));
  }

  const diffDays = Math.floor((date.getTime() - week1Monday.getTime()) / (24 * 60 * 60 * 1000));
  const weekNum = Math.floor(diffDays / 7) + 1;

  // Handle week 53 overflow to next year
  if (weekNum > 52) {
    const nextYear = new Date(year + 1, 0, 4);
    const nextDayOfWeek = nextYear.getDay() || 7;
    const nextWeek1Monday = new Date(nextYear);
    nextWeek1Monday.setDate(nextYear.getDate() - nextDayOfWeek + 1);
    if (date >= nextWeek1Monday) {
      return `${year + 1}-W01`;
    }
  }

  return `${year}-W${String(weekNum).padStart(2, '0')}`;
}

/**
 * Generates all ISO weeks between two dates (inclusive).
 */
export function generateWeekRange(startWeek: string, endWeek: string): string[] {
  const startDate = parseISOWeek(startWeek);
  const endDate = parseISOWeek(endWeek);

  if (!startDate || !endDate || startDate > endDate) {
    return [];
  }

  const weeks: string[] = [];
  const current = new Date(startDate);

  while (current <= endDate) {
    weeks.push(dateToISOWeek(current));
    current.setDate(current.getDate() + 7);
  }

  return weeks;
}

/**
 * Converts an ISO week to a month key (YYYY-MM).
 */
export function weekToMonthKey(isoWeek: string): string | null {
  const date = parseISOWeek(isoWeek);
  if (!date) {return null;}
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Generates all months between two month keys (inclusive).
 */
export function generateMonthRange(startMonth: string, endMonth: string): string[] {
  const startMatch = startMonth.match(/^(\d{4})-(\d{2})$/);
  const endMatch = endMonth.match(/^(\d{4})-(\d{2})$/);

  if (!startMatch || !endMatch) {
    return [];
  }

  const startYear = parseInt(startMatch[1], 10);
  const startMon = parseInt(startMatch[2], 10);
  const endYear = parseInt(endMatch[1], 10);
  const endMon = parseInt(endMatch[2], 10);

  const months: string[] = [];
  let year = startYear;
  let month = startMon;

  while (year < endYear || (year === endYear && month <= endMon)) {
    months.push(`${year}-${String(month).padStart(2, '0')}`);
    month++;
    if (month > 12) {
      month = 1;
      year++;
    }
  }

  return months;
}

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
