/**
 * Code Frequency Panel - Shows additions/deletions over time.
 */

import { useMemo } from 'react';
import Plot from 'react-plotly.js';
import { useStore, selectFilteredCodeFrequency } from '../../store';
import { TimePeriodFilter } from '../contributors/TimePeriodFilter';
import type { FrequencyGranularity } from '../../types';
import './CodeFrequencyPanel.css';

const GRANULARITY_OPTIONS: { id: FrequencyGranularity; label: string }[] = [
  { id: 'weekly', label: 'Weekly' },
  { id: 'monthly', label: 'Monthly' },
];

export function CodeFrequencyPanel() {
  const frequency = useStore(selectFilteredCodeFrequency);
  const { frequencyGranularity, setFrequencyGranularity } = useStore();

  const chartData = useMemo(() => {
    return {
      x: frequency.map((f) => f.week),
      additions: frequency.map((f) => f.additions),
      deletions: frequency.map((f) => -f.deletions), // Negative for downward bars
    };
  }, [frequency]);

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
          <GranularityToggle
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
                color: 'var(--vscode-gitDecoration-addedResourceForeground, #3fb950)',
              },
              hovertemplate: '%{x}<br>+%{y} lines<extra>Additions</extra>',
            },
            {
              type: 'bar',
              name: 'Deletions',
              x: chartData.x,
              y: chartData.deletions,
              marker: {
                color: 'var(--vscode-gitDecoration-deletedResourceForeground, #f85149)',
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
            modeBarButtonsToRemove: ['lasso2d', 'select2d'],
            scrollZoom: true,
          }}
          style={{ width: '100%' }}
        />
      </div>

      <div className="summary-stats">
        <SummaryCard
          label="Total Additions"
          value={chartData.additions.reduce((a, b) => a + b, 0)}
          color="var(--vscode-gitDecoration-addedResourceForeground, #3fb950)"
          prefix="+"
        />
        <SummaryCard
          label="Total Deletions"
          value={Math.abs(chartData.deletions.reduce((a, b) => a + b, 0))}
          color="var(--vscode-gitDecoration-deletedResourceForeground, #f85149)"
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

// ============================================================================
// Granularity Toggle
// ============================================================================

interface GranularityToggleProps {
  value: FrequencyGranularity;
  onChange: (value: FrequencyGranularity) => void;
}

function GranularityToggle({ value, onChange }: GranularityToggleProps) {
  return (
    <div className="granularity-toggle">
      {GRANULARITY_OPTIONS.map((option) => (
        <button
          key={option.id}
          className={`toggle-button ${value === option.id ? 'active' : ''}`}
          onClick={() => onChange(option.id)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

// ============================================================================
// Summary Card
// ============================================================================

interface SummaryCardProps {
  label: string;
  value: number;
  color: string;
  prefix?: string;
}

function SummaryCard({ label, value, color, prefix = '' }: SummaryCardProps) {
  const formattedValue = value >= 0 ? `${prefix}${formatLargeNumber(value)}` : formatLargeNumber(value);

  return (
    <div className="summary-card">
      <span className="summary-label">{label}</span>
      <span className="summary-value" style={{ color }}>
        {formattedValue}
      </span>
    </div>
  );
}

function formatLargeNumber(num: number): string {
  const absNum = Math.abs(num);
  if (absNum >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  }
  if (absNum >= 1000) {
    return (num / 1000).toFixed(1) + 'K';
  }
  return num.toLocaleString();
}
