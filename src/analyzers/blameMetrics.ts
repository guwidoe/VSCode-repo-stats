/**
 * Blame Metrics Analyzer - HEAD-only line ownership and line-age analysis.
 * Pure logic, no VSCode dependencies.
 */

import * as os from 'os';
import type {
  BlameFileCacheEntry,
  BlameMetrics,
  BlameOwnershipEntry,
  TreemapNode,
} from '../types/index.js';
import { throwIfCancelled } from './cancellation.js';

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

interface CommitMeta {
  author: string;
  email: string;
  authorTime: number;
}

interface BlameHunkMeta extends CommitMeta {
  commit: string;
  lines: number;
  applied: boolean;
}

export interface BlameFileTarget {
  path: string;
  node: TreemapNode;
}

export interface AnalyzeHeadBlameOptions {
  headSha: string;
  fileTargets: BlameFileTarget[];
  headBlobShas?: Map<string, string>;
  previousFileCache?: Record<string, BlameFileCacheEntry>;
  runGitRaw: (args: string[]) => Promise<string>;
  signal?: AbortSignal;
  onProgress?: (processed: number, total: number) => void;
  onPartial?: (metrics: BlameMetrics) => void;
}

interface AnalyzeHeadBlameResult {
  metrics: BlameMetrics;
  fileCache: Record<string, BlameFileCacheEntry>;
}

function applyOwnerContribution(
  globalOwnership: Map<string, BlameOwnershipEntry>,
  owner: OwnerCounter
): void {
  const ownerKey = `${owner.author}\u0000${owner.email}`;
  const existing = globalOwnership.get(ownerKey) || {
    author: owner.author,
    email: owner.email,
    lines: 0,
  };
  existing.lines += owner.lines;
  globalOwnership.set(ownerKey, existing);
}

function applyStatsToNode(node: TreemapNode, stats: ParsedBlameFileStats): void {
  node.blamedLines = stats.totalLines;
  node.lineAgeAvgDays = Math.round(stats.avgAgeDays);
  node.lineAgeMinDays = stats.minAgeDays;
  node.lineAgeMaxDays = stats.maxAgeDays;
  node.topOwnerAuthor = stats.topOwnerAuthor;
  node.topOwnerEmail = stats.topOwnerEmail;
  node.topOwnerLines = stats.topOwnerLines;
  node.topOwnerShare = stats.topOwnerShare;
}

function applyStatsToGlobal(
  stats: ParsedBlameFileStats,
  globalAgeByDay: number[],
  globalOwnership: Map<string, BlameOwnershipEntry>
): void {
  for (const [ageDays, count] of stats.ageCounts.entries()) {
    globalAgeByDay[ageDays] = (globalAgeByDay[ageDays] ?? 0) + count;
  }

  for (const owner of stats.ownership.values()) {
    applyOwnerContribution(globalOwnership, owner);
  }
}

function cacheEntryToStats(entry: BlameFileCacheEntry): ParsedBlameFileStats {
  const ageCounts = new Map<number, number>(entry.ageCounts);
  const ownership = new Map<string, OwnerCounter>();

  for (const owner of entry.ownership) {
    ownership.set(`${owner.author}\u0000${owner.email}`, {
      author: owner.author,
      email: owner.email,
      lines: owner.lines,
    });
  }

  return {
    totalLines: entry.totalLines,
    ageCounts,
    ownership,
    minAgeDays: entry.minAgeDays,
    maxAgeDays: entry.maxAgeDays,
    avgAgeDays: entry.avgAgeDays,
    topOwnerAuthor: entry.topOwnerAuthor,
    topOwnerEmail: entry.topOwnerEmail,
    topOwnerLines: entry.topOwnerLines,
    topOwnerShare: entry.topOwnerShare,
  };
}

function statsToCacheEntry(blobSha: string, stats: ParsedBlameFileStats): BlameFileCacheEntry {
  return {
    blobSha,
    totalLines: stats.totalLines,
    ageCounts: Array.from(stats.ageCounts.entries()),
    ownership: Array.from(stats.ownership.values()).map((owner) => ({
      author: owner.author,
      email: owner.email,
      lines: owner.lines,
    })),
    minAgeDays: stats.minAgeDays,
    maxAgeDays: stats.maxAgeDays,
    avgAgeDays: stats.avgAgeDays,
    topOwnerAuthor: stats.topOwnerAuthor,
    topOwnerEmail: stats.topOwnerEmail,
    topOwnerLines: stats.topOwnerLines,
    topOwnerShare: stats.topOwnerShare,
  };
}

