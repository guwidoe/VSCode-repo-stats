import type { CodeFrequencyChartPoint } from './frequencyChartData';
import { useCodeFrequencyRangeSliderModel } from './useCodeFrequencyRangeSliderModel';
import '../contributors/TimeRangeSlider.css';
import './CodeFrequencyRangeSlider.css';

interface Props {
  points: CodeFrequencyChartPoint[];
  onRangeChange: (start: number, end: number) => void;
}

export function CodeFrequencyRangeSlider({ points, onRangeChange }: Props) {
  const {
    trackRef,
    hasData,
    maxMagnitude,
    startLabel,
    endLabel,
    startPercent,
    endPercent,
    startIndex,
    endIndex,
    isDragging,
    beginDrag,
    handleTrackClickAt,
  } = useCodeFrequencyRangeSliderModel({ points, onRangeChange });

  if (!hasData) {
    return null;
  }

  const baseline = 10;

  return (
    <div className="time-range-slider frequency-range-slider">
      <div className="slider-labels">
        <span className="range-label">{startLabel}</span>
        <span className="range-separator">–</span>
        <span className="range-label">{endLabel}</span>
      </div>

      <div className="slider-track" ref={trackRef} onClick={(event) => handleTrackClickAt(event.clientX)}>
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
                beginDrag('start');
              }}
            />
            <div
              className={`slider-handle slider-handle-end ${isDragging === 'end' ? 'dragging' : ''}`}
              style={{ left: `${endPercent}%` }}
              onMouseDown={(event) => {
                event.preventDefault();
                event.stopPropagation();
                beginDrag('end');
              }}
            />
          </>
        )}
      </div>
    </div>
  );
}
