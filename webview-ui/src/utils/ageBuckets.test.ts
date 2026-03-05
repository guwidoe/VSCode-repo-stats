import { describe, expect, it } from 'vitest';
import { buildAgePrefixSums, bucketizeAgeByDay, sumAgeRange } from './ageBuckets';

describe('ageBuckets', () => {
  it('builds prefix sums and sums ranges', () => {
    const ageByDay = [3, 2, 5, 0, 1];
    const prefix = buildAgePrefixSums(ageByDay);

    expect(prefix).toEqual([3, 5, 10, 10, 11]);
    expect(sumAgeRange(prefix, 0, 2)).toBe(10);
    expect(sumAgeRange(prefix, 2, 4)).toBe(6);
  });

  it('bucketizes age array with arbitrary ranges', () => {
    const ageByDay = [3, 2, 5, 0, 1];

    const segments = bucketizeAgeByDay(ageByDay, [
      { label: 'fresh', min: 0, max: 1, color: '#0f0' },
      { label: 'older', min: 2, max: 10, color: '#f00' },
    ]);

    expect(segments).toEqual([
      { label: 'fresh', value: 5, color: '#0f0' },
      { label: 'older', value: 6, color: '#f00' },
    ]);
  });
});
