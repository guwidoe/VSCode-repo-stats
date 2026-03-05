/**
 * Blame Metrics Analyzer - HEAD-only line ownership and line-age analysis.
 * Pure logic, no VSCode dependencies.
 */

import * as os from 'os';
import type { BlameMetrics, BlameOwnershipEntry, TreemapNode } from '../types/index.js';

const UNKNOWN_AUTHOR = 'Unknown';
const UNKNOWN_EMAIL = 'unknown@unknown.local';

export interface OwnerCounter {
  author: string;
  email: string;
  lines: number;
}

export interface ParsedBlameFileStats {
  totalLines: number;
  ageCounts: Map<number, number>;
  ownership: Map<string, OwnerCounter>;
  minAgeDays: number;
  maxAgeDays: number;
  avgAgeDays: number;
  topOwnerAuthor: string;
  topOwnerEmail: string;
  topOwnerLines: number;
  topOwnerShare: number;
}

interface BlameHunkMeta {
  lines: number;
  author: string;
  email: string;
  authorTime: number;
  applied: boolean;
}

export interface BlameFileTarget {
  path: string;
  node: TreemapNode;
}

export interface AnalyzeHeadBlameOptions {
  headSha: string;
  fileTargets: BlameFileTarget[];
  runGitRaw: (args: string[]) => Promise<string>;
  onProgress?: (processed: number, total: number) => void;
}

export function parseBlamePorcelain(
  porcelainOutput: string,
  nowUnixSeconds: number
): ParsedBlameFileStats {
  const ageCounts = new Map<number, number>();
  const ownership = new Map<string, OwnerCounter>();

  let totalLines = 0;
  let weightedAge = 0;
  let minAgeDays = Number.POSITIVE_INFINITY;
  let maxAgeDays = 0;
  let current: BlameHunkMeta | null = null;

  const applyCurrent = () => {
    if (!current || current.applied) {
      return;
    }

    const lines = current.lines;
    const author = current.author || UNKNOWN_AUTHOR;
    const email = current.email || UNKNOWN_EMAIL;
    const authorTime = current.authorTime > 0 ? current.authorTime : nowUnixSeconds;
    const ageDays = Math.max(0, Math.floor((nowUnixSeconds - authorTime) / 86400));

    ageCounts.set(ageDays, (ageCounts.get(ageDays) || 0) + lines);

    const ownerKey = `${author}\u0000${email}`;
    const existingOwner = ownership.get(ownerKey) || { author, email, lines: 0 };
    existingOwner.lines += lines;
    ownership.set(ownerKey, existingOwner);

    totalLines += lines;
    weightedAge += ageDays * lines;
    minAgeDays = Math.min(minAgeDays, ageDays);
    maxAgeDays = Math.max(maxAgeDays, ageDays);
    current.applied = true;
  };

  for (const line of porcelainOutput.split('\n')) {
    const headerMatch = line.match(/^([0-9a-f]{40})\s+\d+\s+\d+\s+(\d+)$/i);
    if (headerMatch) {
      applyCurrent();
      current = {
        lines: parseInt(headerMatch[2], 10),
        author: UNKNOWN_AUTHOR,
        email: UNKNOWN_EMAIL,
        authorTime: nowUnixSeconds,
        applied: false,
      };
      continue;
    }

    if (!current) {
      continue;
    }

    if (line.startsWith('author ')) {
      current.author = line.slice(7).trim() || UNKNOWN_AUTHOR;
      continue;
    }

    if (line.startsWith('author-mail ')) {
      const rawEmail = line.slice(12).trim();
      current.email = rawEmail.replace(/^</, '').replace(/>$/, '') || UNKNOWN_EMAIL;
      continue;
    }

    if (line.startsWith('author-time ')) {
      const timestamp = parseInt(line.slice(12).trim(), 10);
      if (Number.isFinite(timestamp)) {
        current.authorTime = timestamp;
      }
      continue;
    }

    if (line.startsWith('\t')) {
      applyCurrent();
    }
  }

  applyCurrent();

  let topOwner: OwnerCounter | null = null;
  for (const owner of ownership.values()) {
    if (!topOwner || owner.lines > topOwner.lines) {
      topOwner = owner;
    }
  }

  return {
    totalLines,
    ageCounts,
    ownership,
    minAgeDays: Number.isFinite(minAgeDays) ? minAgeDays : 0,
    maxAgeDays,
    avgAgeDays: totalLines > 0 ? weightedAge / totalLines : 0,
    topOwnerAuthor: topOwner?.author || UNKNOWN_AUTHOR,
    topOwnerEmail: topOwner?.email || UNKNOWN_EMAIL,
    topOwnerLines: topOwner?.lines || 0,
    topOwnerShare: totalLines > 0 ? (topOwner?.lines || 0) / totalLines : 0,
  };
}

