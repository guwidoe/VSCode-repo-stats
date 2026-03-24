import { useStore, selectAllWeeks, selectWeeklyCommitTotals } from '../../store';
import { useTimeRangeSliderModel } from './useTimeRangeSliderModel';
import './TimeRangeSlider.css';

export function TimeRangeSlider() {
  const allWeeks = useStore(selectAllWeeks);
  const weeklyTotals = useStore(selectWeeklyCommitTotals);
  const showEmptyTimePeriods = useStore((state) => state.settings?.showEmptyTimePeriods ?? true);
  const setTimeRange = useStore((state) => state.setTimeRange);

  const {
    trackRef,
    hasData,
    displayData,
    maxCommits,
    startLabel,
    endLabel,
    startPercent,
    endPercent,
    filledStartIdx,
    filledEndIdx,
    isDragging,
    beginDrag,
    handleTrackClickAt,
  } = useTimeRangeSliderModel({
    allWeeks,
    weeklyTotals,
    showEmptyTimePeriods,
    setTimeRange,
  });

  if (!hasData) {
    return null;
  }

  return (
    <div className="time-range-slider">
      <div className="slider-labels">
        <span className="range-label">{startLabel}</span>
        <span className="range-separator">–</span>
        <span className="range-label">{endLabel}</span>
      </div>

      <div className="slider-track" ref={trackRef} onClick={(event) => handleTrackClickAt(event.clientX)}>
        <svg className="slider-chart" viewBox={`0 0 ${displayData.length} 20`} preserveAspectRatio="none">
          {displayData.map((week, index) => {
            const barHeight = (week.commits / maxCommits) * 20;
            const isSelected = index >= filledStartIdx && index <= filledEndIdx;

            return (
              <rect
                key={week.week}
                x={index}
                y={20 - barHeight}
                width={1}
                height={barHeight}
                fill="var(--vscode-charts-blue)"
                opacity={isSelected ? 0.8 : 0.2}
              />
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
      </div>
    </div>
  );
}
