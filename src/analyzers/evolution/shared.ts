import { normalizeEvolutionTimeSeriesData } from '../../types/index.js';
import type {
  EvolutionSamplingMode,
  EvolutionSnapshotPoint,
  EvolutionTimeSeriesData,
} from '../../types/index.js';

const ROOT_DIR = '[root]';

export type DimensionCounts = Record<string, number>;

export interface EvolutionFileHistogram {
  cohort: DimensionCounts;
  author: DimensionCounts;
  ext: DimensionCounts;
  dir: DimensionCounts;
  domain: DimensionCounts;
}

interface TimestampedHistoryEntry {
  sha: string;
  timestamp: number;
}

interface SampleHistoryOptions<TIn extends TimestampedHistoryEntry, TOut extends TimestampedHistoryEntry> {
  samplingMode: EvolutionSamplingMode;
  maxSnapshots: number;
  commitInterval: number;
  intervalDays: number;
  mark: (entry: TIn, samplingMode: EvolutionSamplingMode) => TOut;
  getEntryKey?: (entry: TOut) => string;
  onAutoDistribute?: () => void;
  onDownsample?: (selectedCount: number) => void;
}

export function parseHistoryLog(rawLog: string): Array<{ sha: string; timestamp: number }> {
  return rawLog
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => {
      const [sha, tsRaw] = line.split('|');
      return { sha, timestamp: parseInt(tsRaw, 10) };
    })
    .filter((entry) => Boolean(entry.sha) && Number.isFinite(entry.timestamp));
}

export function sampleHistoryEntries<
  TIn extends TimestampedHistoryEntry,
  TOut extends TimestampedHistoryEntry,
>(entries: TIn[], options: SampleHistoryOptions<TIn, TOut>): TOut[] {
  if (entries.length === 0) {
    return [];
  }

  const maxSnapshots = Math.max(2, options.maxSnapshots);
  const getEntryKey = options.getEntryKey ?? ((entry: TOut) => entry.sha);

  if (options.samplingMode === 'auto') {
    options.onAutoDistribute?.();
    return downsampleHistoryEntries(
      entries.map((entry) => options.mark(entry, 'auto')),
      maxSnapshots,
      getEntryKey
    );
  }

  if (options.samplingMode === 'commit') {
    const commitInterval = Math.max(1, options.commitInterval);
    const sampled: TOut[] = [];

    for (let index = 0; index < entries.length; index += commitInterval) {
      sampled.push(options.mark(entries[index], 'commit'));
    }

    const lastEntry = options.mark(entries[entries.length - 1], 'commit');
    if (getEntryKey(sampled[sampled.length - 1]) !== getEntryKey(lastEntry)) {
      sampled.push(lastEntry);
    }

    return sampled.length <= maxSnapshots
      ? sampled
      : downsampleHistoryEntries(sampled, maxSnapshots, getEntryKey);
  }

  const intervalSeconds = Math.max(1, options.intervalDays) * 24 * 60 * 60;
  const sampled: TOut[] = [options.mark(entries[0], 'time')];
  let lastTimestamp = entries[0].timestamp;

  for (let index = 1; index < entries.length; index += 1) {
    const entry = entries[index];
    if (entry.timestamp >= lastTimestamp + intervalSeconds) {
      sampled.push(options.mark(entry, 'time'));
      lastTimestamp = entry.timestamp;
    }
  }

  const lastEntry = options.mark(entries[entries.length - 1], 'time');
  if (getEntryKey(sampled[sampled.length - 1]) !== getEntryKey(lastEntry)) {
    sampled.push(lastEntry);
  }

  if (sampled.length <= maxSnapshots) {
    return sampled;
  }

  options.onDownsample?.(sampled.length);
  return downsampleHistoryEntries(sampled, maxSnapshots, getEntryKey);
}

