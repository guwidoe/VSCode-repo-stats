/**
 * InfoTooltip - A small info icon with tooltip on hover/focus.
 * Uses shared TooltipSurface for viewport-aware placement.
 */

import { useRef, useState } from 'react';
import { TooltipSurface } from './TooltipSurface';
import type { TooltipPlacement } from './tooltipPosition';
import './InfoTooltip.css';

interface InfoTooltipProps {
  content: string;
  position?: TooltipPlacement;
}

export function InfoTooltip({ content, position = 'top' }: InfoTooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const containerRef = useRef<HTMLSpanElement>(null);

  return (
    <span
      ref={containerRef}
      className="info-tooltip-container"
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
      onFocus={() => setIsVisible(true)}
      onBlur={() => setIsVisible(false)}
      onClick={(event) => {
        event.stopPropagation();
        setIsVisible((current) => !current);
      }}
      tabIndex={0}
      aria-label="Information"
    >
      <span className="info-icon" aria-hidden="true">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
          <path d="M8 0a8 8 0 1 0 0 16A8 8 0 0 0 8 0zm1 12H7V7h2v5zm0-6H7V4h2v2z" />
        </svg>
      </span>
      <TooltipSurface
        visible={isVisible}
        anchorRef={containerRef}
        preferredPlacement={position}
        className="info-tooltip-surface"
        showArrow
      >
        {content}
      </TooltipSurface>
    </span>
  );
}
