/**
 * TreemapControls - Control panel for treemap color mode, size mode, and nesting depth.
 */

import type { ColorMode } from '../../types'
import type { SizeDisplayMode } from './types'
import './TreemapControls.css'

interface TreemapControlsProps {
  colorMode: ColorMode
  sizeMode: SizeDisplayMode
  nestingDepth: number
  onColorModeChange: (mode: ColorMode) => void
  onSizeModeChange: (mode: SizeDisplayMode) => void
  onNestingDepthChange: (depth: number) => void
}

const MAX_NESTING_DEPTH = 10
const MIN_NESTING_DEPTH = 1

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
      onNestingDepthChange(nestingDepth - 1)
    }
  }

  const handleDepthIncrease = () => {
    if (nestingDepth < MAX_NESTING_DEPTH) {
      onNestingDepthChange(nestingDepth + 1)
    }
  }

  return (
    <div className="treemap-controls">
      <div className="controls-right">
        {/* Color mode toggle */}
        <div className="toggle-group">
          <button
            className={`toggle-button ${colorMode === 'language' ? 'active' : ''}`}
            onClick={() => onColorModeChange('language')}
          >
            By Language
          </button>
          <button
            className={`toggle-button ${colorMode === 'age' ? 'active' : ''}`}
            onClick={() => onColorModeChange('age')}
          >
            By Age
          </button>
        </div>

        {/* Size mode toggle */}
        <div className="toggle-group">
          <button
            className={`toggle-button ${sizeMode === 'loc' ? 'active' : ''}`}
            onClick={() => onSizeModeChange('loc')}
            title="Size by lines of code"
          >
            LOC
          </button>
          <button
            className={`toggle-button ${sizeMode === 'bytes' ? 'active' : ''}`}
            onClick={() => onSizeModeChange('bytes')}
            title="Size by file size in bytes"
          >
            Bytes
          </button>
          <button
            className={`toggle-button ${sizeMode === 'files' ? 'active' : ''}`}
            onClick={() => onSizeModeChange('files')}
            title="Size by file count"
          >
            Files
          </button>
        </div>

        {/* Nesting depth control */}
        <div className="depth-control">
          <span className="depth-label">Depth:</span>
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
  )
}
