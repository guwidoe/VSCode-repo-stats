import type { BlameMetrics, BlameOwnershipEntry } from '../../types/index.js';
import { createEmptyBlameMetrics } from '../blameMetrics.js';

export function mergeBlameMetrics(metricsList: BlameMetrics[]): BlameMetrics {
  if (metricsList.length === 0) {
    return createEmptyBlameMetrics();
  }

  const ageByDay: number[] = [];
  const ownershipByAuthor = new Map<string, BlameOwnershipEntry>();
  let filesAnalyzed = 0;
  let filesSkipped = 0;
  let cacheHits = 0;
  let totalBlamedLines = 0;

  for (const metrics of metricsList) {
    for (let index = 0; index < metrics.ageByDay.length; index += 1) {
      ageByDay[index] = (ageByDay[index] ?? 0) + (metrics.ageByDay[index] ?? 0);
    }

    for (const owner of metrics.ownershipByAuthor) {
      const key = `${owner.author}\u0000${owner.email}`;
      const existing = ownershipByAuthor.get(key) ?? { ...owner, lines: 0 };
      existing.lines += owner.lines;
      ownershipByAuthor.set(key, existing);
    }

    filesAnalyzed += metrics.totals.filesAnalyzed;
    filesSkipped += metrics.totals.filesSkipped;
    cacheHits += metrics.totals.cacheHits;
    totalBlamedLines += metrics.totals.totalBlamedLines;
  }

  return {
    analyzedAt: new Date().toISOString(),
    maxAgeDays: ageByDay.length > 0 ? ageByDay.length - 1 : 0,
    ageByDay,
    ownershipByAuthor: Array.from(ownershipByAuthor.values()).sort((a, b) => b.lines - a.lines || a.email.localeCompare(b.email)),
    totals: {
      totalBlamedLines,
      filesAnalyzed,
      filesSkipped,
      cacheHits,
    },
  };
}
