/**
 * Contributor Card - Displays individual contributor stats.
 */

import type { CommitContributorSummary, ContributorStats, FrequencyGranularity } from '../../types';
import { getAvatarColor, getInitials, formatNumber } from '../../utils/colors';
import { Sparkline } from './Sparkline';
import './ContributorCard.css';

interface Props {
  contributor: ContributorStats;
  rank: number;
  timeRangeWeeks: string[];
  granularity: FrequencyGranularity;
  commitSummary?: CommitContributorSummary;
}

export function ContributorCard({ contributor, rank, timeRangeWeeks, granularity, commitSummary }: Props) {
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

      {commitSummary && (
        <div className="commit-size-row">
          <div className="commit-size-stat">
            <span className="commit-size-value">Δ {formatNumber(Math.round(commitSummary.averageChangedLines))}</span>
            <span className="commit-size-label">avg / commit</span>
          </div>
          <div className="commit-size-stat">
            <span className="commit-size-value">Δ {formatNumber(Math.round(commitSummary.medianChangedLines))}</span>
            <span className="commit-size-label">median / commit</span>
          </div>
        </div>
      )}

      <div className="sparkline-container">
        <Sparkline
          activity={contributor.weeklyActivity}
          timeRangeWeeks={timeRangeWeeks}
          granularity={granularity}
        />
      </div>
    </div>
  );
}
