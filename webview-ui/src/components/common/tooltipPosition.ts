export type TooltipPlacement = 'top' | 'bottom' | 'left' | 'right';

export interface RectLike {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface TooltipSize {
  width: number;
  height: number;
}

export interface ViewportSize {
  width: number;
  height: number;
}

export interface TooltipPositionInput {
  anchorRect: RectLike;
  tooltipSize: TooltipSize;
  viewport: ViewportSize;
  preferredPlacement: TooltipPlacement;
  offset: number;
  padding: number;
}

export interface TooltipPositionResult {
  left: number;
  top: number;
  placement: TooltipPlacement;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function oppositePlacement(placement: TooltipPlacement): TooltipPlacement {
  switch (placement) {
    case 'top':
      return 'bottom';
    case 'bottom':
      return 'top';
    case 'left':
      return 'right';
    case 'right':
      return 'left';
    default:
      return 'top';
  }
}

function fallbackPlacements(placement: TooltipPlacement): TooltipPlacement[] {
  if (placement === 'top' || placement === 'bottom') {
    return ['left', 'right'];
  }
  return ['top', 'bottom'];
}

function getCandidatePosition(
  placement: TooltipPlacement,
  anchorRect: RectLike,
  tooltipSize: TooltipSize,
  offset: number
): { left: number; top: number } {
  const anchorCenterX = anchorRect.left + anchorRect.width / 2;
  const anchorCenterY = anchorRect.top + anchorRect.height / 2;

  switch (placement) {
    case 'top':
      return {
        left: anchorCenterX - tooltipSize.width / 2,
        top: anchorRect.top - tooltipSize.height - offset,
      };
    case 'bottom':
      return {
        left: anchorCenterX - tooltipSize.width / 2,
        top: anchorRect.top + anchorRect.height + offset,
      };
    case 'left':
      return {
        left: anchorRect.left - tooltipSize.width - offset,
        top: anchorCenterY - tooltipSize.height / 2,
      };
    case 'right':
      return {
        left: anchorRect.left + anchorRect.width + offset,
        top: anchorCenterY - tooltipSize.height / 2,
      };
    default:
      return {
        left: anchorCenterX - tooltipSize.width / 2,
        top: anchorRect.top - tooltipSize.height - offset,
      };
  }
}

function fitsInViewport(
  left: number,
  top: number,
  tooltipSize: TooltipSize,
  viewport: ViewportSize,
  padding: number
): boolean {
  return (
    left >= padding &&
    top >= padding &&
    left + tooltipSize.width <= viewport.width - padding &&
    top + tooltipSize.height <= viewport.height - padding
  );
}

export function computeTooltipPosition(input: TooltipPositionInput): TooltipPositionResult {
  const {
    anchorRect,
    tooltipSize,
    viewport,
    preferredPlacement,
    offset,
    padding,
  } = input;

  const placements: TooltipPlacement[] = [
    preferredPlacement,
    oppositePlacement(preferredPlacement),
    ...fallbackPlacements(preferredPlacement),
  ];

  for (const placement of placements) {
    const candidate = getCandidatePosition(placement, anchorRect, tooltipSize, offset);
    if (fitsInViewport(candidate.left, candidate.top, tooltipSize, viewport, padding)) {
      return {
        left: candidate.left,
        top: candidate.top,
        placement,
      };
    }
  }

  const fallback = getCandidatePosition(preferredPlacement, anchorRect, tooltipSize, offset);
  const maxLeft = Math.max(padding, viewport.width - tooltipSize.width - padding);
  const maxTop = Math.max(padding, viewport.height - tooltipSize.height - padding);

  return {
    left: clamp(fallback.left, padding, maxLeft),
    top: clamp(fallback.top, padding, maxTop),
    placement: preferredPlacement,
  };
}
