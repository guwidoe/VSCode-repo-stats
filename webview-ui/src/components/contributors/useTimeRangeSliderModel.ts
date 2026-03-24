import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';
import { fillWeeklyGaps } from '../../utils/fillTimeGaps';

export interface WeeklyCommitTotal {
  week: string;
  commits: number;
}

export type SliderHandle = 'start' | 'end';

interface UseTimeRangeSliderModelArgs {
  allWeeks: string[];
  weeklyTotals: WeeklyCommitTotal[];
  showEmptyTimePeriods: boolean;
  setTimeRange: (start: number, end: number) => void;
}

interface DisplayIndexMapping {
  sparseToFilled: number[];
  filledToSparse: number[];
}

export interface TimeRangeSliderModel {
  trackRef: MutableRefObject<HTMLDivElement | null>;
  hasData: boolean;
  displayData: WeeklyCommitTotal[];
  maxCommits: number;
  startLabel: string;
  endLabel: string;
  startPercent: number;
  endPercent: number;
  filledStartIdx: number;
  filledEndIdx: number;
  isDragging: SliderHandle | null;
  beginDrag: (handle: SliderHandle) => void;
  handleTrackClickAt: (clientX: number) => void;
}

function isValidISOWeek(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-W\d{2}$/.test(value);
}

function formatWeekShort(isoWeek: string): string {
  if (!isValidISOWeek(isoWeek)) {
    return '';
  }

  const match = isoWeek.match(/^(\d{4})-W(\d{2})$/);
  if (!match) {
    return '';
  }

  const year = parseInt(match[1], 10);
  const week = parseInt(match[2], 10);
  const jan4 = new Date(year, 0, 4);
  const dayOfWeek = jan4.getDay() || 7;
  const week1Monday = new Date(jan4);
  week1Monday.setDate(jan4.getDate() - dayOfWeek + 1);
  const weekStart = new Date(week1Monday);
  weekStart.setDate(week1Monday.getDate() + (week - 1) * 7);

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const yearShort = weekStart.getFullYear().toString().slice(2);
  return `${monthNames[weekStart.getMonth()]} ${weekStart.getDate()} '${yearShort}`;
}

function clampIndex(value: number | null | undefined, max: number): number {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return max;
  }

  return Math.max(0, Math.min(Math.floor(value), max));
}

function buildDisplayIndexMapping(
  weeklyTotals: WeeklyCommitTotal[],
  displayData: WeeklyCommitTotal[],
  showEmptyTimePeriods: boolean
): DisplayIndexMapping {
  if (!showEmptyTimePeriods || weeklyTotals.length === 0) {
    const identity = weeklyTotals.map((_, index) => index);
    return { sparseToFilled: identity, filledToSparse: identity };
  }

  const weekToSparseIdx = new Map<string, number>();
  weeklyTotals.forEach((week, index) => weekToSparseIdx.set(week.week, index));

  const sparseToFilled: number[] = [];
  const filledToSparse: number[] = [];

  displayData.forEach((week, filledIndex) => {
    const sparseIndex = weekToSparseIdx.get(week.week);
    if (sparseIndex !== undefined) {
      sparseToFilled[sparseIndex] = filledIndex;
      filledToSparse[filledIndex] = sparseIndex;
      return;
    }

    filledToSparse[filledIndex] = -1;
  });

  return { sparseToFilled, filledToSparse };
}

function findNearestSparseIndex(filledIndex: number, filledToSparse: number[]): number {
  const direct = filledToSparse[filledIndex];
  if (direct !== undefined && direct >= 0) {
    return direct;
  }

  for (let offset = 1; offset < filledToSparse.length; offset += 1) {
    const beforeIndex = filledIndex - offset;
    const afterIndex = filledIndex + offset;

    if (beforeIndex >= 0 && (filledToSparse[beforeIndex] ?? -1) >= 0) {
      return filledToSparse[beforeIndex] ?? 0;
    }

    if (afterIndex < filledToSparse.length && (filledToSparse[afterIndex] ?? -1) >= 0) {
      return filledToSparse[afterIndex] ?? 0;
    }
  }

  return 0;
}

