import type {
  CommitAnalytics,
  CommitMetadataBucket,
  CommitMetadataBucketMode,
  CommitMetadataCalendarGranularity,
  CommitMetadataCommitBucketStrategy,
  CommitMetadataDiagnostics,
  CommitMetadataExtractorConfig,
  CommitMetadataFact,
  CommitMetadataMetric,
  CommitMetadataMultiValueMode,
  CommitMetadataSeriesPoint,
  CommitMetadataSettings,
  CommitMetadataTrendResult,
  CommitRecord,
} from '../types/index.js';

export interface CommitMetadataTrendQuery {
  extractorId?: string;
  bucketMode?: CommitMetadataBucketMode;
  calendarGranularity?: CommitMetadataCalendarGranularity;
  commitBucketStrategy?: CommitMetadataCommitBucketStrategy;
  commitBucketSize?: number;
  commitBucketCount?: number;
  metric?: CommitMetadataMetric;
  multiValueMode?: CommitMetadataMultiValueMode;
  includeUncategorized?: boolean;
  maxSeries?: number;
  includeOtherSeries?: boolean;
}

interface ExtractionContext {
  analytics: CommitAnalytics;
  invalidExtractorIds: Set<string>;
  unavailableDimensions: Set<string>;
  notes: string[];
}

interface BucketedCommit {
  record: CommitRecord;
  sortedIndex: number;
  bucket: CommitMetadataBucket;
}

const OTHER_SERIES_VALUE = 'Other';
const DEFAULT_UNMATCHED_VALUE = 'Uncategorized';
const GLOBAL_REGEX_FLAGS = 'g';

export function analyzeCommitMetadataTrends(
  analytics: CommitAnalytics,
  settings: CommitMetadataSettings,
  query: CommitMetadataTrendQuery = {}
): CommitMetadataTrendResult {
  const extractor = resolveExtractor(settings, query.extractorId);
  const bucketMode = query.bucketMode ?? settings.defaultBucketMode;
  const metric = query.metric ?? settings.defaultMetric;
  const sortedRecords = getRecordsSortedByTime(analytics.records);
  const buckets = createBuckets(sortedRecords, {
    bucketMode,
    calendarGranularity: query.calendarGranularity ?? settings.defaultCalendarGranularity,
    commitBucketStrategy: query.commitBucketStrategy ?? settings.defaultCommitBucketStrategy,
    commitBucketSize: query.commitBucketSize ?? settings.defaultCommitBucketSize,
    commitBucketCount: query.commitBucketCount ?? settings.defaultCommitBucketCount,
  });
  const bucketedCommits = assignCommitsToBuckets(sortedRecords, buckets);
  const context: ExtractionContext = {
    analytics,
    invalidExtractorIds: new Set(),
    unavailableDimensions: new Set(),
    notes: [],
  };

  const factsByCommit = new Map<string, CommitMetadataFact[]>();
  for (const { record } of bucketedCommits) {
    const facts = extractMetadataFacts(record, extractor, {
      analytics,
      extractor,
      multiValueMode: query.multiValueMode ?? settings.multiValueMode,
      includeUncategorized: query.includeUncategorized ?? settings.includeUncategorized,
      context,
    });
    factsByCommit.set(record.sha, facts);
  }

  const fullSeries = aggregateSeries(bucketedCommits, factsByCommit, extractor.dimension);
  const series = limitSeries(fullSeries, {
    maxSeries: query.maxSeries ?? settings.maxSeries,
    includeOtherSeries: query.includeOtherSeries ?? settings.includeOtherSeries,
  });
  const diagnostics = createDiagnostics({
    analyzedCommitCount: sortedRecords.length,
    factsByCommit,
    context,
  });

  return {
    extractorId: extractor.id,
    dimension: extractor.dimension,
    bucketMode,
    metric,
    buckets,
    series,
    diagnostics,
  };
}

