/**
 * Overview Panel - Dashboard showing repository statistics at a glance.
 */

import { useMemo, useState } from 'react';
import { useStore } from '../../store';
import { useOverviewStats } from '../../hooks/useOverviewStats';
import { getAvatarColor } from '../../utils/colors';
import { bucketizeAgeByDay, type AgeBucketDefinition } from '../../utils/ageBuckets';
import { DonutChart } from './DonutChart';
import './OverviewPanel.css';

const DEFAULT_AGE_BUCKETS: AgeBucketDefinition[] = [
  { label: '0-30d', min: 0, max: 30, color: '#4caf50' },
  { label: '31-90d', min: 31, max: 90, color: '#8bc34a' },
  { label: '91-180d', min: 91, max: 180, color: '#ffeb3b' },
  { label: '181-365d', min: 181, max: 365, color: '#ff9800' },
  { label: '1-2y', min: 366, max: 730, color: '#ff7043' },
  { label: '>2y', min: 731, max: Number.MAX_SAFE_INTEGER, color: '#e53935' },
];

export function OverviewPanel() {
  const stats = useOverviewStats();
  const data = useStore((state) => state.data)!;
  const settings = useStore((state) => state.settings)!;
  const loading = useStore((state) => state.loading);
  const [showAllUnknown, setShowAllUnknown] = useState(false);

  const defaultDisplayMode = settings.overviewDisplayMode;
  const blameIsUpdating =
    loading.isLoading && loading.phase.startsWith('Analyzing line ownership and age');

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

  const contributorSegments = useMemo(() => {
    const byAuthor = new Map<string, { lines: number; email: string }>();

    for (const owner of stats.blame.ownershipByAuthor) {
      const existing = byAuthor.get(owner.author);
      if (!existing) {
        byAuthor.set(owner.author, { lines: owner.lines, email: owner.email });
      } else {
        existing.lines += owner.lines;
      }
    }

    return Array.from(byAuthor.entries())
      .map(([author, entry]) => ({
        label: author,
        value: entry.lines,
        color: getAvatarColor(entry.email),
      }))
      .sort((a, b) => b.value - a.value);
  }, [stats.blame.ownershipByAuthor]);

  const ageBucketSegments = useMemo(
    () => bucketizeAgeByDay(stats.blame.ageByDay, DEFAULT_AGE_BUCKETS),
    [stats.blame.ageByDay]
  );

  return (
    <div className="overview-panel">
      <div className="stats-row">
        <div className="stat-card">
          <div className="stat-card-icon">📄</div>
          <div className="stat-card-content">
            <span className="stat-card-value">{stats.files.total.toLocaleString()}</span>
            <span className="stat-card-label">Total Files</span>
            <span className="stat-card-subtitle">{stats.files.codeFiles.toLocaleString()} code files</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon">🧮</div>
          <div className="stat-card-content">
            <span className="stat-card-value">{stats.loc.total.toLocaleString()}</span>
            <span className="stat-card-label">Total LOC</span>
            <span className="stat-card-subtitle">{stats.loc.codeOnly.toLocaleString()} code-only LOC</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon">✅</div>
          <div className="stat-card-content">
            <span className="stat-card-value">{data.commitAnalytics.summary.totalCommits.toLocaleString()}</span>
            <span className="stat-card-label">Total Commits</span>
            <span className="stat-card-subtitle">{data.repository.commitCount.toLocaleString()} commits in repository history</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon">👥</div>
          <div className="stat-card-content">
            <span className="stat-card-value">{data.contributors.length.toLocaleString()}</span>
            <span className="stat-card-label">Contributors</span>
            <span className="stat-card-subtitle">{data.commitAnalytics.contributorSummaries.length.toLocaleString()} with commit activity</span>
          </div>
        </div>
      </div>

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
        <div className="chart-section">
          {contributorSegments.length > 0 ? (
            <DonutChart
              segments={contributorSegments}
              title="Line Ownership by Contributor (HEAD)"
              size={200}
              thickness={40}
              defaultDisplayMode={defaultDisplayMode}
            />
          ) : (
            <div className="chart-empty">No blame ownership data available</div>
          )}
        </div>
        <div className="chart-section">
          {ageBucketSegments.length > 0 ? (
            <DonutChart
              segments={ageBucketSegments}
              title="Line Age by Last Commit (git blame)"
              size={200}
              thickness={40}
              defaultDisplayMode={defaultDisplayMode}
            />
          ) : (
            <div className="chart-empty">No line-age data available</div>
          )}
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

        <div className="info-section">
          <h3 className="section-title">
            Blame Metrics
            <span className="section-count">{stats.blame.totals.totalBlamedLines.toLocaleString()} LOC</span>
          </h3>
          <p className="section-description">
            Files analyzed: {stats.blame.totals.filesAnalyzed.toLocaleString()} · Files skipped: {stats.blame.totals.filesSkipped.toLocaleString()} · Cache hits: {stats.blame.totals.cacheHits.toLocaleString()}
            {blameIsUpdating && ' · Updating live…'}
          </p>
          <p className="section-description">
            Blame charts use physical line ownership (including comments/blank lines). The language LOC donut uses scc code-line metrics, so totals can differ.
          </p>
        </div>

        {stats.submodules && stats.submodules.count > 0 && (
          <div className="info-section submodules-notice">
            <h3 className="section-title">
              Git Submodules
              <span className="section-count">{stats.submodules.count}</span>
            </h3>
            <p className="section-description">
              {settings?.includeSubmodules
                ? 'Submodule files are included in file analysis (Overview + Files + Treemap). Contributors, Code Frequency, and Evolution still use parent-repo history only.'
                : 'Submodule files are excluded from file analysis. Enable "Include Git Submodules in File Analysis" in Settings to include them in Overview + Files + Treemap.'}
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

    </div>
  );
}
