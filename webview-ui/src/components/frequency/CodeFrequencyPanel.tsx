/**
 * Code Frequency Panel - Shows additions/deletions over time.
 */

import { useMemo } from 'react';
import Plot from 'react-plotly.js';
import { useStore, selectFilteredCodeFrequency } from '../../store';
import { TimePeriodFilter } from '../contributors/TimePeriodFilter';
import { FrequencyGranularityToggle } from './FrequencyGranularityToggle';
import { SummaryCard } from './SummaryCard';
import { fillWeeklyGaps, fillMonthlyGaps, parseISOWeek } from '../../utils/fillTimeGaps';
import './CodeFrequencyPanel.css';

/**
 * Formats an ISO week to a readable label with year.
 */
function formatWeekLabel(isoWeek: string): string {
  const date = parseISOWeek(isoWeek);
  if (!date) {return isoWeek;}
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

export function CodeFrequencyPanel() {
  const frequency = useStore(selectFilteredCodeFrequency);
  const { frequencyGranularity, setFrequencyGranularity } = useStore();
  const showEmptyTimePeriods = useStore((state) => state.settings?.showEmptyTimePeriods ?? true);

  const chartData = useMemo(() => {
    let data = frequency;

    // Check if data is monthly (YYYY-MM format) or weekly (YYYY-Www format)
    const isMonthly = frequency.length > 0 && frequency[0].week.match(/^\d{4}-\d{2}$/) !== null;

    // Fill gaps if setting is enabled
    if (showEmptyTimePeriods && frequency.length > 0) {
      const createEmptyEntry = (week: string) => ({
        week,
        additions: 0,
        deletions: 0,
        netChange: 0,
      });

      if (isMonthly) {
        data = fillMonthlyGaps(frequency, createEmptyEntry);
      } else {
        data = fillWeeklyGaps(frequency, createEmptyEntry);
      }
    }

    // Format labels based on granularity
    const formatLabel = isMonthly ? formatMonthLabel : formatWeekLabel;

    return {
      x: data.map((f) => formatLabel(f.week)),
      additions: data.map((f) => f.additions),
      deletions: data.map((f) => -f.deletions), // Negative for downward bars
    };
  }, [frequency, showEmptyTimePeriods]);

  if (frequency.length === 0) {
    return (
      <div className="frequency-panel">
        <div className="panel-header">
          <h2>Code Frequency</h2>
        </div>
        <div className="empty-state">
          <p>No code frequency data available for the selected time period.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="frequency-panel">
      <div className="panel-header">
        <h2>Code Frequency</h2>
        <div className="controls">
          <FrequencyGranularityToggle
            value={frequencyGranularity}
            onChange={setFrequencyGranularity}
          />
          <TimePeriodFilter />
        </div>
      </div>

      <div className="chart-container">
        <Plot
          data={[
            {
              type: 'bar',
              name: 'Additions',
              x: chartData.x,
              y: chartData.additions,
              marker: {
                color: '#3fb950', // Green for additions
              },
              hovertemplate: '%{x}<br>+%{y} lines<extra>Additions</extra>',
            },
            {
              type: 'bar',
              name: 'Deletions',
              x: chartData.x,
              y: chartData.deletions,
              marker: {
                color: '#f85149', // Red for deletions
              },
              hovertemplate: '%{x}<br>%{y} lines<extra>Deletions</extra>',
            },
          ]}
          layout={{
            autosize: true,
            height: 400,
            margin: { l: 60, r: 20, t: 20, b: 60 },
            paper_bgcolor: 'transparent',
            plot_bgcolor: 'transparent',
            font: {
              family: 'var(--vscode-font-family)',
              size: 11,
              color: 'var(--vscode-foreground)',
            },
            barmode: 'relative',
            bargap: 0.1,
            xaxis: {
              type: 'category',
              tickangle: -45,
              gridcolor: 'var(--vscode-panel-border)',
              zerolinecolor: 'var(--vscode-panel-border)',
              showgrid: false,
            },
            yaxis: {
              title: { text: 'Lines of Code' },
              gridcolor: 'var(--vscode-panel-border)',
              zerolinecolor: 'var(--vscode-foreground)',
              zerolinewidth: 1,
            },
            legend: {
              orientation: 'h',
              x: 0.5,
              xanchor: 'center',
              y: 1.1,
            },
            dragmode: 'zoom',
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
      </div>

      <div className="summary-stats">
        <SummaryCard
          label="Total Additions"
          value={chartData.additions.reduce((a, b) => a + b, 0)}
          color="#3fb950"
          prefix="+"
        />
        <SummaryCard
          label="Total Deletions"
          value={Math.abs(chartData.deletions.reduce((a, b) => a + b, 0))}
          color="#f85149"
          prefix="-"
        />
        <SummaryCard
          label="Net Change"
          value={chartData.additions.reduce((a, b) => a + b, 0) + chartData.deletions.reduce((a, b) => a + b, 0)}
          color="var(--vscode-foreground)"
        />
      </div>
    </div>
  );
}