export function extractMetadataFacts(
  record: CommitRecord,
  extractor: CommitMetadataExtractorConfig,
  options: {
    analytics: CommitAnalytics;
    extractor: CommitMetadataExtractorConfig;
    multiValueMode: CommitMetadataMultiValueMode;
    includeUncategorized: boolean;
    context?: ExtractionContext;
  }
): CommitMetadataFact[] {
  if (!extractor.enabled) {
    return [];
  }

  const rawValues = extractor.kind === 'builtIn'
    ? extractBuiltInValues(record, extractor, options.analytics, options.context)
    : extractRegexValues(record, extractor, options.context);
  const normalizedValues = dedupeValues(rawValues.map((value) => applyAliases(normalizeValue(value, extractor), extractor)));
  const values = normalizedValues.length > 0
    ? normalizedValues
    : getUnmatchedValues(extractor, options.includeUncategorized);

  if (values.length === 0) {
    return [];
  }

  const selectedValues = options.multiValueMode === 'first' ? values.slice(0, 1) : values;
  const weight = options.multiValueMode === 'split' ? 1 / selectedValues.length : 1;

  return selectedValues.map((value) => ({
    commitSha: record.sha,
    extractorId: extractor.id,
    dimension: extractor.dimension,
    value,
    weight,
  }));
}

function resolveExtractor(settings: CommitMetadataSettings, extractorId?: string): CommitMetadataExtractorConfig {
  const requestedId = extractorId ?? settings.defaultExtractorId;
  const extractor = settings.extractors.find((candidate) => candidate.id === requestedId && candidate.enabled)
    ?? settings.extractors.find((candidate) => candidate.enabled)
    ?? settings.extractors[0];

  if (!extractor) {
    throw new Error('Commit metadata settings must define at least one extractor.');
  }

  return extractor;
}

function extractBuiltInValues(
  record: CommitRecord,
  extractor: Extract<CommitMetadataExtractorConfig, { kind: 'builtIn' }>,
  analytics: CommitAnalytics,
  context?: ExtractionContext
): string[] {
  switch (extractor.builtInId) {
    case 'conventionalType':
      return matchFirst(record.summary, /^([a-zA-Z][\w-]*)(?:\([^)]*\))?!?:/);
    case 'conventionalScope':
      return matchFirst(record.summary, /^[a-zA-Z][\w-]*\(([^)]*)\)!?:/);
    case 'bracketTag':
      return matchAll(record.summary, /\[([^\]]+)\]/g);
    case 'hashTag':
      return matchAll(record.summary, /(?:^|\s)#([a-zA-Z][\w-]*)\b/g);
    case 'issueKey':
      return matchAll(record.summary, /\b([A-Z][A-Z0-9]+-\d+)\b/g);
    case 'author':
      return [analytics.authorDirectory.namesById[record.authorId] ?? analytics.authorDirectory.emailsById[record.authorId] ?? 'Unknown'];
    case 'repository':
      return [record.repositoryId];
    case 'commitSize':
      return [bucketCommitSize(record.changedLines)];
    case 'fileCount':
      return [bucketFileCount(record.filesChanged)];
    case 'directory':
      return extractPathMetadata(record, extractor.builtInId, context, extractor.name, getTopLevelDirectory);
    case 'fileExtension':
      return extractPathMetadata(record, extractor.builtInId, context, extractor.name, getFileExtension);
  }
}

function extractRegexValues(
  record: CommitRecord,
  extractor: Extract<CommitMetadataExtractorConfig, { kind: 'regex' }>,
  context?: ExtractionContext
): string[] {
  let regex: RegExp | undefined;
  try {
    regex = new RegExp(extractor.regex, ensureGlobalFlags(extractor.flags));
  } catch {
    context?.invalidExtractorIds.add(extractor.id);
    context?.notes.push(`Custom extractor “${extractor.name}” has an invalid regular expression.`);
  }

  if (!regex) {
    return [];
  }

  const values: string[] = [];
  for (const match of record.summary.matchAll(regex)) {
    const captured = readCapture(match, extractor.captureGroup);
    if (captured) {
      values.push(captured);
    }
  }

  return values;
}

