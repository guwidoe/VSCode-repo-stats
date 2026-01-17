/**
 * Contributor Card - Displays individual contributor stats.
 */

import type { ContributorStats } from '../../types';
import { getAvatarColor, getInitials, formatNumber } from '../../utils/colors';
import './ContributorCard.css';

interface Props {
  contributor: ContributorStats;
  rank: number;
}

export function ContributorCard({ contributor, rank }: Props) {
  const avatarColor = getAvatarColor(contributor.email);
  const initials = getInitials(contributor.name);

  return (
    <div className="contributor-card">
      <div className="card-header">
        <div
          className="avatar"
          style={{ backgroundColor: avatarColor }}
        >
          {initials}
        </div>
        <div className="contributor-info">
          <span className="contributor-name">{contributor.name}</span>
          <span className="contributor-email">{contributor.email}</span>
        </div>
        <div className="rank-badge">#{rank}</div>
      </div>

      <div className="stats-row">
        <div className="stat">
          <span className="stat-value">{formatNumber(contributor.commits)}</span>
          <span className="stat-label">commits</span>
        </div>
        <div className="stat additions">
          <span className="stat-value">+{formatNumber(contributor.linesAdded)}</span>
          <span className="stat-label">added</span>
        </div>
        <div className="stat deletions">
          <span className="stat-value">-{formatNumber(contributor.linesDeleted)}</span>
          <span className="stat-label">deleted</span>
        </div>
      </div>

      <div className="sparkline-container">
        <Sparkline activity={contributor.weeklyActivity} />
      </div>
    </div>
  );
}

// ============================================================================
// Sparkline Component
// ============================================================================

interface SparklineProps {
  activity: ContributorStats['weeklyActivity'];
}

function Sparkline({ activity }: SparklineProps) {
  if (activity.length === 0) {
    return <div className="sparkline empty">No activity</div>;
  }

  const maxCommits = Math.max(...activity.map((w) => w.commits), 1);
  const width = 200;
  const height = 30;
  const barWidth = Math.max(2, Math.floor(width / activity.length) - 1);

  return (
    <svg className="sparkline" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
      {activity.map((week, i) => {
        const barHeight = (week.commits / maxCommits) * height;
        const x = (i / activity.length) * width;
        return (
          <rect
            key={week.week}
            x={x}
            y={height - barHeight}
            width={barWidth}
            height={barHeight}
            fill="var(--vscode-charts-blue)"
            opacity={0.8}
          />
        );
      })}
    </svg>
  );
}
