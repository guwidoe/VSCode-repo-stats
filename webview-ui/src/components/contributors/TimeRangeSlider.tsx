/**
 * Time Range Slider - GitHub-style time range selector with mini activity chart.
 *
 * Uses fully controlled local state for the slider position, syncing to the store
 * asynchronously to prevent blocking the UI during expensive re-renders.
 */

import { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import { useStore, selectAllWeeks, selectWeeklyCommitTotals } from '../../store';
import { fillWeeklyGaps } from '../../utils/fillTimeGaps';
import './TimeRangeSlider.css';

/**
 * Validates that a string is a properly formatted ISO week (YYYY-Www).
 */
function isValidISOWeek(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-W\d{2}$/.test(value);
}

/**
 * Formats an ISO week string to a short date format.
 */
function formatWeekShort(isoWeek: string): string {
  if (!isValidISOWeek(isoWeek)) {return '';}

  const match = isoWeek.match(/^(\d{4})-W(\d{2})$/);
  if (!match) {return '';}

  const year = parseInt(match[1], 10);
  const week = parseInt(match[2], 10);

  const jan4 = new Date(year, 0, 4);
  const dayOfWeek = jan4.getDay() || 7;
  const week1Monday = new Date(jan4);
  week1Monday.setDate(jan4.getDate() - dayOfWeek + 1);
  const weekStart = new Date(week1Monday);
  weekStart.setDate(week1Monday.getDate() + (week - 1) * 7);

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${monthNames[weekStart.getMonth()]} ${weekStart.getFullYear().toString().slice(2)}`;
}

/**
 * Ensures an index is valid (non-NaN, non-negative, within bounds).
 */
function clampIndex(value: number | null | undefined, max: number): number {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return max;
  }
  return Math.max(0, Math.min(Math.floor(value), max));
}

export function TimeRangeSlider() {
  const allWeeks = useStore(selectAllWeeks);
  const weeklyTotals = useStore(selectWeeklyCommitTotals);
  const showEmptyTimePeriods = useStore((state) => state.settings?.showEmptyTimePeriods ?? true);
  // Only subscribe to the setter, not the values (to avoid re-renders from store changes)
  const setTimeRange = useStore((state) => state.setTimeRange);

  const trackRef = useRef<HTMLDivElement>(null);
  const pendingUpdateRef = useRef<number | null>(null);

  // Fill gaps in display data when setting is enabled
  const displayData = useMemo(() => {
    if (!showEmptyTimePeriods || weeklyTotals.length === 0) {
      return weeklyTotals;
    }
    return fillWeeklyGaps(weeklyTotals, (week) => ({ week, commits: 0 }));
  }, [weeklyTotals, showEmptyTimePeriods]);

  // Create mapping from sparse index to filled index and vice versa
  const { sparseToFilled, filledToSparse } = useMemo(() => {
    if (!showEmptyTimePeriods || weeklyTotals.length === 0) {
      // Identity mapping when not filling gaps
      const identity = weeklyTotals.map((_, i) => i);
      return { sparseToFilled: identity, filledToSparse: identity };
    }

    const weekToSparseIdx = new Map<string, number>();
    weeklyTotals.forEach((w, i) => weekToSparseIdx.set(w.week, i));

    const sparse: number[] = [];
    const filled: number[] = [];

    displayData.forEach((w, filledIdx) => {
      const sparseIdx = weekToSparseIdx.get(w.week);
      if (sparseIdx !== undefined) {
        sparse[sparseIdx] = filledIdx;
        filled[filledIdx] = sparseIdx;
      } else {
        filled[filledIdx] = -1; // Mark as gap
      }
    });

    return { sparseToFilled: sparse, filledToSparse: filled };
  }, [weeklyTotals, displayData, showEmptyTimePeriods]);

  const maxIdx = Math.max(0, allWeeks.length - 1);
  const displayMaxIdx = Math.max(0, displayData.length - 1);

  // Fully local state for slider positions - initialized lazily
  const [localStart, setLocalStart] = useState<number>(0);
  const [localEnd, setLocalEnd] = useState<number>(maxIdx);
  const [isDragging, setIsDragging] = useState<'start' | 'end' | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  // Initialize local state when data first loads
  useEffect(() => {
    if (allWeeks.length > 0 && !isInitialized) {
      const newMaxIdx = allWeeks.length - 1;
      setLocalStart(0);
      setLocalEnd(newMaxIdx);
      setIsInitialized(true);
    }
  }, [allWeeks.length, isInitialized]);

  // Reset when data changes significantly (new repo loaded)
  useEffect(() => {
    if (isInitialized && allWeeks.length > 0) {
      const newMaxIdx = allWeeks.length - 1;
      // If current end is beyond new max, reset to full range
      if (localEnd > newMaxIdx) {
        setLocalStart(0);
        setLocalEnd(newMaxIdx);
        setTimeRange(0, newMaxIdx);
      }
    }
  }, [allWeeks.length, isInitialized, localEnd, setTimeRange]);

  const maxCommits = Math.max(...displayData.map((w) => w.commits), 1);

  // Schedule async store update (debounced)
  const scheduleStoreUpdate = useCallback((start: number, end: number) => {
    if (pendingUpdateRef.current) {
      cancelAnimationFrame(pendingUpdateRef.current);
    }
    pendingUpdateRef.current = requestAnimationFrame(() => {
      setTimeRange(start, end);
      pendingUpdateRef.current = null;
    });
  }, [setTimeRange]);

  const getIndexFromPosition = useCallback((clientX: number): number => {
    if (!trackRef.current || allWeeks.length === 0) {return 0;}
    const rect = trackRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, x / rect.width));
    // Get position in filled space
    const filledIdx = Math.round(ratio * Math.max(0, displayData.length - 1));
    // Map back to sparse index - find nearest sparse week
    const sparseIdx = filledToSparse[filledIdx];
    if (sparseIdx !== undefined && sparseIdx >= 0) {
      return sparseIdx;
    }
    // If clicked on a gap, find the nearest sparse index
    for (let offset = 1; offset < displayData.length; offset++) {
      const beforeIdx = filledIdx - offset;
      const afterIdx = filledIdx + offset;
      if (beforeIdx >= 0 && filledToSparse[beforeIdx] >= 0) {
        return filledToSparse[beforeIdx];
      }
      if (afterIdx < displayData.length && filledToSparse[afterIdx] >= 0) {
        return filledToSparse[afterIdx];
      }
    }
    return 0;
  }, [allWeeks.length, displayData.length, filledToSparse]);

  const handleMouseDown = useCallback((e: React.MouseEvent, handle: 'start' | 'end') => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(handle);
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging) {return;}

    const newIdx = getIndexFromPosition(e.clientX);

    if (isDragging === 'start') {
      const newStart = Math.max(0, Math.min(newIdx, localEnd - 1));
      setLocalStart(newStart);
      scheduleStoreUpdate(newStart, localEnd);
    } else {
      const newEnd = Math.min(maxIdx, Math.max(newIdx, localStart + 1));
      setLocalEnd(newEnd);
      scheduleStoreUpdate(localStart, newEnd);
    }
  }, [isDragging, localStart, localEnd, maxIdx, getIndexFromPosition, scheduleStoreUpdate]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(null);
  }, []);

  // Handle track click to move nearest handle
  const handleTrackClick = useCallback((e: React.MouseEvent) => {
    if (isDragging) {return;}
    const clickIdx = getIndexFromPosition(e.clientX);

    // Move the nearest handle
    const distToStart = Math.abs(clickIdx - localStart);
    const distToEnd = Math.abs(clickIdx - localEnd);

    if (distToStart <= distToEnd) {
      const newStart = Math.max(0, Math.min(clickIdx, localEnd - 1));
      setLocalStart(newStart);
      scheduleStoreUpdate(newStart, localEnd);
    } else {
      const newEnd = Math.min(maxIdx, Math.max(clickIdx, localStart + 1));
      setLocalEnd(newEnd);
      scheduleStoreUpdate(localStart, newEnd);
    }
  }, [isDragging, localStart, localEnd, maxIdx, getIndexFromPosition, scheduleStoreUpdate]);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  // Cleanup pending updates on unmount
  useEffect(() => {
    return () => {
      if (pendingUpdateRef.current) {
        cancelAnimationFrame(pendingUpdateRef.current);
      }
    };
  }, []);

  if (allWeeks.length === 0) {
    return null;
  }

  // Clamp sparse indices for slider logic
  const safeStartIdx = clampIndex(localStart, maxIdx);
  const safeEndIdx = clampIndex(localEnd, maxIdx);

  // Map sparse indices to filled indices for display
  const filledStartIdx = sparseToFilled[safeStartIdx] ?? 0;
  const filledEndIdx = sparseToFilled[safeEndIdx] ?? displayMaxIdx;

  const startPercent = displayMaxIdx > 0 ? (filledStartIdx / displayMaxIdx) * 100 : 0;
  const endPercent = displayMaxIdx > 0 ? (filledEndIdx / displayMaxIdx) * 100 : 100;

  // Get date labels with validation - fall back to first/last valid week if needed
  const startWeek = allWeeks[safeStartIdx];
  const endWeek = allWeeks[safeEndIdx];

  // Use the actual week if valid, otherwise fall back to first/last week in array
  const startLabel = isValidISOWeek(startWeek)
    ? formatWeekShort(startWeek)
    : (allWeeks[0] ? formatWeekShort(allWeeks[0]) : '');
  const endLabel = isValidISOWeek(endWeek)
    ? formatWeekShort(endWeek)
    : (allWeeks[allWeeks.length - 1] ? formatWeekShort(allWeeks[allWeeks.length - 1]) : '');

  return (
    <div className="time-range-slider">
      <div className="slider-labels">
        <span className="range-label">{startLabel}</span>
        <span className="range-separator">–</span>
        <span className="range-label">{endLabel}</span>
      </div>

      <div className="slider-track" ref={trackRef} onClick={handleTrackClick}>
        {/* Background activity chart */}
        <svg className="slider-chart" viewBox={`0 0 ${displayData.length} 20`} preserveAspectRatio="none">
          {displayData.map((week, i) => {
            const barHeight = (week.commits / maxCommits) * 20;
            const isSelected = i >= filledStartIdx && i <= filledEndIdx;
            return (
              <rect
                key={week.week}
                x={i}
                y={20 - barHeight}
                width={1}
                height={barHeight}
                fill="var(--vscode-charts-blue)"
                opacity={isSelected ? 0.8 : 0.2}
              />
            );
          })}
        </svg>

        {/* Selection overlay */}
        <div
          className="slider-selection"
          style={{
            left: `${startPercent}%`,
            width: `${endPercent - startPercent}%`,
          }}
        />

        {/* Handles */}
        <div
          className={`slider-handle slider-handle-start ${isDragging === 'start' ? 'dragging' : ''}`}
          style={{ left: `${startPercent}%` }}
          onMouseDown={(e) => handleMouseDown(e, 'start')}
        />
        <div
          className={`slider-handle slider-handle-end ${isDragging === 'end' ? 'dragging' : ''}`}
          style={{ left: `${endPercent}%` }}
          onMouseDown={(e) => handleMouseDown(e, 'end')}
        />
      </div>
    </div>
  );
}
