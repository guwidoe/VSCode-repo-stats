/**
 * Overview Panel - Dashboard showing repository statistics at a glance.
 */

import { useOverviewStats } from '../../hooks/useOverviewStats';
import { StatCard } from './StatCard';
import { DonutChart } from './DonutChart';
import { ExpandableDetails } from './ExpandableDetails';
import { getLanguageColor } from '../../utils/colors';
import './OverviewPanel.css';

export function OverviewPanel() {
  const stats = useOverviewStats();

  if (!stats) {
    return (
      <div className="overview-panel">
        <div className="empty-state">No data available</div>
      </div>
    );
  }

  // Prepare donut chart data for languages (top languages by LOC)
  const languageSegments = stats.loc.byLanguage
    .slice(0, 8)
    .map((lang) => ({
      label: lang.language,
      value: lang.lines,
      color: lang.color,
    }));

  const otherLoc = stats.loc.byLanguage
    .slice(8)
    .reduce((sum, lang) => sum + lang.lines, 0);
  if (otherLoc > 0) {
    languageSegments.push({
      label: 'Other',
      value: otherLoc,
      color: '#666666',
    });
  }

  // Prepare donut chart data for file types (top extensions)
  const extensionColors = [
    '#3178c6', '#f1e05a', '#ff3e00', '#41b883', '#e34c26',
    '#563d7c', '#3572A5', '#00ADD8', '#dea584', '#b07219',
  ];
  const fileTypeSegments = stats.files.byExtension
    .slice(0, 8)
    .map((ext, i) => ({
      label: ext.ext,
      value: ext.count,
      color: extensionColors[i % extensionColors.length],
    }));

  const otherFiles = stats.files.byExtension
    .slice(8)
    .reduce((sum, ext) => sum + ext.count, 0);
  if (otherFiles > 0) {
    fileTypeSegments.push({
      label: 'Other',
      value: otherFiles,
      color: '#666666',
    });
  }

  // Prepare full language details for expandable section
  const languageDetails = stats.loc.byLanguage.map((lang) => ({
    label: lang.language,
    value: lang.lines,
    color: lang.color,
    subtitle: `${lang.fileCount} files`,
  }));

  // Prepare full extension details
  const extensionDetails = stats.files.byExtension.map((ext, i) => ({
    label: ext.ext,
    value: ext.count,
    color: extensionColors[i % extensionColors.length],
  }));

  return (
    <div className="overview-panel">
      {/* Stat Cards Row */}
      <div className="stats-row">
        <StatCard
          label="Total Files"
          value={stats.files.total}
          subtitle={`${stats.files.codeFiles.toLocaleString()} code files`}
        />
        <StatCard
          label="Lines of Code"
          value={stats.loc.total}
          subtitle={stats.files.generatedFiles > 0
            ? `${stats.loc.excludingGenerated.toLocaleString()} excl. generated`
            : `${stats.loc.codeOnly.toLocaleString()} in code files`
          }
        />
        <StatCard
          label="Languages"
          value={stats.languages.count}
          subtitle={`${stats.languages.codeLanguages} programming`}
        />
        {stats.files.generatedFiles > 0 && (
          <StatCard
            label="Generated Files"
            value={stats.files.generatedFiles}
            subtitle="auto-detected"
          />
        )}
      </div>

      {/* Charts Row */}
      <div className="charts-row">
        <div className="chart-section">
          <DonutChart
            segments={languageSegments}
            title="Lines of Code by Language"
            size={200}
            thickness={40}
          />
          <ExpandableDetails
            rows={languageDetails}
            total={stats.loc.total}
            valueLabel="Lines"
          />
        </div>
        <div className="chart-section">
          <DonutChart
            segments={fileTypeSegments}
            title="Files by Type"
            size={200}
            thickness={40}
          />
          <ExpandableDetails
            rows={extensionDetails}
            total={stats.files.total}
            valueLabel="Files"
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
              {stats.unknownExtensions.slice(0, 15).map((ext) => (
                <span key={ext.ext} className="tag">
                  {ext.ext} <span className="tag-count">({ext.count})</span>
                </span>
              ))}
              {stats.unknownExtensions.length > 15 && (
                <span className="tag more">
                  +{stats.unknownExtensions.length - 15} more
                </span>
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
