import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useCodeFrequencyRangeSliderModel } from './useCodeFrequencyRangeSliderModel';

function createTrackElement(width: number): HTMLDivElement {
  const element = document.createElement('div');
  Object.defineProperty(element, 'getBoundingClientRect', {
    value: () => ({
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      bottom: 20,
      right: width,
      width,
      height: 20,
      toJSON: () => ({}),
    }),
  });
  return element;
}

describe('useCodeFrequencyRangeSliderModel', () => {
  const animationFrames = new Map<number, FrameRequestCallback>();
  let nextFrameId = 1;

  beforeEach(() => {
    animationFrames.clear();
    nextFrameId = 1;
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      const id = nextFrameId;
      nextFrameId += 1;
      animationFrames.set(id, callback);
      return id;
    });
    vi.stubGlobal('cancelAnimationFrame', (id: number) => {
      animationFrames.delete(id);
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function flushAnimationFrames() {
    const callbacks = Array.from(animationFrames.values());
    animationFrames.clear();
    callbacks.forEach((callback) => callback(0));
  }

  it('moves the end handle and schedules range updates', () => {
    const onRangeChange = vi.fn();
    const { result } = renderHook(() =>
      useCodeFrequencyRangeSliderModel({
        points: [
          { period: '2024-W01', label: 'W01', additions: 4, deletions: 1, netChange: 3 },
          { period: '2024-W02', label: 'W02', additions: 10, deletions: 5, netChange: 5 },
          { period: '2024-W03', label: 'W03', additions: 8, deletions: 2, netChange: 6 },
        ],
        onRangeChange,
      })
    );

    act(() => {
      result.current.trackRef.current = createTrackElement(100);
      result.current.beginDrag('end');
    });

    act(() => {
      window.dispatchEvent(new MouseEvent('mousemove', { clientX: 50 }));
      flushAnimationFrames();
    });

    expect(onRangeChange).toHaveBeenCalledWith(0, 1);
    expect(result.current.endPercent).toBe(50);

    act(() => {
      window.dispatchEvent(new MouseEvent('mouseup'));
    });

    expect(result.current.isDragging).toBeNull();
  });
});
