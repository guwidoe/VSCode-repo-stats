import { useMemo } from 'react';
import Plot from 'react-plotly.js';
import type { ContributorStats, FrequencyGranularity } from '../../types';
import { useStore } from '../../store';
import { fillWeeklyGaps, fillMonthlyGaps } from '../../utils/fillTimeGaps';
import { formatMonthLabel, formatWeekLabel, parseISOWeek, weekToMonthKey } from '../../utils/timeSeries';

interface Props {
  contributors: ContributorStats[];
  granularity: FrequencyGranularity;
}

export function CommitsChart({ contributors, granularity }: Props) {
  const settings = useStore((state) => state.settings)!;
  const showEmptyTimePeriods = settings.showEmptyTimePeriods;

  const chartData = useMemo(() => {
    // Aggregate all weekly commits across contributors, filtering invalid weeks
    const weeklyMap = new Map<string, number>();

    for (const contributor of contributors) {
      for (const week of contributor.weeklyActivity) {
        // Only include valid weeks (skip any malformed data)
        if (parseISOWeek(week.week)) {
          weeklyMap.set(week.week, (weeklyMap.get(week.week) ?? 0) + week.commits);
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
        const monthKey = weekToMonthKey(week);
        if (!monthKey) {continue;}
        if (!monthlyMap.has(monthKey)) {
          monthlyMap.set(monthKey, 0);
          monthOrder.push(monthKey);
        }
        monthlyMap.set(monthKey, monthlyMap.get(monthKey)! + commits);
      }

      // Convert to array format for gap filling
      let monthlyData = monthOrder.map((month) => ({
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
