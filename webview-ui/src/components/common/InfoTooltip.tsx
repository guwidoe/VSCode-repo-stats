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
  const [alignRight, setAlignRight] = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLSpanElement>(null);

  // Adjust position if tooltip would overflow viewport
  useEffect(() => {
    if (isVisible && tooltipRef.current && containerRef.current) {
      const tooltip = tooltipRef.current;
      const container = containerRef.current;
      const tooltipRect = tooltip.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();

      // Check vertical overflow and adjust position
      if (position === 'top' && tooltipRect.top < 0) {
        setAdjustedPosition('bottom');
      } else if (position === 'bottom' && tooltipRect.bottom > window.innerHeight) {
        setAdjustedPosition('top');
      } else if (position === 'left' && tooltipRect.left < 0) {
        setAdjustedPosition('right');
      } else if (position === 'right' && tooltipRect.right > window.innerWidth) {
        setAdjustedPosition('left');
      } else {
        setAdjustedPosition(position);
      }

      // Check horizontal overflow for top/bottom positions
      if (position === 'top' || position === 'bottom') {
        // If tooltip would overflow on the right, align it to the right
        if (containerRect.left + tooltipRect.width > window.innerWidth - 16) {
          setAlignRight(true);
        } else {
          setAlignRight(false);
        }
      }
    }
  }, [isVisible, position]);

  const tooltipClasses = [
    'info-tooltip',
    `info-tooltip-${adjustedPosition}`,
    alignRight ? 'info-tooltip-align-right' : '',
  ].filter(Boolean).join(' ');

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
          className={tooltipClasses}
          role="tooltip"
        >
          {content}
        </div>
      )}
    </span>
  );
}