/**
 * Parses `git blame --incremental` output.
 */
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
  const commitMetadata = new Map<string, CommitMeta>();

  const applyCurrent = () => {
    if (!current || current.applied) {
      return;
    }

    const lines = current.lines;
    const author = current.author || UNKNOWN_AUTHOR;
    const email = current.email || UNKNOWN_EMAIL;
    const authorTime = current.authorTime > 0 ? current.authorTime : nowUnixSeconds;
    const ageDays = Math.max(0, Math.floor((nowUnixSeconds - authorTime) / 86400));

    commitMetadata.set(current.commit, {
      author,
      email,
      authorTime,
    });

    ageCounts.set(ageDays, (ageCounts.get(ageDays) ?? 0) + lines);

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
    const headerMatch = line.match(/^(\^?[0-9a-f]{40})\s+\d+\s+\d+\s+(\d+)$/i);
    if (headerMatch) {
      applyCurrent();
      const commit = headerMatch[1].replace(/^\^/, '').toLowerCase();
      const cachedMeta = commitMetadata.get(commit);
      current = {
        commit,
        lines: parseInt(headerMatch[2], 10),
        author: cachedMeta?.author || UNKNOWN_AUTHOR,
        email: cachedMeta?.email || UNKNOWN_EMAIL,
        authorTime: cachedMeta?.authorTime ?? nowUnixSeconds,
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

    // End-of-hunk marker in --incremental output
    if (line.startsWith('filename ')) {
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
    topOwnerLines: topOwner?.lines ?? 0,
    topOwnerShare: totalLines > 0 ? (topOwner?.lines ?? 0) / totalLines : 0,
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
      cacheHits: 0,
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
): Promise<AnalyzeHeadBlameResult> {
  const {
    headSha,
    fileTargets,
    headBlobShas,
    previousFileCache,
    runGitRaw,
    signal,
    onProgress,
    onPartial,
  } = options;

  throwIfCancelled(signal);

  if (fileTargets.length === 0) {
    return {
      metrics: createEmptyBlameMetrics(),
      fileCache: {},
    };
  }

  const nowUnixSeconds = Math.floor(Date.now() / 1000);
  const globalAgeByDay: number[] = [];
  const globalOwnership = new Map<string, BlameOwnershipEntry>();

  const reusableCache = previousFileCache || {};
  const fileCache: Record<string, BlameFileCacheEntry> = {};

  let filesAnalyzed = 0;
  let filesSkipped = 0;
  let cacheHits = 0;
  let totalBlamedLines = 0;
  let processed = 0;
  let index = 0;
  let lastPartialProcessed = 0;

  const buildMetricsSnapshot = (): BlameMetrics => {
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
        cacheHits,
      },
    };
  };

  const partialStep = Math.max(25, Math.ceil(fileTargets.length / 40));

  const cpuCount = os.cpus().length;
  const concurrency = Math.max(2, Math.min(12, cpuCount, fileTargets.length));

  const workers = Array.from({ length: concurrency }, async () => {
    while (index < fileTargets.length) {
      throwIfCancelled(signal);

      const currentIndex = index;
      index += 1;
      const target = fileTargets[currentIndex];
      const blobSha = headBlobShas?.get(target.path);

      try {
        if (blobSha) {
          const cachedEntry = reusableCache[target.path];
          if (cachedEntry && cachedEntry.blobSha === blobSha) {
            const cachedStats = cacheEntryToStats(cachedEntry);
            applyStatsToGlobal(cachedStats, globalAgeByDay, globalOwnership);
            applyStatsToNode(target.node, cachedStats);
            fileCache[target.path] = cachedEntry;
            totalBlamedLines += cachedStats.totalLines;
            filesAnalyzed += 1;
            cacheHits += 1;
            continue;
          }
        }

        const incremental = await runGitRaw([
          'blame',
          '--incremental',
          headSha,
          '--',
          target.path,
        ]);

        throwIfCancelled(signal);

        const stats = parseBlamePorcelain(incremental, nowUnixSeconds);

        if (stats.totalLines > 0) {
          applyStatsToGlobal(stats, globalAgeByDay, globalOwnership);
          applyStatsToNode(target.node, stats);

          if (blobSha) {
            fileCache[target.path] = statsToCacheEntry(blobSha, stats);
          }

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

        if (
          onPartial &&
          (processed === fileTargets.length || processed - lastPartialProcessed >= partialStep)
        ) {
          lastPartialProcessed = processed;
          onPartial(buildMetricsSnapshot());
        }
      }
    }
  });

  await Promise.all(workers);

  return {
    metrics: buildMetricsSnapshot(),
    fileCache,
  };
}
