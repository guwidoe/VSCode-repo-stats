/**
 * Commits Chart - Bar chart showing commits over time.
 */

import { useMemo } from 'react';
import Plot from 'react-plotly.js';
import type { ContributorStats, FrequencyGranularity } from '../../types';
import { useStore } from '../../store';
import { fillWeeklyGaps, fillMonthlyGaps } from '../../utils/fillTimeGaps';

interface Props {
  contributors: ContributorStats[];
  granularity: FrequencyGranularity;
}

/**
 * Parses an ISO week string to a Date.
 * Returns null for invalid weeks instead of epoch.
 */
function parseISOWeek(isoWeek: string): Date | null {
  const match = isoWeek.match(/^(\d{4})-W(\d{2})$/);
  if (!match) {return null;}

  const year = parseInt(match[1], 10);
  const week = parseInt(match[2], 10);

  // Validate reasonable year range (1970-2100)
  if (year < 1970 || year > 2100 || week < 1 || week > 53) {
    return null;
  }

  const jan4 = new Date(year, 0, 4);
  const dayOfWeek = jan4.getDay() || 7;
  const week1Monday = new Date(jan4);
  week1Monday.setDate(jan4.getDate() - dayOfWeek + 1);
  const weekStart = new Date(week1Monday);
  weekStart.setDate(week1Monday.getDate() + (week - 1) * 7);

  return weekStart;
}

/**
 * Formats an ISO week to a readable label with year.
 * Returns null if the week is invalid.
 */
function formatWeekLabel(isoWeek: string): string | null {
  const date = parseISOWeek(isoWeek);
  if (!date) {return null;}
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const year = date.getFullYear().toString().slice(2);
  return `${monthNames[date.getMonth()]} ${date.getDate()} '${year}`;
}

/**
 * Formats a month key to a readable label.
 */
function formatMonthLabel(monthKey: string): string {
  const match = monthKey.match(/^(\d{4})-(\d{2})$/);
  if (!match) {return monthKey;}
  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10) - 1;
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${monthNames[month]} ${year}`;
}

export function CommitsChart({ contributors, granularity }: Props) {
  const showEmptyTimePeriods = useStore((state) => state.settings?.showEmptyTimePeriods ?? true);

  const chartData = useMemo(() => {
    // Aggregate all weekly commits across contributors, filtering invalid weeks
    const weeklyMap = new Map<string, number>();

    for (const contributor of contributors) {
      for (const week of contributor.weeklyActivity) {
        // Only include valid weeks (skip any malformed data)
        if (parseISOWeek(week.week)) {
          weeklyMap.set(week.week, (weeklyMap.get(week.week) || 0) + week.commits);
        }
      }
    }

    // Sort by week and filter out any remaining invalid entries
    const weeks = Array.from(weeklyMap.entries())
      .filter(([week]) => parseISOWeek(week) !== null)
      .sort((a, b) => a[0].localeCompare(b[0]));

    if (granularity === 'monthly') {
      // Aggregate to monthly
      const monthlyMap = new Map<string, number>();
      const monthOrder: string[] = [];

      for (const [week, commits] of weeks) {
        const date = parseISOWeek(week);
        if (!date) {continue;} // Skip invalid weeks
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        if (!monthlyMap.has(monthKey)) {
          monthlyMap.set(monthKey, 0);
          monthOrder.push(monthKey);
        }
        monthlyMap.set(monthKey, monthlyMap.get(monthKey)! + commits);
      }

      // Filter out any invalid month labels (like 1970-01)
      const validMonths = monthOrder.filter(m => !m.startsWith('1970-'));

      // Convert to array format for gap filling
      let monthlyData = validMonths.map((month) => ({
        week: month,
        commits: monthlyMap.get(month) ?? 0,
      }));

      // Fill gaps if setting is enabled
      if (showEmptyTimePeriods) {
        monthlyData = fillMonthlyGaps(monthlyData, (month) => ({ week: month, commits: 0 }));
      }

      return {
        x: monthlyData.map((d) => formatMonthLabel(d.week)),
        y: monthlyData.map((d) => d.commits),
      };
    }

    // Filter out weeks that can't be formatted (invalid)
    const validWeeks = weeks.filter(([week]) => formatWeekLabel(week) !== null);

    // Convert to array format for gap filling
    let weeklyData = validWeeks.map(([week, commits]) => ({ week, commits }));

    // Fill gaps if setting is enabled
    if (showEmptyTimePeriods) {
      weeklyData = fillWeeklyGaps(weeklyData, (week) => ({ week, commits: 0 }));
    }

    return {
      x: weeklyData.map((d) => formatWeekLabel(d.week)!),
      y: weeklyData.map((d) => d.commits),
    };
  }, [contributors, granularity, showEmptyTimePeriods]);

  if (chartData.x.length === 0) {
    return (
      <div className="empty-chart">
        <p>No commit data available</p>
      </div>
    );
  }

  return (
    <Plot
      data={[
        {
          type: 'bar',
          x: chartData.x,
          y: chartData.y,
          marker: {
            color: 'var(--vscode-charts-blue)',
          },
          hovertemplate: '%{x}<br>%{y} commits<extra></extra>',
        },
      ]}
      layout={{
        autosize: true,
        height: 200,
        margin: { l: 40, r: 20, t: 10, b: 40 },
        paper_bgcolor: 'transparent',
        plot_bgcolor: 'transparent',
        font: {
          family: 'var(--vscode-font-family)',
          size: 11,
          color: 'var(--vscode-foreground)',
        },
        xaxis: {
          type: 'category',
          tickangle: -45,
          gridcolor: 'var(--vscode-panel-border)',
          zerolinecolor: 'var(--vscode-panel-border)',
          showgrid: false,
        },
        yaxis: {
          title: { text: 'Commits' },
          gridcolor: 'var(--vscode-panel-border)',
          zerolinecolor: 'var(--vscode-panel-border)',
        },
        dragmode: 'zoom',
        selectdirection: 'h',
      }}
      config={{
        responsive: true,
        displayModeBar: true,
        displaylogo: false,
        modeBarButtonsToRemove: ['lasso2d', 'select2d', 'zoomOut2d'],
        scrollZoom: false,
      }}
      style={{ width: '100%' }}
    />
  );
}
