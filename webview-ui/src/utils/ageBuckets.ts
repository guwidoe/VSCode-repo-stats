export interface AgeBucketDefinition {
  label: string;
  min: number;
  max: number;
  color: string;
}

export function buildAgePrefixSums(ageByDay: number[]): number[] {
  const prefix = new Array<number>(ageByDay.length);
  let running = 0;

  for (let i = 0; i < ageByDay.length; i++) {
    running += ageByDay[i] || 0;
    prefix[i] = running;
  }

  return prefix;
}

export function sumAgeRange(prefix: number[], minDay: number, maxDay: number): number {
  if (prefix.length === 0) {
    return 0;
  }

  const start = Math.max(0, minDay);
  const end = Math.max(start, Math.min(maxDay, prefix.length - 1));

  const endValue = prefix[end] || 0;
  const beforeStart = start > 0 ? (prefix[start - 1] || 0) : 0;

  return endValue - beforeStart;
}

export function bucketizeAgeByDay(
  ageByDay: number[],
  buckets: AgeBucketDefinition[]
): Array<{ label: string; value: number; color: string }> {
  if (ageByDay.length === 0) {
    return [];
  }

  const prefix = buildAgePrefixSums(ageByDay);

  return buckets
    .map((bucket) => ({
      label: bucket.label,
      color: bucket.color,
      value: sumAgeRange(prefix, bucket.min, bucket.max),
    }))
    .filter((segment) => segment.value > 0);
}