export function createEmptyBlameMetrics(): BlameMetrics {
  return {
    analyzedAt: new Date().toISOString(),
    maxAgeDays: 0,
    ageByDay: [],
    ownershipByAuthor: [],
    totals: {
      totalBlamedLines: 0,
      filesAnalyzed: 0,
      filesSkipped: 0,
    },
  };
}

function trimTrailingZeroes(values: number[]): number[] {
  let lastNonZero = values.length - 1;
  while (lastNonZero >= 0 && values[lastNonZero] === 0) {
    lastNonZero--;
  }

  if (lastNonZero < 0) {
    return [];
  }

  return values.slice(0, lastNonZero + 1);
}

export async function analyzeHeadBlameMetrics(
  options: AnalyzeHeadBlameOptions
): Promise<BlameMetrics> {
  const { headSha, fileTargets, runGitRaw, onProgress } = options;

  if (fileTargets.length === 0) {
    return createEmptyBlameMetrics();
  }

  const nowUnixSeconds = Math.floor(Date.now() / 1000);
  const globalAgeByDay: number[] = [];
  const globalOwnership = new Map<string, BlameOwnershipEntry>();

  let filesAnalyzed = 0;
  let filesSkipped = 0;
  let totalBlamedLines = 0;
  let processed = 0;
  let index = 0;

  const cpuCount = os.cpus().length;
  const concurrency = Math.max(2, Math.min(8, cpuCount, fileTargets.length));

  const workers = Array.from({ length: concurrency }, async () => {
    while (index < fileTargets.length) {
      const currentIndex = index;
      index += 1;

      const target = fileTargets[currentIndex];

      try {
        const porcelain = await runGitRaw([
          'blame',
          '--line-porcelain',
          headSha,
          '--',
          target.path,
        ]);

        const stats = parseBlamePorcelain(porcelain, nowUnixSeconds);

        if (stats.totalLines > 0) {
          for (const [ageDays, count] of stats.ageCounts.entries()) {
            globalAgeByDay[ageDays] = (globalAgeByDay[ageDays] || 0) + count;
          }

          for (const owner of stats.ownership.values()) {
            const ownerKey = `${owner.author}\u0000${owner.email}`;
            const existing = globalOwnership.get(ownerKey) || {
              author: owner.author,
              email: owner.email,
              lines: 0,
            };
            existing.lines += owner.lines;
            globalOwnership.set(ownerKey, existing);
          }

          target.node.blamedLines = stats.totalLines;
          target.node.lineAgeAvgDays = Math.round(stats.avgAgeDays);
          target.node.lineAgeMinDays = stats.minAgeDays;
          target.node.lineAgeMaxDays = stats.maxAgeDays;
          target.node.topOwnerAuthor = stats.topOwnerAuthor;
          target.node.topOwnerEmail = stats.topOwnerEmail;
          target.node.topOwnerLines = stats.topOwnerLines;
          target.node.topOwnerShare = stats.topOwnerShare;

          totalBlamedLines += stats.totalLines;
          filesAnalyzed += 1;
        } else {
          filesSkipped += 1;
        }
      } catch {
        filesSkipped += 1;
      } finally {
        processed += 1;
        onProgress?.(processed, fileTargets.length);
      }
    }
  });

  await Promise.all(workers);

  const ageByDay = trimTrailingZeroes(globalAgeByDay);
  const ownershipByAuthor = Array.from(globalOwnership.values())
    .sort((a, b) => b.lines - a.lines);

  return {
    analyzedAt: new Date().toISOString(),
    maxAgeDays: Math.max(0, ageByDay.length - 1),
    ageByDay,
    ownershipByAuthor,
    totals: {
      totalBlamedLines,
      filesAnalyzed,
      filesSkipped,
    },
  };
}
