const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

export function isValidISOWeek(value: string): boolean {
  return parseISOWeek(value) !== null;
}

export function parseISOWeek(isoWeek: string): Date | null {
  const match = isoWeek.match(/^(\d{4})-W(\d{2})$/);
  if (!match) {
    return null;
  }

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

export function dateToISOWeek(date: Date): string {
  const year = date.getFullYear();
  const jan4 = new Date(year, 0, 4);
  const dayOfWeek = jan4.getDay() || 7;
  const week1Monday = new Date(jan4);
  week1Monday.setDate(jan4.getDate() - dayOfWeek + 1);

  if (date < week1Monday) {
    return dateToISOWeek(new Date(year - 1, 11, 28));
  }

  const diffDays = Math.floor((date.getTime() - week1Monday.getTime()) / (24 * 60 * 60 * 1000));
  const weekNum = Math.floor(diffDays / 7) + 1;

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

export function weekToMonthKey(isoWeek: string): string | null {
  const date = parseISOWeek(isoWeek);
  if (!date) {
    return null;
  }

  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

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
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }

  return months;
}

export function formatWeekLabel(isoWeek: string): string | null {
  const date = parseISOWeek(isoWeek);
  if (!date) {
    return null;
  }

  const year = date.getFullYear().toString().slice(2);
  return `${MONTH_NAMES[date.getMonth()]} ${date.getDate()} '${year}`;
}

export function formatWeekTooltipLabel(isoWeek: string): string | null {
  const date = parseISOWeek(isoWeek);
  if (!date) {
    return null;
  }

  return `${MONTH_NAMES[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
}

export function formatMonthLabel(monthKey: string): string {
  const match = monthKey.match(/^(\d{4})-(\d{2})$/);
  if (!match) {
    return monthKey;
  }

  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10) - 1;
  return `${MONTH_NAMES[month]} ${year}`;
}
