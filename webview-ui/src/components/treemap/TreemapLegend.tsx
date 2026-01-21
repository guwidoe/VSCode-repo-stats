/**
 * TreemapLegend - Shows language colors or age gradient for the treemap.
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
      <div className="treemap-legend age-legend">
        <span className="age-label">Recent</span>
        <div className="age-gradient" />
        <span className="age-label">Old</span>
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
