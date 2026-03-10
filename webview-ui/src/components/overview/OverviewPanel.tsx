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

  const commitContributorSegments = useMemo(
    () => data.commitAnalytics.contributorSummaries
      .map((contributor) => ({
        label: contributor.authorName,
        value: contributor.totalCommits,
        color: getAvatarColor(contributor.authorEmail),
      }))
      .sort((a, b) => b.value - a.value),
    [data.commitAnalytics.contributorSummaries]
  );

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

  const statCards = [
    {
      key: 'files' as const,
      icon: '📄',
      tone: 'blue',
      label: 'Total Files',
      value: stats.files.total.toLocaleString(),
      subtitle: `${stats.files.codeFiles.toLocaleString()} code files`,
    },
    {
      key: 'loc' as const,
      icon: '🧮',
      tone: 'orange',
      label: 'Total LOC',
      value: stats.loc.total.toLocaleString(),
      subtitle: `${stats.loc.codeOnly.toLocaleString()} code-only LOC`,
    },
    {
      key: 'commits' as const,
      icon: '✅',
      tone: 'green',
      label: 'Total Commits',
      value: data.repository.commitCount.toLocaleString(),
      subtitle: data.limitReached
        ? `${data.commitAnalytics.summary.totalCommits.toLocaleString()} analyzed in detail (limit ${data.maxCommitsLimit.toLocaleString()})`
        : 'All repository commits analyzed',
    },
    {
      key: 'contributors' as const,
      icon: '👥',
      tone: 'purple',
      label: 'Contributors',
      value: data.contributors.length.toLocaleString(),
      subtitle: `${data.commitAnalytics.contributorSummaries.length.toLocaleString()} with commit activity`,
    },
  ];

  return (
    <div className="overview-panel">
      <div className="stats-row">
        {statCards.map((card) => (
          <div key={card.key} className="stat-card">
            <div className={`stat-card-icon stat-card-icon-${card.tone}`} aria-hidden="true">
              <span className="stat-card-icon-glyph">{card.icon}</span>
            </div>
            <div className="stat-card-content">
              <span className="stat-card-value">{card.value}</span>
              <span className="stat-card-label">{card.label}</span>
              <span className="stat-card-subtitle">{card.subtitle}</span>
            </div>
          </div>
        ))}
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
          {commitContributorSegments.length > 0 ? (
            <DonutChart
              segments={commitContributorSegments}
              title="Commits by Contributor"
              size={200}
              thickness={40}
              defaultDisplayMode={defaultDisplayMode}
            />
          ) : (
            <div className="chart-empty">No commit contributor data available</div>
          )}
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
      </div>

      {stats.submodules.count > 0 && (
        <div className="info-row">
          <div className="info-section submodule-section">
            <h3 className="section-title">
              Git Submodules
              <span className="section-count">{stats.submodules.count.toLocaleString()}</span>
            </h3>
            <p className="section-description">
              {stats.submodules.included
                ? 'Submodule files are included in this analysis.'
                : 'Submodule files are currently excluded from analysis.'}
            </p>
            <div className="submodule-list">
              {stats.submodules.paths.map((path) => (
                <span key={path} className="submodule-path">{path}</span>
              ))}
            </div>
          </div>
        </div>
      )}

      {(blameIsUpdating || stats.blame.totals.filesSkipped > 0) && (
        <div className="info-row">
          <div className="info-section">
            <h3 className="section-title">Blame Coverage</h3>
            <p className="section-description">
              {blameIsUpdating
                ? 'Line ownership and age metrics are still updating in the background.'
                : 'Some files were skipped during blame analysis.'}
            </p>
            <div className="binary-categories">
              <div className="binary-category">
                <span className="category-name">Files analyzed</span>
                <span className="category-count">{stats.blame.totals.filesAnalyzed.toLocaleString()}</span>
              </div>
              <div className="binary-category">
                <span className="category-name">Files skipped</span>
                <span className="category-count">{stats.blame.totals.filesSkipped.toLocaleString()}</span>
              </div>
              <div className="binary-category">
                <span className="category-name">Cache hits</span>
                <span className="category-count">{stats.blame.totals.cacheHits.toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
