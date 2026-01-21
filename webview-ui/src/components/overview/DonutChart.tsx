/**
 * SVG-based donut chart for displaying proportional data.
 */

import { useMemo, useState } from 'react';

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
}

export function DonutChart({
  segments,
  size = 180,
  thickness = 35,
  title,
}: DonutChartProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const { paths, total } = useMemo(() => {
    const total = segments.reduce((sum, s) => sum + s.value, 0);
    if (total === 0) {
      return { paths: [], total: 0 };
    }

    const radius = (size - thickness) / 2;
    const center = size / 2;
    let currentAngle = -90; // Start from top

    const paths = segments.map((segment, index) => {
      const percentage = segment.value / total;
      const angle = percentage * 360;
      const startAngle = currentAngle;
      const endAngle = currentAngle + angle;
      currentAngle = endAngle;

      // Convert angles to radians
      const startRad = (startAngle * Math.PI) / 180;
      const endRad = (endAngle * Math.PI) / 180;

      // Calculate arc points
      const x1 = center + radius * Math.cos(startRad);
      const y1 = center + radius * Math.sin(startRad);
      const x2 = center + radius * Math.cos(endRad);
      const y2 = center + radius * Math.sin(endRad);

      // Large arc flag: 1 if angle > 180
      const largeArcFlag = angle > 180 ? 1 : 0;

      // SVG arc path
      const d = [
        `M ${x1} ${y1}`,
        `A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2}`,
      ].join(' ');

      return {
        d,
        color: segment.color,
        label: segment.label,
        value: segment.value,
        percentage,
        index,
      };
    });

    return { paths, total };
  }, [segments, size, thickness]);

  const hoveredSegment = hoveredIndex !== null ? paths[hoveredIndex] : null;

  return (
    <div className="donut-chart">
      {title && <h3 className="donut-chart-title">{title}</h3>}
      <div className="donut-chart-container">
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          {paths.map((path) => (
            <path
              key={path.index}
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
                {(hoveredSegment.percentage * 100).toFixed(1)}%
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
      <div className="donut-chart-legend">
        {paths.slice(0, 6).map((path) => (
          <div
            key={path.index}
            className={`legend-item ${hoveredIndex === path.index ? 'active' : ''}`}
            onMouseEnter={() => setHoveredIndex(path.index)}
            onMouseLeave={() => setHoveredIndex(null)}
          >
            <span
              className="legend-color"
              style={{ backgroundColor: path.color }}
            />
            <span className="legend-label">{path.label}</span>
            <span className="legend-value">
              {(path.percentage * 100).toFixed(1)}%
            </span>
          </div>
        ))}
        {paths.length > 6 && (
          <div className="legend-item other">
            <span className="legend-color" style={{ backgroundColor: '#666' }} />
            <span className="legend-label">+{paths.length - 6} more</span>
          </div>
        )}
      </div>
    </div>
  );
}
