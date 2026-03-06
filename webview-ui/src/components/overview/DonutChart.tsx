/**
 * SVG-based donut chart for displaying proportional data.
 * Groups segments into top N + "Other" for visualization,
 * but allows expanding to see all items in both donut and legend.
 */

import { useMemo, useState } from 'react';

const FULL_CIRCLE_ANGLE_THRESHOLD = 359.999;

export interface DonutSegment {
  label: string;
  value: number;
  color: string;
}

interface DonutChartProps {
  segments: DonutSegment[];
  size?: number;
  thickness?: number;
  title?: string;
  maxDonutSegments?: number;
  defaultLegendItems?: number;
  defaultDisplayMode?: 'percent' | 'count';
}

const OTHER_COLOR = '#666666';

function buildArcPath(center: number, radius: number, startAngle: number, angle: number): string {
  const startRad = (startAngle * Math.PI) / 180;
  const startX = center + radius * Math.cos(startRad);
  const startY = center + radius * Math.sin(startRad);

  if (angle >= FULL_CIRCLE_ANGLE_THRESHOLD) {
    const midRad = ((startAngle + 180) * Math.PI) / 180;
    const midX = center + radius * Math.cos(midRad);
    const midY = center + radius * Math.sin(midRad);

    return [
      `M ${startX} ${startY}`,
      `A ${radius} ${radius} 0 1 1 ${midX} ${midY}`,
      `A ${radius} ${radius} 0 1 1 ${startX} ${startY}`,
    ].join(' ');
  }

  const endAngle = startAngle + angle;
  const endRad = (endAngle * Math.PI) / 180;
  const endX = center + radius * Math.cos(endRad);
  const endY = center + radius * Math.sin(endRad);
  const largeArcFlag = angle > 180 ? 1 : 0;

  return [
    `M ${startX} ${startY}`,
    `A ${radius} ${radius} 0 ${largeArcFlag} 1 ${endX} ${endY}`,
  ].join(' ');
}

export function DonutChart({
  segments,
  size = 180,
  thickness = 35,
  title,
  maxDonutSegments = 8,
  defaultLegendItems = 6,
  defaultDisplayMode = 'percent',
}: DonutChartProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [displayMode, setDisplayMode] = useState<'percent' | 'count'>(defaultDisplayMode);
  const [expanded, setExpanded] = useState(false);

  // Sort and process all segments
  const { allSegments, total } = useMemo(() => {
    const total = segments.reduce((sum, s) => sum + s.value, 0);
    if (total === 0) {
      return { allSegments: [], total: 0 };
    }

    // Sort by value descending and ignore empty slices
    const sorted = [...segments]
      .filter((segment) => segment.value > 0)
      .sort((a, b) => b.value - a.value);
    const allSegments = sorted.map((seg) => ({
      ...seg,
      percentage: seg.value / total,
    }));

    return { allSegments, total };
  }, [segments]);

  // Determine which segments to show in donut based on expanded state
  const donutSegments = useMemo(() => {
    if (allSegments.length === 0) {
      return [];
    }

    if (expanded) {
      // Show all segments when expanded
      return allSegments;
    }

    // Show top N + "Other" when collapsed
    const topSegments = allSegments.slice(0, maxDonutSegments);
    const otherSegments = allSegments.slice(maxDonutSegments);
    const otherValue = otherSegments.reduce((sum, s) => sum + s.value, 0);

    if (otherValue > 0) {
      return [
        ...topSegments,
        {
          label: 'Other',
          value: otherValue,
          color: OTHER_COLOR,
          percentage: otherValue / total,
        },
      ];
    }

    return topSegments;
  }, [allSegments, expanded, maxDonutSegments, total]);

  // Calculate paths for the donut visualization
  const paths = useMemo(() => {
    if (total === 0) {
      return [];
    }

    const radius = (size - thickness) / 2;
    const center = size / 2;
    let currentAngle = -90; // Start from top

    return donutSegments.map((segment, index) => {
      const percentage = segment.value / total;
      const angle = percentage * 360;
      const startAngle = currentAngle;
      currentAngle += angle;

      return {
        d: buildArcPath(center, radius, startAngle, angle),
        color: segment.color,
        label: segment.label,
        value: segment.value,
        percentage,
        index,
      };
    });
  }, [donutSegments, total, size, thickness]);

  const hoveredSegment = hoveredIndex !== null ? paths[hoveredIndex] : null;

  // Legend items to display
  const legendItems = expanded
    ? allSegments
    : allSegments.slice(0, defaultLegendItems);
  const hiddenCount = allSegments.length - defaultLegendItems;

  return (
    <div className="donut-chart">
      <div className="donut-chart-header">
        {title && <h3 className="donut-chart-title">{title}</h3>}
        <div className="donut-display-toggle">
          <button
            className={`toggle-btn ${displayMode === 'percent' ? 'active' : ''}`}
            onClick={() => setDisplayMode('percent')}
            title="Show percentages"
          >
            %
          </button>
          <button
            className={`toggle-btn ${displayMode === 'count' ? 'active' : ''}`}
            onClick={() => setDisplayMode('count')}
            title="Show counts"
          >
            #
          </button>
        </div>
      </div>
      <div className="donut-chart-container">
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          {paths.map((path) => (
            <path
              key={`${path.label}-${path.index}`}
              d={path.d}
              fill="none"
              stroke={path.color}
              strokeWidth={thickness}
              strokeLinecap="butt"
              opacity={hoveredIndex === null || hoveredIndex === path.index ? 1 : 0.3}
              onMouseEnter={() => setHoveredIndex(path.index)}
              onMouseLeave={() => setHoveredIndex(null)}
              style={{ cursor: 'pointer', transition: 'opacity 0.15s ease' }}
            />
          ))}
        </svg>
        <div className="donut-chart-center">
          {hoveredSegment ? (
            <>
              <span className="donut-center-value">
                {displayMode === 'percent'
                  ? `${(hoveredSegment.percentage * 100).toFixed(1)}%`
                  : hoveredSegment.value.toLocaleString()}
              </span>
              <span className="donut-center-label">{hoveredSegment.label}</span>
            </>
          ) : (
            <>
              <span className="donut-center-value">{total.toLocaleString()}</span>
              <span className="donut-center-label">Total</span>
            </>
          )}
        </div>
      </div>
      <div className={`donut-chart-legend ${expanded ? 'expanded' : ''}`}>
        {legendItems.map((item) => (
          <div
            key={item.label}
            className={`legend-item ${hoveredIndex !== null && paths[hoveredIndex]?.label === item.label ? 'active' : ''}`}
            onMouseEnter={() => {
              const pathIdx = paths.findIndex((p) => p.label === item.label);
              if (pathIdx >= 0) {
                setHoveredIndex(pathIdx);
              }
            }}
            onMouseLeave={() => setHoveredIndex(null)}
          >
            <span
              className="legend-color"
              style={{ backgroundColor: item.color }}
            />
            <span className="legend-label">{item.label}</span>
            <span className="legend-value">
              {displayMode === 'percent'
                ? `${(item.percentage * 100).toFixed(1)}%`
                : item.value.toLocaleString()}
            </span>
          </div>
        ))}
        {hiddenCount > 0 && (
          <div
            className="legend-item other clickable"
            onClick={() => setExpanded(!expanded)}
            style={{ cursor: 'pointer' }}
          >
            <span className="legend-color" style={{ backgroundColor: OTHER_COLOR }} />
            <span className="legend-label">
              {expanded ? 'Show less' : `+${hiddenCount} more`}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
