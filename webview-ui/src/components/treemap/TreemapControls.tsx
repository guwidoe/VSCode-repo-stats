/**
 * TreemapControls - Control panel for treemap color mode, size mode, and nesting depth.
 */

import type { ColorMode } from '../../types';
import type { SizeDisplayMode } from './types';
import { InfoTooltip } from '../common/InfoTooltip';
import './TreemapControls.css';

interface TreemapControlsProps {
  colorMode: ColorMode
  sizeMode: SizeDisplayMode
  nestingDepth: number
  maxDepth: number
  onColorModeChange: (mode: ColorMode) => void
  onSizeModeChange: (mode: SizeDisplayMode) => void
  onNestingDepthChange: (depth: number) => void
}

const MIN_NESTING_DEPTH = 1;

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
        {/* Color mode toggle */}
        <div className="toggle-group">
          <span className="toggle-label">
            Color
            <InfoTooltip
              content="Language: by programming language. Age: by last modified (green=recent, red=old). Complexity: by cyclomatic complexity (green=simple, red=complex). Density: by code density (green=dense code, red=sparse)."
              position="bottom"
            />
          </span>
          <button
            className={`toggle-button ${colorMode === 'language' ? 'active' : ''}`}
            onClick={() => onColorModeChange('language')}
          >
            Language
          </button>
          <button
            className={`toggle-button ${colorMode === 'age' ? 'active' : ''}`}
            onClick={() => onColorModeChange('age')}
          >
            Age
          </button>
          <button
            className={`toggle-button ${colorMode === 'complexity' ? 'active' : ''}`}
            onClick={() => onColorModeChange('complexity')}
          >
            Complexity
          </button>
          <button
            className={`toggle-button ${colorMode === 'density' ? 'active' : ''}`}
            onClick={() => onColorModeChange('density')}
          >
            Density
          </button>
        </div>

        {/* Size mode toggle */}
        <div className="toggle-group">
          <span className="toggle-label">
            Size
            <InfoTooltip
              content="LOC: by lines of code. Bytes: by file size. Files: equal size per file. Complexity: by cyclomatic complexity (shows complex hotspots)."
              position="bottom"
            />
          </span>
          <button
            className={`toggle-button ${sizeMode === 'loc' ? 'active' : ''}`}
            onClick={() => onSizeModeChange('loc')}
          >
            LOC
          </button>
          <button
            className={`toggle-button ${sizeMode === 'bytes' ? 'active' : ''}`}
            onClick={() => onSizeModeChange('bytes')}
          >
            Bytes
          </button>
          <button
            className={`toggle-button ${sizeMode === 'files' ? 'active' : ''}`}
            onClick={() => onSizeModeChange('files')}
          >
            Files
          </button>
          <button
            className={`toggle-button ${sizeMode === 'complexity' ? 'active' : ''}`}
            onClick={() => onSizeModeChange('complexity')}
          >
            Complexity
          </button>
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