function normalizeValue(value: string, extractor: CommitMetadataExtractorConfig): string {
  const trimmed = value.trim();
  if (extractor.kind !== 'regex') {
    return trimmed;
  }

  if (extractor.normalization === 'lowercase') {
    return trimmed.toLowerCase();
  }
  if (extractor.normalization === 'uppercase') {
    return trimmed.toUpperCase();
  }
  return trimmed;
}

function applyAliases(value: string, extractor: CommitMetadataExtractorConfig): string {
  return extractor.aliases[value] ?? value;
}

function getUnmatchedValues(extractor: CommitMetadataExtractorConfig, includeUncategorized: boolean): string[] {
  if (!extractor.includeUnmatched && !includeUncategorized) {
    return [];
  }

  return [extractor.unmatchedValue || DEFAULT_UNMATCHED_VALUE];
}

function aggregateSeries(
  bucketedCommits: BucketedCommit[],
  factsByCommit: Map<string, CommitMetadataFact[]>,
  dimension: string
): CommitMetadataSeriesPoint[] {
  const points = new Map<string, CommitMetadataSeriesPoint>();

  for (const { record, bucket } of bucketedCommits) {
    const facts = factsByCommit.get(record.sha) ?? [];
    for (const fact of facts) {
      const key = `${bucket.id}\u0000${fact.value}`;
      let point = points.get(key);
      if (!point) {
        point = {
          bucketId: bucket.id,
          dimension,
          value: fact.value,
          commits: 0,
          additions: 0,
          deletions: 0,
          changedLines: 0,
          filesChanged: 0,
          weightedCommits: 0,
          commitShas: [],
        };
        points.set(key, point);
      }

      point.commits += fact.weight;
      point.additions += record.additions * fact.weight;
      point.deletions += record.deletions * fact.weight;
      point.changedLines += record.changedLines * fact.weight;
      point.filesChanged += record.filesChanged * fact.weight;
      point.weightedCommits += fact.weight;
      point.commitShas.push(record.sha);
    }
  }

  return Array.from(points.values()).sort((a, b) => a.bucketId.localeCompare(b.bucketId) || a.value.localeCompare(b.value));
}

function limitSeries(
  series: CommitMetadataSeriesPoint[],
  options: { maxSeries: number; includeOtherSeries: boolean }
): CommitMetadataSeriesPoint[] {
  if (options.maxSeries <= 0) {
    return series;
  }

  const totalsByValue = new Map<string, number>();
  for (const point of series) {
    totalsByValue.set(point.value, (totalsByValue.get(point.value) ?? 0) + point.weightedCommits);
  }

  const allowedValues = new Set(
    Array.from(totalsByValue.entries())
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, options.maxSeries)
      .map(([value]) => value)
  );

  if (allowedValues.size >= totalsByValue.size) {
    return series;
  }

  const visible = series.filter((point) => allowedValues.has(point.value));
  if (!options.includeOtherSeries) {
    return visible;
  }

  const otherByBucket = new Map<string, CommitMetadataSeriesPoint>();
  for (const point of series) {
    if (allowedValues.has(point.value)) {
      continue;
    }

    let other = otherByBucket.get(point.bucketId);
    if (!other) {
      other = {
        ...point,
        value: OTHER_SERIES_VALUE,
        commits: 0,
        additions: 0,
        deletions: 0,
        changedLines: 0,
        filesChanged: 0,
        weightedCommits: 0,
        commitShas: [],
      };
      otherByBucket.set(point.bucketId, other);
    }

    other.commits += point.commits;
    other.additions += point.additions;
    other.deletions += point.deletions;
    other.changedLines += point.changedLines;
    other.filesChanged += point.filesChanged;
    other.weightedCommits += point.weightedCommits;
    other.commitShas.push(...point.commitShas);
  }

  return [...visible, ...otherByBucket.values()]
    .sort((a, b) => a.bucketId.localeCompare(b.bucketId) || a.value.localeCompare(b.value));
}

