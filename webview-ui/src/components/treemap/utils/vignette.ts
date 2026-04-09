import { adjustBrightness } from './colors';

export interface Bounds {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

const MAX_OFFSET_FRACTION = 0.25;

/**
 * Uses a parent-directed center offset to mimic WizTree-style grouping while
 * clamping the shift to the tile's own dimensions.
 */
export function createVignetteGradient(
  ctx: CanvasRenderingContext2D,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  baseColor: string,
  parentBounds?: Bounds
): CanvasGradient {
  let cx = (x0 + x1) / 2;
  let cy = (y0 + y1) / 2;

  const width = x1 - x0;
  const height = y1 - y0;

  if (parentBounds) {
    const pcx = (parentBounds.x0 + parentBounds.x1) / 2;
    const pcy = (parentBounds.y0 + parentBounds.y1) / 2;

    const dx = pcx - cx;
    const dy = pcy - cy;

    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > 0) {
      const maxOffsetX = width * MAX_OFFSET_FRACTION;
      const maxOffsetY = height * MAX_OFFSET_FRACTION;

      const normDx = dx / dist;
      const normDy = dy / dist;

      cx += normDx * maxOffsetX;
      cy += normDy * maxOffsetY;
    }
  }

  const rx = (x1 - x0) / 2;
  const ry = (y1 - y0) / 2;
  const radius = Math.max(rx, ry) * 1.4;

  const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
  gradient.addColorStop(0, adjustBrightness(baseColor, 1.1)); // Center: 10% brighter
  gradient.addColorStop(1, adjustBrightness(baseColor, 0.5)); // Edge: 50% darker

  return gradient;
}

export function drawVignetteTile(
  ctx: CanvasRenderingContext2D,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  baseColor: string,
  parentBounds?: Bounds
): void {
  const width = x1 - x0;
  const height = y1 - y0;

  if (width < 1 || height < 1) {
    return;
  }

  const gradient = createVignetteGradient(
    ctx, x0, y0, x1, y1, baseColor, parentBounds
  );
  ctx.fillStyle = gradient;
  ctx.fillRect(x0, y0, width, height);
}
