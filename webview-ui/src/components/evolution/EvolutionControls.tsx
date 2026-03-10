import { InfoTooltip } from '../common/InfoTooltip';
import type { EvolutionDimension } from '../../types';
import type { EvolutionAxisMode } from './evolutionUtils';

interface Props {
  dimension: EvolutionDimension;
  onDimensionChange: (dimension: EvolutionDimension) => void;
  axisMode: EvolutionAxisMode;
  onAxisModeChange: (mode: EvolutionAxisMode) => void;
  normalize: boolean;
  onNormalizeChange: (normalize: boolean) => void;
  maxSeries: number;
  onMaxSeriesChange: (value: number) => void;
  onRun: () => void;
  runLabel: string;
  disabled?: boolean;
}

export function EvolutionControls({
  dimension,
  onDimensionChange,
  axisMode,
  onAxisModeChange,
  normalize,
  onNormalizeChange,
  maxSeries,
  onMaxSeriesChange,
  onRun,
  runLabel,
  disabled,
}: Props) {
  return (
    <div className="evolution-controls">
      <label>
        <span>Dimension</span>
        <select
          value={dimension}
          onChange={(event) => onDimensionChange(event.target.value as EvolutionDimension)}
          disabled={disabled}
        >
          <option value="cohort">Cohorts</option>
          <option value="author">Authors</option>
          <option value="ext">Extensions</option>
          <option value="dir">Top-level dirs</option>
          <option value="domain">Email domains</option>
        </select>
      </label>

      <label>
        <span>
          X-axis view
          <InfoTooltip
            content="Sampling mode controls which history snapshots are computed. X-axis view only changes how those already-computed snapshots are displayed: by calendar time or by commit progression."
            position="bottom"
          />
        </span>
        <select
          value={axisMode}
          onChange={(event) => onAxisModeChange(event.target.value as EvolutionAxisMode)}
          disabled={disabled}
        >
          <option value="time">Calendar time</option>
          <option value="commit">Commit progression</option>
        </select>
      </label>

      <label className="evolution-checkbox">
        <input
          type="checkbox"
          checked={normalize}
          onChange={(event) => onNormalizeChange(event.target.checked)}
          disabled={disabled}
        />
        <span>Normalize to 100%</span>
      </label>

      <label>
        <span>Max series</span>
        <input
          type="range"
          min={5}
          max={100}
          value={maxSeries}
          onChange={(event) => onMaxSeriesChange(parseInt(event.target.value, 10))}
          disabled={disabled}
        />
        <span className="evolution-slider-value">{maxSeries}</span>
      </label>

      <button className="evolution-run-button" onClick={onRun} disabled={disabled}>
        {runLabel}
      </button>
    </div>
  );
}
