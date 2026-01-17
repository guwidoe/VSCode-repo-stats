/**
 * Contributor Card - Displays individual contributor stats.
 */

import { useState, useCallback, useMemo } from 'react';
import type { ContributorStats, WeeklyCommit, FrequencyGranularity } from '../../types';
import { getAvatarColor, getInitials, formatNumber } from '../../utils/colors';
import './ContributorCard.css';

interface Props {
  contributor: ContributorStats;
  rank: number;
  timeRangeWeeks: string[];
  granularity: FrequencyGranularity;
}

export function ContributorCard({ contributor, rank, timeRangeWeeks, granularity }: Props) {
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
        <Sparkline
          activity={contributor.weeklyActivity}
          timeRangeWeeks={timeRangeWeeks}
          granularity={granularity}
        />
      </div>
    </div>
  );
}

// ============================================================================
// Sparkline Component
// ============================================================================

interface SparklineProps {
  activity: ContributorStats['weeklyActivity'];
  timeRangeWeeks: string[];
  granularity: FrequencyGranularity;
}

/**
 * Parses an ISO week string to a Date.
 */
function parseISOWeek(isoWeek: string): Date {
  const match = isoWeek.match(/^(\d{4})-W(\d{2})$/);
  if (!match) {return new Date(0);}

  const year = parseInt(match[1], 10);
  const week = parseInt(match[2], 10);

  const jan4 = new Date(year, 0, 4);
  const dayOfWeek = jan4.getDay() || 7;
  const week1Monday = new Date(jan4);
  week1Monday.setDate(jan4.getDate() - dayOfWeek + 1);
  const weekStart = new Date(week1Monday);
  weekStart.setDate(week1Monday.getDate() + (week - 1) * 7);

  return weekStart;
}

/**
 * Formats an ISO week string (e.g., "2025-W03") to a readable format.
 */
function formatWeek(isoWeek: string): string {
  const weekStart = parseISOWeek(isoWeek);
  if (weekStart.getTime() === 0) {return isoWeek;}

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${monthNames[weekStart.getMonth()]} ${weekStart.getDate()}, ${weekStart.getFullYear()}`;
}

/**
 * Formats a month key (e.g., "2025-01") to a readable format.
 */
function formatMonth(monthKey: string): string {
  const match = monthKey.match(/^(\d{4})-(\d{2})$/);
  if (!match) {return monthKey;}

  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10) - 1;

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${monthNames[month]} ${year}`;
}

/**
 * Converts a week to a month key.
 */
function weekToMonthKey(isoWeek: string): string {
  const date = parseISOWeek(isoWeek);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

interface ActivityData {
  key: string;
  commits: number;
}

function Sparkline({ activity, timeRangeWeeks, granularity }: SparklineProps) {
  const [tooltip, setTooltip] = useState<{ x: number; text: string } | null>(null);

  // Build a map of week -> commits for quick lookup
  const activityMap = useMemo(() => {
    const map = new Map<string, WeeklyCommit>();
    for (const week of activity) {
      map.set(week.week, week);
    }
    return map;
  }, [activity]);

  // Build the display data based on granularity
  const displayData = useMemo((): ActivityData[] => {
    if (granularity === 'weekly') {
      // Weekly: one bar per week
      return timeRangeWeeks.map((week) => ({
        key: week,
        commits: activityMap.get(week)?.commits ?? 0,
      }));
    } else {
      // Monthly: aggregate weeks into months
      const monthMap = new Map<string, number>();
      const monthOrder: string[] = [];

      for (const week of timeRangeWeeks) {
        const monthKey = weekToMonthKey(week);
        if (!monthMap.has(monthKey)) {
          monthMap.set(monthKey, 0);
          monthOrder.push(monthKey);
        }
        monthMap.set(monthKey, monthMap.get(monthKey)! + (activityMap.get(week)?.commits ?? 0));
      }

      return monthOrder.map((month) => ({
        key: month,
        commits: monthMap.get(month) ?? 0,
      }));
    }
  }, [timeRangeWeeks, activityMap, granularity]);

  const handleMouseEnter = useCallback((data: ActivityData, barX: number) => {
    const commitText = data.commits === 1 ? 'commit' : 'commits';
    const label = granularity === 'weekly' ? formatWeek(data.key) : formatMonth(data.key);
    setTooltip({ x: barX, text: `${label}: ${data.commits} ${commitText}` });
  }, [granularity]);

  const handleMouseLeave = useCallback(() => {
    setTooltip(null);
  }, []);

  if (displayData.length === 0) {
    return <div className="sparkline empty">No activity</div>;
  }

  const maxCommits = Math.max(...displayData.map((w) => w.commits), 1);
  const width = 200;
  const height = 30;
  const barWidth = Math.max(2, Math.floor(width / displayData.length) - 1);

  return (
    <div className="sparkline-wrapper">
      <svg
        className="sparkline"
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        onMouseLeave={handleMouseLeave}
      >
        {displayData.map((data, i) => {
          const barHeight = data.commits > 0 ? Math.max(2, (data.commits / maxCommits) * height) : 0;
          const x = (i / displayData.length) * width;
          return (
            <rect
              key={data.key}
              x={x}
              y={height - barHeight}
              width={barWidth}
              height={barHeight}
              fill="var(--vscode-charts-blue)"
              opacity={data.commits > 0 ? 0.8 : 0.1}
              onMouseEnter={() => handleMouseEnter(data, x)}
              style={{ cursor: 'pointer' }}
            />
          );
        })}
      </svg>
      {tooltip && (
        <div
          className="sparkline-tooltip"
          style={{ left: `${(tooltip.x / width) * 100}%` }}
        >
          {tooltip.text}
        </div>
      )}
    </div>
  );
}