export function downsampleHistoryEntries<T>(
  entries: T[],
  maxSnapshots: number,
  getEntryKey: (entry: T) => string
): T[] {
  if (entries.length <= maxSnapshots) {
    return entries;
  }

  const downsampled: T[] = [];
  const maxIndex = entries.length - 1;
  const step = maxIndex / (maxSnapshots - 1);
  let lastAddedKey = '';

  for (let index = 0; index < maxSnapshots; index += 1) {
    const sourceIndex = Math.round(index * step);
    const entry = entries[sourceIndex];
    const entryKey = entry ? getEntryKey(entry) : '';
    if (entry && entryKey !== lastAddedKey) {
      downsampled.push(entry);
      lastAddedKey = entryKey;
    }
  }

  const lastEntry = entries[entries.length - 1];
  if (getEntryKey(downsampled[downsampled.length - 1]) !== getEntryKey(lastEntry)) {
    downsampled.push(lastEntry);
  }

  return downsampled;
}

export function createEmptyHistogram(): EvolutionFileHistogram {
  return {
    cohort: {},
    author: {},
    ext: {},
    dir: {},
    domain: {},
  };
}

export function cloneHistogram(histogram: EvolutionFileHistogram): EvolutionFileHistogram {
  return {
    cohort: { ...histogram.cohort },
    author: { ...histogram.author },
    ext: { ...histogram.ext },
    dir: { ...histogram.dir },
    domain: { ...histogram.domain },
  };
}

export function mergeHistogram(
  target: EvolutionFileHistogram,
  source: EvolutionFileHistogram,
  sign: 1 | -1
): void {
  mergeCounts(target.cohort, source.cohort, sign);
  mergeCounts(target.author, source.author, sign);
  mergeCounts(target.ext, source.ext, sign);
  mergeCounts(target.dir, source.dir, sign);
  mergeCounts(target.domain, source.domain, sign);
}

export function incrementCount(target: DimensionCounts, label: string, value: number): void {
  if (!label) {
    return;
  }
  target[label] = (target[label] ?? 0) + value;
}

export function mergeCounts(target: DimensionCounts, source: DimensionCounts, sign: 1 | -1): void {
  for (const [label, value] of Object.entries(source)) {
    const next = (target[label] ?? 0) + value * sign;
    if (next <= 0) {
      delete target[label];
    } else {
      target[label] = next;
    }
  }
}

export function getTopDirectory(filePath: string): string {
  const normalized = filePath.replace(/\\/g, '/');
  const slashIndex = normalized.indexOf('/');
  if (slashIndex === -1) {
    return ROOT_DIR;
  }
  return normalized.slice(0, slashIndex + 1);
}

export function formatCohort(unixSeconds: number, format: string): string {
  const date = new Date(unixSeconds * 1000);
  const year = date.getUTCFullYear();
  const month = `${date.getUTCMonth() + 1}`.padStart(2, '0');
  const day = `${date.getUTCDate()}`.padStart(2, '0');
  const week = `${getUtcWeekNumber(date)}`.padStart(2, '0');

  return format
    .replace(/%Y/g, `${year}`)
    .replace(/%m/g, month)
    .replace(/%d/g, day)
    .replace(/%W/g, week);
}

export function toEvolutionSeries(
  snapshots: EvolutionSnapshotPoint[],
  countsBySnapshot: DimensionCounts[]
): EvolutionTimeSeriesData {
  const labelSet = new Set<string>();
  for (const snapshot of countsBySnapshot) {
    for (const label of Object.keys(snapshot)) {
      labelSet.add(label);
    }
  }

  const labels = Array.from(labelSet).sort((a, b) => a.localeCompare(b));
  const seriesValues = labels.map((label) => countsBySnapshot.map((snapshot) => snapshot[label] ?? 0));

  return normalizeEvolutionTimeSeriesData({
    snapshots,
    timestamps: snapshots.map((snapshot) => snapshot.committedAt),
    labels,
    seriesValues,
  });
}

export function isExpectedBlameMiss(error: unknown): boolean {
  const message = (error instanceof Error ? error.message : String(error)).toLowerCase();

  return (
    message.includes('no such path') ||
    message.includes('no such file') ||
    message.includes('file not found') ||
    message.includes('no such ref')
  );
}

function getUtcWeekNumber(date: Date): number {
  const working = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNum = working.getUTCDay() || 7;
  working.setUTCDate(working.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(working.getUTCFullYear(), 0, 1));
  return Math.ceil((((working.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}