function createBuckets(
  records: CommitRecord[],
  options: {
    bucketMode: CommitMetadataBucketMode;
    calendarGranularity: CommitMetadataCalendarGranularity;
    commitBucketStrategy: CommitMetadataCommitBucketStrategy;
    commitBucketSize: number;
    commitBucketCount: number;
  }
): CommitMetadataBucket[] {
  if (records.length === 0) {
    return [];
  }

  if (options.bucketMode === 'calendar') {
    return createCalendarBuckets(records, options.calendarGranularity);
  }

  return createCommitCountBuckets(records, options.commitBucketStrategy, options.commitBucketSize, options.commitBucketCount);
}

function createCalendarBuckets(records: CommitRecord[], granularity: CommitMetadataCalendarGranularity): CommitMetadataBucket[] {
  const bucketMap = new Map<string, CommitMetadataBucket>();
  records.forEach((record, index) => {
    const date = new Date(record.committedAt);
    const id = formatCalendarBucketId(date, granularity);
    const existing = bucketMap.get(id);
    if (existing) {
      existing.endDate = record.committedAt;
      existing.endCommitIndex = index;
      return;
    }

    bucketMap.set(id, {
      id,
      label: id,
      mode: 'calendar',
      startDate: record.committedAt,
      endDate: record.committedAt,
      startCommitIndex: index,
      endCommitIndex: index,
    });
  });

  return Array.from(bucketMap.values()).sort((a, b) => a.id.localeCompare(b.id));
}

function createCommitCountBuckets(
  records: CommitRecord[],
  strategy: CommitMetadataCommitBucketStrategy,
  bucketSize: number,
  bucketCount: number
): CommitMetadataBucket[] {
  const safeBucketSize = strategy === 'fixedSize'
    ? Math.max(1, Math.floor(bucketSize))
    : Math.max(1, Math.ceil(records.length / Math.max(1, Math.floor(bucketCount))));
  const buckets: CommitMetadataBucket[] = [];

  for (let start = 0; start < records.length; start += safeBucketSize) {
    const end = Math.min(records.length - 1, start + safeBucketSize - 1);
    const id = `${start + 1}-${end + 1}`;
    buckets.push({
      id,
      label: `Commits ${start + 1}–${end + 1}`,
      mode: 'commitCount',
      startDate: records[start]?.committedAt,
      endDate: records[end]?.committedAt,
      startCommitIndex: start,
      endCommitIndex: end,
    });
  }

  return buckets;
}

function assignCommitsToBuckets(records: CommitRecord[], buckets: CommitMetadataBucket[]): BucketedCommit[] {
  const bucketByCalendarId = new Map(buckets.map((bucket) => [bucket.id, bucket]));
  return records.flatMap((record, index) => {
    const bucket = buckets.find((candidate) => index >= candidate.startCommitIndex && index <= candidate.endCommitIndex)
      ?? bucketByCalendarId.get(formatCalendarBucketId(new Date(record.committedAt), 'month'));
    return bucket ? [{ record, sortedIndex: index, bucket }] : [];
  });
}

function createDiagnostics(options: {
  analyzedCommitCount: number;
  factsByCommit: Map<string, CommitMetadataFact[]>;
  context: ExtractionContext;
}): CommitMetadataDiagnostics {
  let matchedCommitCount = 0;
  for (const facts of options.factsByCommit.values()) {
    if (facts.length > 0) {
      matchedCommitCount += 1;
    }
  }

  const invalidExtractorIds = Array.from(options.context.invalidExtractorIds);
  const unavailableDimensions = Array.from(options.context.unavailableDimensions);
  const availability = unavailableDimensions.length > 0
    ? 'unavailable'
    : invalidExtractorIds.length > 0
      ? 'partial'
      : 'available';

  return {
    availability,
    analyzedCommitCount: options.analyzedCommitCount,
    matchedCommitCount,
    unmatchedCommitCount: options.analyzedCommitCount - matchedCommitCount,
    invalidExtractorIds,
    unavailableDimensions,
    notes: dedupeValues(options.context.notes),
  };
}

