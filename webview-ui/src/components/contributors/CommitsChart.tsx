/**
 * Commits Chart - Bar chart showing commits over time.
 */

import { useMemo } from 'react';
import Plot from 'react-plotly.js';
import type { ContributorStats, FrequencyGranularity } from '../../types';

interface Props {
  contributors: ContributorStats[];
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
 * Formats an ISO week to a readable label.
 */
function formatWeekLabel(isoWeek: string): string {
  const date = parseISOWeek(isoWeek);
  if (date.getTime() === 0) {return isoWeek;}
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${monthNames[date.getMonth()]} ${date.getDate()}`;
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
  const chartData = useMemo(() => {
    // Aggregate all weekly commits across contributors
    const weeklyMap = new Map<string, number>();

    for (const contributor of contributors) {
      for (const week of contributor.weeklyActivity) {
        weeklyMap.set(week.week, (weeklyMap.get(week.week) || 0) + week.commits);
      }
    }

    // Sort by week
    const weeks = Array.from(weeklyMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]));

    if (granularity === 'monthly') {
      // Aggregate to monthly
      const monthlyMap = new Map<string, number>();
      const monthOrder: string[] = [];

      for (const [week, commits] of weeks) {
        const date = parseISOWeek(week);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        if (!monthlyMap.has(monthKey)) {
          monthlyMap.set(monthKey, 0);
          monthOrder.push(monthKey);
        }
        monthlyMap.set(monthKey, monthlyMap.get(monthKey)! + commits);
      }

      return {
        x: monthOrder.map(formatMonthLabel),
        y: monthOrder.map((month) => monthlyMap.get(month) ?? 0),
      };
    }

    return {
      x: weeks.map(([week]) => formatWeekLabel(week)),
      y: weeks.map(([, commits]) => commits),
    };
  }, [contributors, granularity]);

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
        modeBarButtonsToRemove: ['lasso2d', 'select2d'],
      }}
      style={{ width: '100%' }}
    />
  );
}
