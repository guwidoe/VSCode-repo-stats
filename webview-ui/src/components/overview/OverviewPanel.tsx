/**
 * Overview Panel - Dashboard showing repository statistics at a glance.
 */

import { useState } from 'react';
import { useStore } from '../../store';
import { useOverviewStats } from '../../hooks/useOverviewStats';
import { DonutChart } from './DonutChart';
import { getLanguageColor } from '../../utils/colors';
import './OverviewPanel.css';

export function OverviewPanel() {
  const stats = useOverviewStats();
  const settings = useStore((state) => state.settings);
  const [showAllUnknown, setShowAllUnknown] = useState(false);

  const defaultDisplayMode = settings?.overviewDisplayMode ?? 'percent';

  if (!stats) {
    return (
      <div className="overview-panel">
        <div className="empty-state">No data available</div>
      </div>
    );
  }

  // Prepare donut chart data for languages (all languages by LOC)
  const languageSegments = stats.loc.byLanguage.map((lang) => ({
    label: lang.language,
    value: lang.lines,
    color: lang.color,
  }));

  // Prepare donut chart data for file types (all extensions)
  const extensionColors = [
    '#3178c6', '#f1e05a', '#ff3e00', '#41b883', '#e34c26',
    '#563d7c', '#3572A5', '#00ADD8', '#dea584', '#b07219',
  ];
  const fileTypeSegments = stats.files.byExtension.map((ext, i) => ({
    label: ext.ext,
    value: ext.count,
    color: extensionColors[i % extensionColors.length],
  }));

  return (
    <div className="overview-panel">
      {/* Charts Row */}
      <div className="charts-row">
        <div className="chart-section">
          <DonutChart
            segments={languageSegments}
            title="Lines of Code by Language"
            size={200}
            thickness={40}
            defaultDisplayMode={defaultDisplayMode}
          />
        </div>
        <div className="chart-section">
          <DonutChart
            segments={fileTypeSegments}
            title="Files by Type"
            size={200}
            thickness={40}
            defaultDisplayMode={defaultDisplayMode}
          />
        </div>
      </div>

      {/* Unknown Extensions & Binary Files Row */}
      <div className="info-row">
        {stats.unknownExtensions.length > 0 && (
          <div className="info-section">
            <h3 className="section-title">Unknown File Types</h3>
            <p className="section-description">
              Extensions not mapped to a language:
            </p>
            <div className="tag-list">
              {(showAllUnknown ? stats.unknownExtensions : stats.unknownExtensions.slice(0, 15)).map((ext) => (
                <span key={ext.ext} className="tag">
                  {ext.ext} <span className="tag-count">({ext.count})</span>
                </span>
              ))}
              {stats.unknownExtensions.length > 15 && (
                <button
                  className="tag more clickable"
                  onClick={() => setShowAllUnknown(!showAllUnknown)}
                >
                  {showAllUnknown
                    ? 'Show less'
                    : `+${stats.unknownExtensions.length - 15} more`}
                </button>
              )}
            </div>
          </div>
        )}

        {stats.binary.total > 0 && (
          <div className="info-section">
            <h3 className="section-title">
              Binary Files
              <span className="section-count">{stats.binary.total.toLocaleString()}</span>
            </h3>
            <div className="binary-categories">
              {stats.binary.byCategory.map((cat) => (
                <div key={cat.category} className="binary-category">
                  <span className="category-name">{cat.category}</span>
                  <span className="category-count">{cat.count}</span>
                  <span className="category-exts">
                    {cat.extensions.join(', ')}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {stats.submodules && stats.submodules.count > 0 && (
          <div className="info-section submodules-notice">
            <h3 className="section-title">
              Git Submodules
              <span className="section-count">{stats.submodules.count}</span>
            </h3>
            <p className="section-description">
              Submodules are excluded from analysis. To analyze them, open each submodule as a separate workspace.
            </p>
            <div className="submodule-list">
              {stats.submodules.paths.map((path) => (
                <div key={path} className="submodule-path">
                  {path}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Largest Files Section */}
      <div className="largest-files-section">
        <h3 className="section-title">
          Largest Code Files
          <span className="section-subtitle">(excluding generated)</span>
        </h3>
        <div className="largest-files-list">
          {stats.largestFiles.map((file, index) => (
            <div key={file.path} className="file-row">
              <span className="file-rank">{index + 1}</span>
              <span
                className="file-language-dot"
                style={{ backgroundColor: getLanguageColor(file.language) }}
                title={file.language}
              />
              <span className="file-path" title={file.path}>
                {file.path}
              </span>
              <span className="file-lines">
                {file.lines.toLocaleString()} lines
              </span>
            </div>
          ))}
          {stats.largestFiles.length === 0 && (
            <div className="empty-files">No code files found</div>
          )}
        </div>
      </div>
    </div>
  );
}
