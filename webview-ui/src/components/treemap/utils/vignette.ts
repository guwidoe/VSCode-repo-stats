import { adjustBrightness } from './colors';

/**
 * Bounds for a rectangular region
 */
export interface Bounds {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/**
 * Maximum offset as a fraction of tile dimensions (25% of tile size)
 */
const MAX_OFFSET_FRACTION = 0.25;

/**
 * Create a radial gradient for vignette effect
 * Center is brighter, edges are darker
 *
 * When parentBounds is provided, the gradient center is offset toward
 * the parent's center (WizTree-style grouping effect). The offset is
 * clamped relative to the tile's own dimensions to ensure the center
 * stays within the tile bounds.
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
  // Tile's geometric center
  let cx = (x0 + x1) / 2;
  let cy = (y0 + y1) / 2;

  // Tile dimensions
  const width = x1 - x0;
  const height = y1 - y0;

  // If parent bounds provided, offset center toward parent's center
  // The offset is relative to the tile's own size, not the distance to parent
  if (parentBounds) {
    const pcx = (parentBounds.x0 + parentBounds.x1) / 2;
    const pcy = (parentBounds.y0 + parentBounds.y1) / 2;

    // Direction vector from tile center to parent center
    const dx = pcx - cx;
    const dy = pcy - cy;

    // Normalize and scale by tile dimensions
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > 0) {
      // Offset by at most MAX_OFFSET_FRACTION of the tile's dimensions
      const maxOffsetX = width * MAX_OFFSET_FRACTION;
      const maxOffsetY = height * MAX_OFFSET_FRACTION;

      // Calculate offset in the direction of the parent
      const normDx = dx / dist;
      const normDy = dy / dist;

      cx += normDx * maxOffsetX;
      cy += normDy * maxOffsetY;
    }
  }

  const rx = (x1 - x0) / 2;
  const ry = (y1 - y0) / 2;
  // Use 1.4x the max dimension for a softer, larger gradient
  const radius = Math.max(rx, ry) * 1.4;

  const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
  gradient.addColorStop(0, adjustBrightness(baseColor, 1.1)); // Center: 10% brighter
  gradient.addColorStop(1, adjustBrightness(baseColor, 0.5)); // Edge: 50% darker

  return gradient;
}

/**
 * Draw a tile with vignette shading effect
 *
 * When parentBounds is provided, the vignette center is offset toward
 * the parent's center for a WizTree-style visual grouping effect.
 */
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
