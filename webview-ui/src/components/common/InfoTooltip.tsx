/**
 * InfoTooltip - A small info icon with tooltip on hover.
 * Used to explain UI controls to users.
 */

import { useState, useRef, useEffect } from 'react';
import './InfoTooltip.css';

interface InfoTooltipProps {
  content: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
}

export function InfoTooltip({ content, position = 'top' }: InfoTooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [adjustedPosition, setAdjustedPosition] = useState(position);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLSpanElement>(null);

  // Adjust position if tooltip would overflow viewport
  useEffect(() => {
    if (isVisible && tooltipRef.current && containerRef.current) {
      const tooltip = tooltipRef.current;
      const rect = tooltip.getBoundingClientRect();

      // Check for overflow and adjust
      if (position === 'top' && rect.top < 0) {
        setAdjustedPosition('bottom');
      } else if (position === 'bottom' && rect.bottom > window.innerHeight) {
        setAdjustedPosition('top');
      } else if (position === 'left' && rect.left < 0) {
        setAdjustedPosition('right');
      } else if (position === 'right' && rect.right > window.innerWidth) {
        setAdjustedPosition('left');
      } else {
        setAdjustedPosition(position);
      }
    }
  }, [isVisible, position]);

  return (
    <span
      ref={containerRef}
      className="info-tooltip-container"
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
      onClick={(e) => {
        e.stopPropagation();
        setIsVisible(!isVisible);
      }}
    >
      <span className="info-icon" aria-label="Information">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
          <path d="M8 0a8 8 0 1 0 0 16A8 8 0 0 0 8 0zm1 12H7V7h2v5zm0-6H7V4h2v2z" />
        </svg>
      </span>
      {isVisible && (
        <div
          ref={tooltipRef}
          className={`info-tooltip info-tooltip-${adjustedPosition}`}
          role="tooltip"
        >
          {content}
        </div>
      )}
    </span>
  );
}
