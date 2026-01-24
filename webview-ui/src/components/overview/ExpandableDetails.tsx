/**
 * Expandable details section showing full breakdown with absolute numbers.
 */

import { useState } from 'react';

interface DetailRow {
  label: string;
  value: number;
  color?: string;
  subtitle?: string;
}

interface ExpandableDetailsProps {
  rows: DetailRow[];
  total: number;
  valueLabel?: string;
  expanded?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
}

export function ExpandableDetails({
  rows,
  total,
  valueLabel = 'lines',
  expanded: controlledExpanded,
  onExpandedChange,
}: ExpandableDetailsProps) {
  const [internalExpanded, setInternalExpanded] = useState(false);

  // Support both controlled and uncontrolled modes
  const isControlled = controlledExpanded !== undefined;
  const expanded = isControlled ? controlledExpanded : internalExpanded;

  const handleToggle = () => {
    const newValue = !expanded;
    if (onExpandedChange) {
      onExpandedChange(newValue);
    }
    if (!isControlled) {
      setInternalExpanded(newValue);
    }
  };

  if (rows.length === 0) {
    return null;
  }

  return (
    <div className="expandable-details">
      <button
        className="expand-toggle"
        onClick={handleToggle}
        aria-expanded={expanded}
      >
        {expanded ? 'Hide details' : 'Show all details'}
        <span className="expand-icon">{expanded ? '▲' : '▼'}</span>
      </button>
      {expanded && (
        <div className="details-table">
          <div className="details-header">
            <span className="details-col-name">Name</span>
            <span className="details-col-value">{valueLabel}</span>
            <span className="details-col-percent">%</span>
          </div>
          {rows.map((row) => (
            <div key={row.label} className="details-row">
              <span className="details-col-name">
                {row.color && (
                  <span
                    className="details-color-dot"
                    style={{ backgroundColor: row.color }}
                  />
                )}
                <span className="details-label">{row.label}</span>
                {row.subtitle && (
                  <span className="details-subtitle">{row.subtitle}</span>
                )}
              </span>
              <span className="details-col-value">
                {row.value.toLocaleString()}
              </span>
              <span className="details-col-percent">
                {total > 0 ? ((row.value / total) * 100).toFixed(1) : 0}%
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
