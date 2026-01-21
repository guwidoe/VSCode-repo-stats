import { adjustBrightness } from './colors';

/**
 * Create a radial gradient for vignette effect
 * Center is brighter, edges are darker
 */
export function createVignetteGradient(
  ctx: CanvasRenderingContext2D,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  baseColor: string
): CanvasGradient {
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  const rx = (x1 - x0) / 2;
  const ry = (y1 - y0) / 2;
  const radius = Math.max(rx, ry);

  const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
  gradient.addColorStop(0, adjustBrightness(baseColor, 1.1)); // Center: 10% brighter
  gradient.addColorStop(1, adjustBrightness(baseColor, 0.5)); // Edge: 50% darker

  return gradient;
}

/**
 * Draw a tile with vignette shading effect
 */
export function drawVignetteTile(
  ctx: CanvasRenderingContext2D,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  baseColor: string
): void {
  const width = x1 - x0;
  const height = y1 - y0;

  if (width < 1 || height < 1) {
    return;
  }

  const gradient = createVignetteGradient(ctx, x0, y0, x1, y1, baseColor);
  ctx.fillStyle = gradient;
  ctx.fillRect(x0, y0, width, height);
}
