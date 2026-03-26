/**
 * Code Frequency Panel - Shows additions/deletions over time.
 */

import { useDeferredValue, useMemo, useState } from 'react';
import Plot from 'react-plotly.js';
import { useStore, selectCodeFrequencySeries } from '../../store';
import { FrequencyGranularityToggle } from './FrequencyGranularityToggle';
import { SummaryCard } from './SummaryCard';
import { CodeFrequencyRangeSlider } from './CodeFrequencyRangeSlider';
import { prepareCodeFrequencyChartData } from './frequencyChartData';
import './CodeFrequencyPanel.css';

export function CodeFrequencyPanel() {
  const frequency = useStore(selectCodeFrequencySeries);
  const { frequencyGranularity, setFrequencyGranularity } = useStore();
  const settings = useStore((state) => state.settings)!;
  const [selectedRange, setSelectedRange] = useState<{ start: number; end: number } | null>(null);

  const showEmptyTimePeriods = settings.showEmptyTimePeriods;

  const chartPoints = useMemo(() => {
    return prepareCodeFrequencyChartData(frequency, showEmptyTimePeriods);
  }, [frequency, showEmptyTimePeriods]);

  const deferredChartPoints = useDeferredValue(chartPoints);
  const deferredSelectedRange = useDeferredValue(selectedRange);
  const deferredGranularity = useDeferredValue(frequencyGranularity);

  const visiblePoints = useMemo(() => {
    if (deferredChartPoints.length === 0) {
      return [];
    }

    if (!deferredSelectedRange) {
      return deferredChartPoints;
    }

    return deferredChartPoints.slice(deferredSelectedRange.start, deferredSelectedRange.end + 1);
  }, [deferredChartPoints, deferredSelectedRange]);

  const isStale = chartPoints !== deferredChartPoints ||
    selectedRange !== deferredSelectedRange ||
    frequencyGranularity !== deferredGranularity;

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
    <div className={`frequency-panel ${isStale ? 'updating' : ''}`}>
      <div className="panel-header">
        <h2>Code Frequency</h2>
        <div className="controls">
          <FrequencyGranularityToggle
            value={frequencyGranularity}
            onChange={setFrequencyGranularity}
          />
          <CodeFrequencyRangeSlider
            points={chartPoints}
            onRangeChange={(start, end) => setSelectedRange({ start, end })}
          />
        </div>
      </div>

      <div className="chart-container">
        <Plot
          data={[
            {
              type: 'bar',
              name: 'Additions',
              x: visiblePoints.map((point) => point.label),
              y: visiblePoints.map((point) => point.additions),
              marker: {
                color: '#3fb950', // Green for additions
              },
              hovertemplate: '%{x}<br>+%{y} lines<extra>Additions</extra>',
            },
            {
              type: 'bar',
              name: 'Deletions',
              x: visiblePoints.map((point) => point.label),
              y: visiblePoints.map((point) => -point.deletions),
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
          value={visiblePoints.reduce((sum, point) => sum + point.additions, 0)}
          color="#3fb950"
          prefix="+"
        />
        <SummaryCard
          label="Total Deletions"
          value={visiblePoints.reduce((sum, point) => sum + point.deletions, 0)}
          color="#f85149"
          prefix="-"
        />
        <SummaryCard
          label="Net Change"
          value={visiblePoints.reduce((sum, point) => sum + point.netChange, 0)}
          color="var(--vscode-foreground)"
        />
      </div>
    </div>
  );
}