function getRecordsSortedByTime(records: CommitRecord[]): CommitRecord[] {
  return [...records].sort((a, b) => a.timestamp - b.timestamp || a.sha.localeCompare(b.sha));
}

function matchFirst(value: string, regex: RegExp): string[] {
  const match = regex.exec(value);
  return match?.[1] ? [match[1]] : [];
}

function matchAll(value: string, regex: RegExp): string[] {
  return Array.from(value.matchAll(regex), (match) => match[1]).filter((item): item is string => Boolean(item));
}

function readCapture(match: RegExpMatchArray, captureGroup: string): string | undefined {
  if (/^\d+$/.test(captureGroup)) {
    return match[Number(captureGroup)];
  }

  return match.groups?.[captureGroup];
}

function ensureGlobalFlags(flags: string): string {
  const uniqueFlags = new Set(`${flags}${GLOBAL_REGEX_FLAGS}`.split(''));
  return Array.from(uniqueFlags).join('');
}

function dedupeValues(values: string[]): string[] {
  return Array.from(new Set(values.filter((value) => value.length > 0)));
}

function extractPathMetadata(
  record: CommitRecord,
  dimension: string,
  context: ExtractionContext | undefined,
  extractorName: string,
  mapper: (filePath: string) => string | null
): string[] {
  if (!record.changedFiles) {
    context?.unavailableDimensions.add(dimension);
    context?.notes.push(`${extractorName} requires per-commit changed path metadata, but this result does not include it.`);
    return [];
  }

  return dedupeValues(record.changedFiles.flatMap((filePath) => {
    const value = mapper(filePath);
    return value ? [value] : [];
  }));
}

function getTopLevelDirectory(filePath: string): string | null {
  const normalized = filePath.replace(/\\/g, '/').replace(/^\.\//, '');
  const slashIndex = normalized.indexOf('/');
  if (slashIndex === -1) {
    return '(root)';
  }
  return normalized.slice(0, slashIndex) || null;
}

function getFileExtension(filePath: string): string | null {
  const normalized = filePath.replace(/\\/g, '/');
  const fileName = normalized.slice(normalized.lastIndexOf('/') + 1);
  const dotIndex = fileName.lastIndexOf('.');
  if (dotIndex <= 0 || dotIndex === fileName.length - 1) {
    return '(none)';
  }
  return fileName.slice(dotIndex).toLowerCase();
}

function bucketCommitSize(changedLines: number): string {
  if (changedLines === 0) {
    return '0 changed lines';
  }
  if (changedLines <= 10) {
    return '1–10 changed lines';
  }
  if (changedLines <= 100) {
    return '11–100 changed lines';
  }
  if (changedLines <= 500) {
    return '101–500 changed lines';
  }
  return '501+ changed lines';
}

function bucketFileCount(filesChanged: number): string {
  if (filesChanged === 0) {
    return '0 files';
  }
  if (filesChanged === 1) {
    return '1 file';
  }
  if (filesChanged <= 5) {
    return '2–5 files';
  }
  if (filesChanged <= 20) {
    return '6–20 files';
  }
  return '21+ files';
}

function formatCalendarBucketId(date: Date, granularity: CommitMetadataCalendarGranularity): string {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  switch (granularity) {
    case 'day':
      return `${year}-${pad2(month)}-${pad2(date.getDate())}`;
    case 'week':
      return getISOWeek(date);
    case 'month':
      return `${year}-${pad2(month)}`;
    case 'quarter':
      return `${year}-Q${Math.floor((month - 1) / 3) + 1}`;
    case 'year':
      return `${year}`;
  }
}

function getISOWeek(date: Date): string {
  const utcDate = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = utcDate.getUTCDay() || 7;
  utcDate.setUTCDate(utcDate.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(utcDate.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((utcDate.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${utcDate.getUTCFullYear()}-W${pad2(week)}`;
}

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}
