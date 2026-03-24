import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildDisplayIndexMapping,
  findNearestSparseIndex,
  useTimeRangeSliderModel,
} from './useTimeRangeSliderModel';

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

describe('useTimeRangeSliderModel', () => {
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

  it('builds gap-aware sparse and filled mappings', () => {
    const mapping = buildDisplayIndexMapping(
      [
        { week: '2024-W01', commits: 3 },
        { week: '2024-W03', commits: 5 },
        { week: '2024-W05', commits: 7 },
      ],
      [
        { week: '2024-W01', commits: 3 },
        { week: '2024-W02', commits: 0 },
        { week: '2024-W03', commits: 5 },
        { week: '2024-W04', commits: 0 },
        { week: '2024-W05', commits: 7 },
      ],
      true
    );

    expect(mapping.sparseToFilled).toEqual([0, 2, 4]);
    expect(mapping.filledToSparse).toEqual([0, -1, 1, -1, 2]);
    expect(findNearestSparseIndex(3, mapping.filledToSparse)).toBe(1);
  });

  it('moves the end handle using filled-space positions and schedules store updates', () => {
    const setTimeRange = vi.fn();
    const { result } = renderHook(() =>
      useTimeRangeSliderModel({
        allWeeks: ['2024-W01', '2024-W03', '2024-W05'],
        weeklyTotals: [
          { week: '2024-W01', commits: 3 },
          { week: '2024-W03', commits: 5 },
          { week: '2024-W05', commits: 7 },
        ],
        showEmptyTimePeriods: true,
        setTimeRange,
      })
    );

    act(() => {
      result.current.trackRef.current = createTrackElement(100);
      result.current.beginDrag('end');
    });

    act(() => {
      window.dispatchEvent(new MouseEvent('mousemove', { clientX: 75 }));
      flushAnimationFrames();
    });

    expect(setTimeRange).toHaveBeenCalledWith(0, 1);
    expect(result.current.endPercent).toBe(50);

    act(() => {
      window.dispatchEvent(new MouseEvent('mouseup'));
    });

    expect(result.current.isDragging).toBeNull();
  });
});
