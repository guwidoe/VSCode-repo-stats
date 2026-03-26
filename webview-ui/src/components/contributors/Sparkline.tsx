/**
 * Sparkline Component - Small inline bar chart for activity visualization.
 */

import { useState, useCallback, useMemo } from 'react';
import type { ContributorStats, WeeklyCommit, FrequencyGranularity } from '../../types';
import { formatMonthLabel, formatWeekTooltipLabel, weekToMonthKey } from '../../utils/timeSeries';

interface SparklineProps {
  activity: ContributorStats['weeklyActivity'];
  timeRangeWeeks: string[];
  granularity: FrequencyGranularity;
}

interface ActivityData {
  key: string;
  commits: number;
}

export function Sparkline({ activity, timeRangeWeeks, granularity }: SparklineProps) {
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
        if (!monthKey) {
          continue;
        }
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
    const label = granularity === 'weekly'
      ? (formatWeekTooltipLabel(data.key) ?? data.key)
      : formatMonthLabel(data.key);
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
