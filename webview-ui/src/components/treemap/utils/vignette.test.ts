import { describe, it, expect, vi } from 'vitest';
import { createVignetteGradient, drawVignetteTile } from './vignette';

describe('createVignetteGradient', () => {
  it('should create a radial gradient with correct parameters', () => {
    const mockGradient = {
      addColorStop: vi.fn(),
    };
    const mockCtx = {
      createRadialGradient: vi.fn(() => mockGradient),
    } as unknown as CanvasRenderingContext2D;

    const gradient = createVignetteGradient(mockCtx, 0, 0, 100, 80, '#ff0000');

    // Center should be at (50, 40), radius should be max(50, 40) * 1.4 = 70
    expect(mockCtx.createRadialGradient).toHaveBeenCalledWith(50, 40, 0, 50, 40, 70);
    expect(mockGradient.addColorStop).toHaveBeenCalledTimes(2);
    expect(gradient).toBe(mockGradient);
  });

  it('should use correct color stops for vignette effect', () => {
    const mockGradient = {
      addColorStop: vi.fn(),
    };
    const mockCtx = {
      createRadialGradient: vi.fn(() => mockGradient),
    } as unknown as CanvasRenderingContext2D;

    createVignetteGradient(mockCtx, 0, 0, 100, 100, '#808080');

    // Verify color stops are at 0 (center) and 1 (edge)
    expect(mockGradient.addColorStop).toHaveBeenNthCalledWith(
      1,
      0,
      expect.any(String)
    );
    expect(mockGradient.addColorStop).toHaveBeenNthCalledWith(
      1,
      expect.any(Number),
      expect.any(String)
    );
  });
});

describe('drawVignetteTile', () => {
  it('should draw a filled rectangle with vignette gradient', () => {
    const mockGradient = { addColorStop: vi.fn() };
    const mockCtx = {
      createRadialGradient: vi.fn(() => mockGradient),
      fillRect: vi.fn(),
      fillStyle: '',
    } as unknown as CanvasRenderingContext2D;

    drawVignetteTile(mockCtx, 10, 20, 110, 100, '#00ff00');

    expect(mockCtx.fillRect).toHaveBeenCalledWith(10, 20, 100, 80);
  });

  it('should set fillStyle to the gradient', () => {
    const mockGradient = { addColorStop: vi.fn() };
    const mockCtx = {
      createRadialGradient: vi.fn(() => mockGradient),
      fillRect: vi.fn(),
      fillStyle: null as unknown,
    } as unknown as CanvasRenderingContext2D;

    drawVignetteTile(mockCtx, 0, 0, 50, 50, '#0000ff');

    expect(mockCtx.fillStyle).toBe(mockGradient);
  });

  it('should not draw if width is less than 1', () => {
    const mockCtx = {
      createRadialGradient: vi.fn(),
      fillRect: vi.fn(),
      fillStyle: '',
    } as unknown as CanvasRenderingContext2D;

    drawVignetteTile(mockCtx, 10, 20, 10.5, 100, '#ff0000');

    expect(mockCtx.fillRect).not.toHaveBeenCalled();
  });

  it('should not draw if height is less than 1', () => {
    const mockCtx = {
      createRadialGradient: vi.fn(),
      fillRect: vi.fn(),
      fillStyle: '',
    } as unknown as CanvasRenderingContext2D;

    drawVignetteTile(mockCtx, 10, 20, 110, 20.5, '#ff0000');

    expect(mockCtx.fillRect).not.toHaveBeenCalled();
  });
});
