/**
 * Commits Chart - Bar chart showing commits over time.
 */

import { useMemo } from 'react';
import Plot from 'react-plotly.js';
import type { ContributorStats } from '../../types';

interface Props {
  contributors: ContributorStats[];
}

export function CommitsChart({ contributors }: Props) {
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

    return {
      x: weeks.map(([week]) => week),
      y: weeks.map(([, commits]) => commits),
    };
  }, [contributors]);

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
