import { useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import {
  computeTooltipPosition,
  type RectLike,
  type TooltipPlacement,
} from './tooltipPosition';
import './TooltipSurface.css';

interface TooltipSurfaceProps {
  visible: boolean;
  anchorRef?: RefObject<HTMLElement | null>;
  anchorPoint?: { x: number; y: number } | null;
  followCursor?: boolean;
  children: ReactNode;
  preferredPlacement?: TooltipPlacement;
  offset?: number;
  viewportPadding?: number;
  className?: string;
  showArrow?: boolean;
}

interface TooltipState {
  left: number;
  top: number;
  placement: TooltipPlacement;
}

const DEFAULT_STATE: TooltipState = {
  left: -9999,
  top: -9999,
  placement: 'top',
};

function getAnchorRect(anchorRef?: RefObject<HTMLElement | null>): RectLike | null {
  return anchorRef?.current?.getBoundingClientRect() ?? null;
}

function positionFromCursor(
  point: { x: number; y: number },
  tooltipSize: { width: number; height: number },
  viewport: { width: number; height: number },
  offset: number,
  padding: number
): TooltipState {
  let left = point.x + offset;
  let top = point.y + offset;

  if (left + tooltipSize.width > viewport.width - padding) {
    left = point.x - tooltipSize.width - offset;
  }

  if (top + tooltipSize.height > viewport.height - padding) {
    top = point.y - tooltipSize.height - offset;
  }

  if (left < padding) {
    left = padding;
  }

  if (top < padding) {
    top = padding;
  }

  return {
    left,
    top,
    placement: 'right',
  };
}

function joinClasses(...classes: Array<string | undefined | false>): string {
  return classes.filter(Boolean).join(' ');
}

export function TooltipSurface({
  visible,
  anchorRef,
  anchorPoint,
  followCursor = false,
  children,
  preferredPlacement = 'top',
  offset = 10,
  viewportPadding = 8,
  className,
  showArrow = true,
}: TooltipSurfaceProps) {
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const [state, setState] = useState<TooltipState>(DEFAULT_STATE);

  useLayoutEffect(() => {
    if (!visible) {
      return;
    }

    const updatePosition = () => {
      const tooltipElement = tooltipRef.current;
      if (!tooltipElement) {
        return;
      }

      const tooltipRect = tooltipElement.getBoundingClientRect();
      const viewport = {
        width: window.innerWidth,
        height: window.innerHeight,
      };

      if (anchorPoint && followCursor) {
        setState(positionFromCursor(
          anchorPoint,
          {
            width: tooltipRect.width,
            height: tooltipRect.height,
          },
          viewport,
          offset,
          viewportPadding
        ));
        return;
      }

      const anchorRect = getAnchorRect(anchorRef);
      if (!anchorRect) {
        return;
      }

      const next = computeTooltipPosition({
        anchorRect,
        tooltipSize: {
          width: tooltipRect.width,
          height: tooltipRect.height,
        },
        viewport,
        preferredPlacement,
        offset,
        padding: viewportPadding,
      });

      setState(next);
    };

    updatePosition();

    const handleResize = () => updatePosition();
    const handleScroll = () => updatePosition();

    window.addEventListener('resize', handleResize);
    window.addEventListener('scroll', handleScroll, true);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [visible, anchorRef, anchorPoint, followCursor, preferredPlacement, offset, viewportPadding]);

  if (!visible) {
    return null;
  }

  return createPortal(
    <div
      ref={tooltipRef}
      role="tooltip"
      className={joinClasses(
        'tooltip-surface',
        `tooltip-surface-${state.placement}`,
        showArrow && 'tooltip-surface-with-arrow',
        className
      )}
      style={{
        left: state.left,
        top: state.top,
      }}
    >
      {children}
    </div>,
    document.body
  );
}
