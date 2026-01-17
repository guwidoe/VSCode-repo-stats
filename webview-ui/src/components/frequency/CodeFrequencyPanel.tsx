import React from 'react';
import Plot from 'react-plotly.js';
import { useStore } from '../../store';

export const CodeFrequencyPanel: React.FC = () => {
  const { codeFrequency, frequencyGranularity, setFrequencyGranularity } = useStore();

  if (codeFrequency.length === 0) {
    return (
      <div className="panel">
        <p>No code frequency data available.</p>
      </div>
    );
  }

  // Group by month if monthly granularity is selected
  const data = React.useMemo(() => {
    if (frequencyGranularity === 'weekly') {
      return codeFrequency;
    }

    // Group by month
    const monthlyMap = new Map<string, { additions: number; deletions: number }>();

    codeFrequency.forEach((item) => {
      // Extract year-month from ISO week (e.g., "2025-W03" -> "2025-01")
      const [year, week] = item.week.split('-W');
      const weekNum = parseInt(week, 10);
      // Approximate month from week number
      const month = Math.min(12, Math.ceil(weekNum / 4.33));
      const monthKey = `${year}-${String(month).padStart(2, '0')}`;

      const current = monthlyMap.get(monthKey) || { additions: 0, deletions: 0 };
      monthlyMap.set(monthKey, {
        additions: current.additions + item.additions,
        deletions: current.deletions + item.deletions,
      });
    });

    return Array.from(monthlyMap.entries())
      .map(([month, values]) => ({
        week: month,
        additions: values.additions,
        deletions: values.deletions,
        netChange: values.additions - values.deletions,
      }))
      .sort((a, b) => a.week.localeCompare(b.week));
  }, [codeFrequency, frequencyGranularity]);

  return (
    <div className="panel">
      <div className="frequency-controls">
        <button
          className={`toggle-button ${frequencyGranularity === 'weekly' ? 'active' : ''}`}
          onClick={() => setFrequencyGranularity('weekly')}
        >
          Weekly
        </button>
        <button
          className={`toggle-button ${frequencyGranularity === 'monthly' ? 'active' : ''}`}
          onClick={() => setFrequencyGranularity('monthly')}
        >
          Monthly
        </button>
      </div>

      <Plot
        data={[
          {
            x: data.map((d) => d.week),
            y: data.map((d) => d.additions),
            type: 'bar',
            name: 'Additions',
            marker: {
              color: 'var(--vscode-gitDecoration-addedResourceForeground, #28a745)',
            },
            hovertemplate: '%{x}<br>+%{y} lines<extra></extra>',
          },
          {
            x: data.map((d) => d.week),
            y: data.map((d) => -d.deletions),
            type: 'bar',
            name: 'Deletions',
            marker: {
              color: 'var(--vscode-gitDecoration-deletedResourceForeground, #dc3545)',
            },
            hovertemplate: '%{x}<br>-%{customdata} lines<extra></extra>',
            customdata: data.map((d) => d.deletions),
          },
        ]}
        layout={{
          barmode: 'relative',
          title: {
            text: 'Code Frequency',
            font: { size: 14 },
          },
          xaxis: {
            title: { text: frequencyGranularity === 'weekly' ? 'Week' : 'Month' },
            tickangle: -45,
            tickfont: { size: 10 },
          },
          yaxis: {
            title: { text: 'Lines of Code' },
          },
          legend: {
            orientation: 'h',
            y: -0.3,
          },
          margin: { l: 60, r: 20, t: 40, b: 100 },
          paper_bgcolor: 'transparent',
          plot_bgcolor: 'transparent',
          font: {
            color: 'var(--vscode-foreground, #cccccc)',
          },
          autosize: true,
        }}
        config={{
          responsive: true,
          displayModeBar: true,
          modeBarButtonsToRemove: ['lasso2d', 'select2d'],
        }}
        style={{ width: '100%', height: '400px' }}
      />
    </div>
  );
};
