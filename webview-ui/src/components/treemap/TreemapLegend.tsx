/**
 * TreemapLegend - Shows legend for the current color mode.
 * - Language: colored swatches with LOC counts
 * - Age: gradient from green (recent) to red (old)
 * - Complexity: gradient from green (simple) to red (complex)
 * - Density: gradient from red (sparse) to green (dense)
 */

import type { ColorMode } from '../../types';
import { getLanguageColor, formatNumber } from '../../utils/colors';
import './TreemapLegend.css';

interface TreemapLegendProps {
  colorMode: ColorMode;
  languageCounts: Map<string, number>;
}

const MAX_LEGEND_ITEMS = 8;

export function TreemapLegend({ colorMode, languageCounts }: TreemapLegendProps) {
  if (colorMode === 'age') {
    return (
      <div className="treemap-legend gradient-legend">
        <span className="gradient-title">Age:</span>
        <span className="gradient-label">Recent</span>
        <div className="gradient-bar age-gradient" />
        <span className="gradient-label">Old</span>
      </div>
    );
  }

  if (colorMode === 'complexity') {
    return (
      <div className="treemap-legend gradient-legend">
        <span className="gradient-title">Complexity:</span>
        <span className="gradient-label">Simple</span>
        <div className="gradient-bar complexity-gradient" />
        <span className="gradient-label">Complex</span>
      </div>
    );
  }

  if (colorMode === 'density') {
    return (
      <div className="treemap-legend gradient-legend">
        <span className="gradient-title">Density:</span>
        <span className="gradient-label">Sparse</span>
        <div className="gradient-bar density-gradient" />
        <span className="gradient-label">Dense</span>
      </div>
    );
  }

  // Language mode
  const sortedLanguages = Array.from(languageCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, MAX_LEGEND_ITEMS);

  return (
    <div className="treemap-legend language-legend">
      {sortedLanguages.map(([language, count]) => (
        <div key={language} className="legend-item">
          <span
            className="legend-color"
            style={{ backgroundColor: getLanguageColor(language) }}
          />
          <span className="legend-label">{language}</span>
          <span className="legend-count">{formatNumber(count)}</span>
        </div>
      ))}
    </div>
  );
}