export function useTimeRangeSliderModel({
  allWeeks,
  weeklyTotals,
  showEmptyTimePeriods,
  setTimeRange,
}: UseTimeRangeSliderModelArgs): TimeRangeSliderModel {
  const trackRef = useRef<HTMLDivElement>(null);
  const pendingUpdateRef = useRef<number | null>(null);

  const displayData = useMemo(() => {
    if (!showEmptyTimePeriods || weeklyTotals.length === 0) {
      return weeklyTotals;
    }

    return fillWeeklyGaps(weeklyTotals, (week) => ({ week, commits: 0 }));
  }, [weeklyTotals, showEmptyTimePeriods]);

  const { sparseToFilled, filledToSparse } = useMemo(
    () => buildDisplayIndexMapping(weeklyTotals, displayData, showEmptyTimePeriods),
    [weeklyTotals, displayData, showEmptyTimePeriods]
  );

  const maxIdx = Math.max(0, allWeeks.length - 1);
  const displayMaxIdx = Math.max(0, displayData.length - 1);
  const [localStart, setLocalStart] = useState(0);
  const [localEnd, setLocalEnd] = useState(maxIdx);
  const [isDragging, setIsDragging] = useState<SliderHandle | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    if (allWeeks.length > 0 && !isInitialized) {
      const newMaxIdx = allWeeks.length - 1;
      setLocalStart(0);
      setLocalEnd(newMaxIdx);
      setIsInitialized(true);
    }
  }, [allWeeks.length, isInitialized]);

  useEffect(() => {
    if (isInitialized && allWeeks.length > 0) {
      const newMaxIdx = allWeeks.length - 1;
      if (localEnd > newMaxIdx) {
        setLocalStart(0);
        setLocalEnd(newMaxIdx);
        setTimeRange(0, newMaxIdx);
      }
    }
  }, [allWeeks.length, isInitialized, localEnd, setTimeRange]);

  const scheduleStoreUpdate = useCallback((start: number, end: number) => {
    if (pendingUpdateRef.current) {
      cancelAnimationFrame(pendingUpdateRef.current);
    }

    pendingUpdateRef.current = requestAnimationFrame(() => {
      setTimeRange(start, end);
      pendingUpdateRef.current = null;
    });
  }, [setTimeRange]);

  const getIndexFromPosition = useCallback((clientX: number) => {
    if (!trackRef.current || allWeeks.length === 0) {
      return 0;
    }

    const rect = trackRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, x / rect.width));
    const filledIndex = Math.round(ratio * Math.max(0, displayData.length - 1));
    return findNearestSparseIndex(filledIndex, filledToSparse);
  }, [allWeeks.length, displayData.length, filledToSparse]);

  const applyRangeUpdate = useCallback((handle: SliderHandle, candidateIndex: number) => {
    if (handle === 'start') {
      const newStart = Math.max(0, Math.min(candidateIndex, localEnd - 1));
      setLocalStart(newStart);
      scheduleStoreUpdate(newStart, localEnd);
      return;
    }

    const newEnd = Math.min(maxIdx, Math.max(candidateIndex, localStart + 1));
    setLocalEnd(newEnd);
    scheduleStoreUpdate(localStart, newEnd);
  }, [localEnd, localStart, maxIdx, scheduleStoreUpdate]);

  const handleTrackClickAt = useCallback((clientX: number) => {
    if (isDragging) {
      return;
    }

    const clickIndex = getIndexFromPosition(clientX);
    const distanceToStart = Math.abs(clickIndex - localStart);
    const distanceToEnd = Math.abs(clickIndex - localEnd);
    applyRangeUpdate(distanceToStart <= distanceToEnd ? 'start' : 'end', clickIndex);
  }, [applyRangeUpdate, getIndexFromPosition, isDragging, localEnd, localStart]);

  useEffect(() => {
    if (!isDragging) {
      return;
    }

    const handleMouseMove = (event: MouseEvent) => {
      const nextIndex = getIndexFromPosition(event.clientX);
      applyRangeUpdate(isDragging, nextIndex);
    };

    const handleMouseUp = () => {
      setIsDragging(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [applyRangeUpdate, getIndexFromPosition, isDragging]);

  useEffect(() => {
    return () => {
      if (pendingUpdateRef.current) {
        cancelAnimationFrame(pendingUpdateRef.current);
      }
    };
  }, []);

  const safeStartIdx = clampIndex(localStart, maxIdx);
  const safeEndIdx = clampIndex(localEnd, maxIdx);
  const filledStartIdx = sparseToFilled[safeStartIdx] ?? 0;
  const filledEndIdx = sparseToFilled[safeEndIdx] ?? displayMaxIdx;
  const startPercent = displayMaxIdx > 0 ? (filledStartIdx / displayMaxIdx) * 100 : 0;
  const endPercent = displayMaxIdx > 0 ? (filledEndIdx / displayMaxIdx) * 100 : 100;
  const startWeek = allWeeks[safeStartIdx];
  const endWeek = allWeeks[safeEndIdx];
  const startLabel = isValidISOWeek(startWeek)
    ? formatWeekShort(startWeek)
    : (allWeeks[0] ? formatWeekShort(allWeeks[0]) : '');
  const endLabel = isValidISOWeek(endWeek)
    ? formatWeekShort(endWeek)
    : (allWeeks[allWeeks.length - 1] ? formatWeekShort(allWeeks[allWeeks.length - 1]) : '');

  return {
    trackRef,
    hasData: allWeeks.length > 0,
    displayData,
    maxCommits: Math.max(...displayData.map((week) => week.commits), 1),
    startLabel,
    endLabel,
    startPercent,
    endPercent,
    filledStartIdx,
    filledEndIdx,
    isDragging,
    beginDrag: setIsDragging,
    handleTrackClickAt,
  };
}

export { buildDisplayIndexMapping, findNearestSparseIndex, formatWeekShort };
