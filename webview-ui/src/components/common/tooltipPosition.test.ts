import { describe, expect, it } from 'vitest';
import { computeTooltipPosition } from './tooltipPosition';

describe('computeTooltipPosition', () => {
  const viewport = { width: 800, height: 600 };
  const tooltipSize = { width: 220, height: 100 };

  it('keeps preferred placement when there is room', () => {
    const result = computeTooltipPosition({
      anchorRect: { left: 300, top: 300, width: 40, height: 24 },
      tooltipSize,
      viewport,
      preferredPlacement: 'top',
      offset: 10,
      padding: 8,
    });

    expect(result.placement).toBe('top');
    expect(result.top).toBe(190);
  });

  it('flips placement when preferred side overflows', () => {
    const result = computeTooltipPosition({
      anchorRect: { left: 300, top: 12, width: 40, height: 24 },
      tooltipSize,
      viewport,
      preferredPlacement: 'top',
      offset: 10,
      padding: 8,
    });

    expect(result.placement).toBe('bottom');
    expect(result.top).toBe(46);
  });

  it('clamps within viewport when no placement fully fits', () => {
    const result = computeTooltipPosition({
      anchorRect: { left: 2, top: 2, width: 8, height: 8 },
      tooltipSize: { width: 780, height: 580 },
      viewport,
      preferredPlacement: 'left',
      offset: 12,
      padding: 8,
    });

    expect(result.left).toBeGreaterThanOrEqual(8);
    expect(result.top).toBeGreaterThanOrEqual(8);
    expect(result.left + 780).toBeLessThanOrEqual(800 - 8);
    expect(result.top + 580).toBeLessThanOrEqual(600 - 8);
  });
});
