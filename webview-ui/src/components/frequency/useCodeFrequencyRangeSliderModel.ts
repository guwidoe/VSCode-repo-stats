import { useCallback, useEffect, useRef, useState, type MutableRefObject } from 'react';
import type { CodeFrequencyChartPoint } from './frequencyChartData';

export type CodeFrequencySliderHandle = 'start' | 'end';

interface UseCodeFrequencyRangeSliderModelArgs {
  points: CodeFrequencyChartPoint[];
  onRangeChange: (start: number, end: number) => void;
}

export interface CodeFrequencyRangeSliderModel {
  trackRef: MutableRefObject<HTMLDivElement | null>;
  hasData: boolean;
  maxMagnitude: number;
  startLabel: string;
  endLabel: string;
  startPercent: number;
  endPercent: number;
  startIndex: number;
  endIndex: number;
  isDragging: CodeFrequencySliderHandle | null;
  beginDrag: (handle: CodeFrequencySliderHandle) => void;
  handleTrackClickAt: (clientX: number) => void;
}

function clampIndex(value: number | null | undefined, max: number): number {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return max;
  }

  return Math.max(0, Math.min(Math.floor(value), max));
}

export function useCodeFrequencyRangeSliderModel({
  points,
  onRangeChange,
}: UseCodeFrequencyRangeSliderModelArgs): CodeFrequencyRangeSliderModel {
  const trackRef = useRef<HTMLDivElement>(null);
  const pendingUpdateRef = useRef<number | null>(null);
  const maxIdx = Math.max(0, points.length - 1);
  const [localStart, setLocalStart] = useState(0);
  const [localEnd, setLocalEnd] = useState(maxIdx);
  const [isDragging, setIsDragging] = useState<CodeFrequencySliderHandle | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    if (points.length > 0 && !isInitialized) {
      const newMaxIdx = points.length - 1;
      setLocalStart(0);
      setLocalEnd(newMaxIdx);
      setIsInitialized(true);
      onRangeChange(0, newMaxIdx);
    }
  }, [isInitialized, onRangeChange, points.length]);

  useEffect(() => {
    if (points.length === 0) {
      setLocalStart(0);
      setLocalEnd(0);
      setIsInitialized(false);
      return;
    }

    const newMaxIdx = points.length - 1;
    if (!isInitialized || localEnd > newMaxIdx) {
      setLocalStart(0);
      setLocalEnd(newMaxIdx);
      setIsInitialized(true);
      onRangeChange(0, newMaxIdx);
    }
  }, [isInitialized, localEnd, onRangeChange, points.length]);

  const scheduleRangeUpdate = useCallback((start: number, end: number) => {
    if (pendingUpdateRef.current) {
      cancelAnimationFrame(pendingUpdateRef.current);
    }

    pendingUpdateRef.current = requestAnimationFrame(() => {
      onRangeChange(start, end);
      pendingUpdateRef.current = null;
    });
  }, [onRangeChange]);

  const getIndexFromPosition = useCallback((clientX: number) => {
    if (!trackRef.current || points.length === 0) {
      return 0;
    }

    const rect = trackRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, x / rect.width));
    return Math.round(ratio * Math.max(0, points.length - 1));
  }, [points.length]);

  const applyRangeUpdate = useCallback((handle: CodeFrequencySliderHandle, candidateIndex: number) => {
    if (points.length <= 1) {
      setLocalStart(0);
      setLocalEnd(0);
      scheduleRangeUpdate(0, 0);
      return;
    }

    if (handle === 'start') {
      const nextStart = Math.max(0, Math.min(candidateIndex, localEnd - 1));
      setLocalStart(nextStart);
      scheduleRangeUpdate(nextStart, localEnd);
      return;
    }

    const nextEnd = Math.min(maxIdx, Math.max(candidateIndex, localStart + 1));
    setLocalEnd(nextEnd);
    scheduleRangeUpdate(localStart, nextEnd);
  }, [localEnd, localStart, maxIdx, points.length, scheduleRangeUpdate]);

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
  const startPercent = maxIdx > 0 ? (safeStartIdx / maxIdx) * 100 : 0;
  const endPercent = maxIdx > 0 ? (safeEndIdx / maxIdx) * 100 : 100;

  return {
    trackRef,
    hasData: points.length > 0,
    maxMagnitude: Math.max(...points.map((point) => Math.max(point.additions, point.deletions)), 1),
    startLabel: points[safeStartIdx]?.label ?? '',
    endLabel: points[safeEndIdx]?.label ?? points[safeStartIdx]?.label ?? '',
    startPercent,
    endPercent,
    startIndex: safeStartIdx,
    endIndex: safeEndIdx,
    isDragging,
    beginDrag: setIsDragging,
    handleTrackClickAt,
  };
}
