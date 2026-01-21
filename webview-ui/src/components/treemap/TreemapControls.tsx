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
  onColorModeChange: (mode: ColorMode) => void
  onSizeModeChange: (mode: SizeDisplayMode) => void
  onNestingDepthChange: (depth: number) => void
}

const MAX_NESTING_DEPTH = 10;
const MIN_NESTING_DEPTH = 1;

export function TreemapControls({
  colorMode,
  sizeMode,
  nestingDepth,
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
    if (nestingDepth < MAX_NESTING_DEPTH) {
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
              content="Language: Files colored by programming language. Age: Files colored by last modification date (green=recent, red=old)."
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
        </div>

        {/* Size mode toggle */}
        <div className="toggle-group">
          <span className="toggle-label">
            Size
            <InfoTooltip
              content="LOC: Size by lines of code (binary files hidden). Bytes: Size by file size in bytes. Files: Equal size per file to see file count distribution."
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
        </div>

        {/* Nesting depth control */}
        <div className="depth-control">
          <span className="depth-label">
            Depth
            <InfoTooltip
              content="How many directory levels to show. Lower values give a simpler overview, higher values show more detail. Click on a folder to navigate into it."
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
            disabled={nestingDepth >= MAX_NESTING_DEPTH}
          >
            +
          </button>
        </div>
      </div>
    </div>
  );
}
