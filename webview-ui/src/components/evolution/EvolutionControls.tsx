import type { EvolutionDimension } from '../../types';

interface Props {
  dimension: EvolutionDimension;
  onDimensionChange: (dimension: EvolutionDimension) => void;
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
