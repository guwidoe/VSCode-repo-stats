import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CodeFrequencyChartPoint } from './frequencyChartData';
import '../contributors/TimeRangeSlider.css';
import './CodeFrequencyRangeSlider.css';

interface Props {
  points: CodeFrequencyChartPoint[];
  resetKey: string;
  onRangeChange: (start: number, end: number) => void;
}

type SliderHandle = 'start' | 'end';

export function CodeFrequencyRangeSlider({ points, resetKey, onRangeChange }: Props) {
  const trackRef = useRef<HTMLDivElement>(null);
  const maxIndex = Math.max(0, points.length - 1);
  const [startIndex, setStartIndex] = useState(0);
  const [endIndex, setEndIndex] = useState(maxIndex);
  const [isDragging, setIsDragging] = useState<SliderHandle | null>(null);

  useEffect(() => {
    const nextEndIndex = Math.max(0, points.length - 1);
    setStartIndex(0);
    setEndIndex(nextEndIndex);
    if (points.length > 0) {
      onRangeChange(0, nextEndIndex);
    }
  }, [onRangeChange, points.length, resetKey]);

  const getIndexFromPosition = useCallback((clientX: number) => {
    if (!trackRef.current || points.length === 0) {
      return 0;
    }

    const rect = trackRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, x / rect.width));
    return Math.round(ratio * Math.max(0, points.length - 1));
  }, [points.length]);

  const updateRange = useCallback((handle: SliderHandle, nextIndex: number) => {
    if (points.length <= 1) {
      setStartIndex(0);
      setEndIndex(0);
      onRangeChange(0, 0);
      return;
    }

    if (handle === 'start') {
      const nextStart = Math.max(0, Math.min(nextIndex, endIndex - 1));
      setStartIndex(nextStart);
      onRangeChange(nextStart, endIndex);
      return;
    }

    const nextEnd = Math.min(maxIndex, Math.max(nextIndex, startIndex + 1));
    setEndIndex(nextEnd);
    onRangeChange(startIndex, nextEnd);
  }, [endIndex, maxIndex, onRangeChange, points.length, startIndex]);

  const handleTrackClick = useCallback((clientX: number) => {
    if (isDragging) {
      return;
    }

    const clickedIndex = getIndexFromPosition(clientX);
    const distanceToStart = Math.abs(clickedIndex - startIndex);
    const distanceToEnd = Math.abs(clickedIndex - endIndex);
    updateRange(distanceToStart <= distanceToEnd ? 'start' : 'end', clickedIndex);
  }, [endIndex, getIndexFromPosition, isDragging, startIndex, updateRange]);

  useEffect(() => {
    if (!isDragging) {
      return;
    }

    const handleMouseMove = (event: MouseEvent) => {
      updateRange(isDragging, getIndexFromPosition(event.clientX));
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
  }, [getIndexFromPosition, isDragging, updateRange]);

  const maxMagnitude = useMemo(
    () => Math.max(...points.map((point) => Math.max(point.additions, point.deletions)), 1),
    [points]
  );

  if (points.length === 0) {
    return null;
  }

  const startPercent = maxIndex > 0 ? (startIndex / maxIndex) * 100 : 0;
  const endPercent = maxIndex > 0 ? (endIndex / maxIndex) * 100 : 100;
  const startLabel = points[startIndex]?.label ?? '';
  const endLabel = points[endIndex]?.label ?? startLabel;
  const baseline = 10;

  return (
    <div className="time-range-slider frequency-range-slider">
      <div className="slider-labels">
        <span className="range-label">{startLabel}</span>
        <span className="range-separator">–</span>
        <span className="range-label">{endLabel}</span>
      </div>

      <div className="slider-track" ref={trackRef} onClick={(event) => handleTrackClick(event.clientX)}>
        <svg
          className="slider-chart frequency-range-chart"
          viewBox={`0 0 ${Math.max(points.length, 1)} 20`}
          preserveAspectRatio="none"
        >
          <line
            className="frequency-range-baseline"
            x1={0}
            x2={Math.max(points.length, 1)}
            y1={baseline}
            y2={baseline}
          />
          {points.map((point, index) => {
            const additionHeight = (point.additions / maxMagnitude) * 8;
            const deletionHeight = (point.deletions / maxMagnitude) * 8;
            const isSelected = index >= startIndex && index <= endIndex;
            const opacity = isSelected ? 0.85 : 0.22;

            return (
              <g key={point.period}>
                <rect
                  x={index + 0.08}
                  y={baseline - additionHeight}
                  width={0.84}
                  height={additionHeight}
                  fill="#3fb950"
                  opacity={point.additions > 0 ? opacity : 0.08}
                />
                <rect
                  x={index + 0.08}
                  y={baseline}
                  width={0.84}
                  height={deletionHeight}
                  fill="#f85149"
                  opacity={point.deletions > 0 ? opacity : 0.08}
                />
              </g>
            );
          })}
        </svg>

        <div
          className="slider-selection"
          style={{
            left: `${startPercent}%`,
            width: `${endPercent - startPercent}%`,
          }}
        />

        {points.length > 1 && (
          <>
            <div
              className={`slider-handle slider-handle-start ${isDragging === 'start' ? 'dragging' : ''}`}
              style={{ left: `${startPercent}%` }}
              onMouseDown={(event) => {
                event.preventDefault();
                event.stopPropagation();
                setIsDragging('start');
              }}
            />
            <div
              className={`slider-handle slider-handle-end ${isDragging === 'end' ? 'dragging' : ''}`}
              style={{ left: `${endPercent}%` }}
              onMouseDown={(event) => {
                event.preventDefault();
                event.stopPropagation();
                setIsDragging('end');
              }}
            />
          </>
        )}
      </div>
    </div>
  );
}
