/**
 * TreemapControls - Control panel for treemap color mode, size mode, and nesting depth.
 * Uses dropdowns instead of toggle buttons to save space.
 */

import type { ColorMode } from '../../types';
import type { SizeDisplayMode } from './types';
import { InfoTooltip } from '../common/InfoTooltip';
import './TreemapControls.css';

interface TreemapControlsProps {
  colorMode: ColorMode;
  sizeMode: SizeDisplayMode;
  nestingDepth: number;
  maxDepth: number;
  onColorModeChange: (mode: ColorMode) => void;
  onSizeModeChange: (mode: SizeDisplayMode) => void;
  onNestingDepthChange: (depth: number) => void;
}

const MIN_NESTING_DEPTH = 1;

const COLOR_MODE_OPTIONS: { value: ColorMode; label: string }[] = [
  { value: 'language', label: 'Language' },
  { value: 'age', label: 'Age' },
  { value: 'complexity', label: 'Complexity' },
  { value: 'density', label: 'Density' },
];

const SIZE_MODE_OPTIONS: { value: SizeDisplayMode; label: string }[] = [
  { value: 'loc', label: 'LOC' },
  { value: 'bytes', label: 'Bytes' },
  { value: 'files', label: 'Files' },
  { value: 'complexity', label: 'Complexity' },
];

export function TreemapControls({
  colorMode,
  sizeMode,
  nestingDepth,
  maxDepth,
  onColorModeChange,
  onSizeModeChange,
  onNestingDepthChange,
}: TreemapControlsProps) {
  const handleDepthDecrease = () => {
    if (nestingDepth > MIN_NESTING_DEPTH) {
      onNestingDepthChange(nestingDepth - 1);
    }
  };

  const handleDepthIncrease = () => {
    if (nestingDepth < maxDepth) {
      onNestingDepthChange(nestingDepth + 1);
    }
  };

  return (
    <div className="treemap-controls">
      <div className="controls-right">
        {/* Color mode dropdown */}
        <div className="control-group">
          <label className="control-label">
            Color
            <InfoTooltip
              content="Language: by programming language. Age: by last modified (green=recent, red=old). Complexity: by cyclomatic complexity (green=simple, red=complex). Density: by code density (green=dense code, red=sparse)."
              position="bottom"
            />
          </label>
          <select
            className="control-select"
            value={colorMode}
            onChange={(e) => onColorModeChange(e.target.value as ColorMode)}
          >
            {COLOR_MODE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Size mode dropdown */}
        <div className="control-group">
          <label className="control-label">
            Size
            <InfoTooltip
              content="LOC: by lines of code. Bytes: by file size. Files: equal size per file. Complexity: by cyclomatic complexity (shows complex hotspots)."
              position="bottom"
            />
          </label>
          <select
            className="control-select"
            value={sizeMode}
            onChange={(e) => onSizeModeChange(e.target.value as SizeDisplayMode)}
          >
            {SIZE_MODE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Nesting depth control */}
        <div className="depth-control">
          <span className="depth-label">
            Depth
            <InfoTooltip
              content="How many directory levels to show. Lower values give a simpler overview, higher values show more detail. Double click on a folder to navigate into it. Double click on a file to open it."
              position="bottom"
            />
          </span>
          <button
            className="depth-button"
            onClick={handleDepthDecrease}
            disabled={nestingDepth <= MIN_NESTING_DEPTH}
          >
            −
          </button>
          <span className="depth-value">{nestingDepth}</span>
          <button
            className="depth-button"
            onClick={handleDepthIncrease}
            disabled={nestingDepth >= maxDepth}
          >
            +
          </button>
        </div>
      </div>
    </div>
  );
}
