import { describe, expect, it } from 'vitest';
import type {
  CommitAnalytics,
  CommitMetadataExtractorConfig,
  CommitMetadataSettings,
  CommitRecord,
} from '../types/index.js';
import { analyzeCommitMetadataTrends, extractMetadataFacts } from './commitMetadata.js';

function createRecord(overrides: Partial<CommitRecord>): CommitRecord {
  return {
    sha: overrides.sha ?? 'sha',
    repositoryId: overrides.repositoryId ?? 'repo',
    authorId: overrides.authorId ?? 0,
    committedAt: overrides.committedAt ?? '2026-01-01T00:00:00.000Z',
    timestamp: overrides.timestamp ?? Date.parse(overrides.committedAt ?? '2026-01-01T00:00:00.000Z'),
    summary: overrides.summary ?? 'feat: add thing',
    additions: overrides.additions ?? 1,
    deletions: overrides.deletions ?? 0,
    changedLines: overrides.changedLines ?? ((overrides.additions ?? 1) + (overrides.deletions ?? 0)),
    filesChanged: overrides.filesChanged ?? 1,
  };
}

function createAnalytics(records: CommitRecord[]): CommitAnalytics {
  return {
    authorDirectory: {
      idByEmail: {
        'ada@example.com': 0,
        'grace@example.com': 1,
      },
      namesById: ['Ada', 'Grace'],
      emailsById: ['ada@example.com', 'grace@example.com'],
    },
    records,
    summary: {
      totalCommits: records.length,
      totalAdditions: records.reduce((sum, record) => sum + record.additions, 0),
      totalDeletions: records.reduce((sum, record) => sum + record.deletions, 0),
      totalChangedLines: records.reduce((sum, record) => sum + record.changedLines, 0),
      averageChangedLines: 0,
      medianChangedLines: 0,
      averageFilesChanged: 0,
    },
    contributorSummaries: [],
    changedLineBuckets: [],
    fileChangeBuckets: [],
    indexes: {
      byTimestampAsc: records.map((_, index) => index),
      byAdditionsDesc: [],
      byDeletionsDesc: [],
      byChangedLinesDesc: [],
      byFilesChangedDesc: [],
    },
  };
}

function builtInExtractor(id: CommitMetadataExtractorConfig['id'], builtInId: Extract<CommitMetadataExtractorConfig, { kind: 'builtIn' }>['builtInId']): CommitMetadataExtractorConfig {
  return {
    id,
    name: id,
    enabled: true,
    dimension: id,
    includeUnmatched: false,
    unmatchedValue: 'Uncategorized',
    aliases: {},
    kind: 'builtIn',
    builtInId,
  };
}

function createSettings(extractors: CommitMetadataExtractorConfig[]): CommitMetadataSettings {
  return {
    extractors,
    defaultExtractorId: extractors[0]?.id ?? 'type',
    defaultBucketMode: 'calendar',
    defaultCalendarGranularity: 'month',
    defaultCommitBucketStrategy: 'fixedSize',
    defaultCommitBucketSize: 2,
    defaultCommitBucketCount: 2,
    defaultMetric: 'commits',
    defaultChartType: 'stackedBar',
    multiValueMode: 'countEach',
    includeUncategorized: false,
    maxSeries: 12,
    includeOtherSeries: true,
  };
}

describe('extractMetadataFacts', () => {
  it('extracts conventional type, scope, bracket tags, hashtags, and issue keys', () => {
    const analytics = createAnalytics([]);
    const record = createRecord({ summary: 'feat(ui)!: [bug] add #security ABC-123' });

    expect(extractMetadataFacts(record, builtInExtractor('type', 'conventionalType'), {
      analytics,
      extractor: builtInExtractor('type', 'conventionalType'),
      multiValueMode: 'countEach',
      includeUncategorized: false,
    }).map((fact) => fact.value)).toEqual(['feat']);
    expect(extractMetadataFacts(record, builtInExtractor('scope', 'conventionalScope'), {
      analytics,
      extractor: builtInExtractor('scope', 'conventionalScope'),
      multiValueMode: 'countEach',
      includeUncategorized: false,
    }).map((fact) => fact.value)).toEqual(['ui']);
    expect(extractMetadataFacts(record, builtInExtractor('tag', 'bracketTag'), {
      analytics,
      extractor: builtInExtractor('tag', 'bracketTag'),
      multiValueMode: 'countEach',
      includeUncategorized: false,
    }).map((fact) => fact.value)).toEqual(['bug']);
    expect(extractMetadataFacts(record, builtInExtractor('hash', 'hashTag'), {
      analytics,
      extractor: builtInExtractor('hash', 'hashTag'),
      multiValueMode: 'countEach',
      includeUncategorized: false,
    }).map((fact) => fact.value)).toEqual(['security']);
    expect(extractMetadataFacts(record, builtInExtractor('issue', 'issueKey'), {
      analytics,
      extractor: builtInExtractor('issue', 'issueKey'),
      multiValueMode: 'countEach',
      includeUncategorized: false,
    }).map((fact) => fact.value)).toEqual(['ABC-123']);
  });

  it('applies regex capture groups, normalization, aliases, and split weights', () => {
    const extractor: CommitMetadataExtractorConfig = {
      id: 'custom',
      name: 'Custom',
      enabled: true,
      dimension: 'tag',
      includeUnmatched: false,
      unmatchedValue: 'Untagged',
      aliases: {
        bugfix: 'fix',
      },
      kind: 'regex',
      regex: '\\[(?<tag>[^\\]]+)\\]',
      flags: 'i',
      captureGroup: 'tag',
      normalization: 'lowercase',
    };
    const facts = extractMetadataFacts(createRecord({ summary: '[BugFix] [Docs] update' }), extractor, {
      analytics: createAnalytics([]),
      extractor,
      multiValueMode: 'split',
      includeUncategorized: false,
    });

    expect(facts.map((fact) => fact.value)).toEqual(['fix', 'docs']);
    expect(facts.map((fact) => fact.weight)).toEqual([0.5, 0.5]);
  });

  it('uses first value mode and uncategorized fallback', () => {
    const tagExtractor = builtInExtractor('tag', 'bracketTag');
    const firstFacts = extractMetadataFacts(createRecord({ summary: '[one] [two] change' }), tagExtractor, {
      analytics: createAnalytics([]),
      extractor: tagExtractor,
      multiValueMode: 'first',
      includeUncategorized: false,
    });
    const unmatchedFacts = extractMetadataFacts(createRecord({ summary: 'plain commit' }), tagExtractor, {
      analytics: createAnalytics([]),
      extractor: tagExtractor,
      multiValueMode: 'countEach',
      includeUncategorized: true,
    });

    expect(firstFacts.map((fact) => fact.value)).toEqual(['one']);
    expect(unmatchedFacts.map((fact) => fact.value)).toEqual(['Uncategorized']);
  });
});

describe('analyzeCommitMetadataTrends', () => {
  it('aggregates calendar buckets and preserves commit shas for drilldown', () => {
    const analytics = createAnalytics([
      createRecord({ sha: 'a', summary: 'feat: add', committedAt: '2026-01-02T00:00:00.000Z', timestamp: Date.parse('2026-01-02T00:00:00.000Z'), additions: 3, changedLines: 3 }),
      createRecord({ sha: 'b', summary: 'fix: bug', committedAt: '2026-01-05T00:00:00.000Z', timestamp: Date.parse('2026-01-05T00:00:00.000Z'), additions: 2, deletions: 1, changedLines: 3 }),
      createRecord({ sha: 'c', summary: 'fix: bug', committedAt: '2026-02-01T00:00:00.000Z', timestamp: Date.parse('2026-02-01T00:00:00.000Z'), additions: 5, changedLines: 5 }),
    ]);

    const result = analyzeCommitMetadataTrends(analytics, createSettings([builtInExtractor('type', 'conventionalType')]), {
      calendarGranularity: 'month',
      metric: 'changedLines',
    });

    expect(result.buckets.map((bucket) => bucket.id)).toEqual(['2026-01', '2026-02']);
    expect(result.series.find((point) => point.bucketId === '2026-01' && point.value === 'fix')).toMatchObject({
      changedLines: 3,
      commitShas: ['b'],
    });
    expect(result.diagnostics).toMatchObject({
      availability: 'available',
      analyzedCommitCount: 3,
      matchedCommitCount: 3,
    });
  });

  it('aggregates fixed-size and equal commit-count buckets', () => {
    const records = Array.from({ length: 5 }, (_, index) => createRecord({
      sha: `c${index}`,
      summary: index % 2 === 0 ? 'feat: add' : 'fix: bug',
      committedAt: `2026-01-0${index + 1}T00:00:00.000Z`,
      timestamp: Date.parse(`2026-01-0${index + 1}T00:00:00.000Z`),
    }));
    const settings = createSettings([builtInExtractor('type', 'conventionalType')]);

    expect(analyzeCommitMetadataTrends(createAnalytics(records), settings, {
      bucketMode: 'commitCount',
      commitBucketStrategy: 'fixedSize',
      commitBucketSize: 2,
    }).buckets.map((bucket) => bucket.id)).toEqual(['1-2', '3-4', '5-5']);

    expect(analyzeCommitMetadataTrends(createAnalytics(records), settings, {
      bucketMode: 'commitCount',
      commitBucketStrategy: 'equalBuckets',
      commitBucketCount: 2,
    }).buckets.map((bucket) => bucket.id)).toEqual(['1-3', '4-5']);
  });

  it('limits series into Other and reports invalid regex and unavailable path dimensions', () => {
    const records = [
      createRecord({ sha: 'a', summary: '[a] change' }),
      createRecord({ sha: 'b', summary: '[b] change' }),
      createRecord({ sha: 'c', summary: '[c] change' }),
    ];
    const limited = analyzeCommitMetadataTrends(createAnalytics(records), createSettings([builtInExtractor('tag', 'bracketTag')]), {
      maxSeries: 2,
      includeOtherSeries: true,
    });
    const invalidRegex: CommitMetadataExtractorConfig = {
      id: 'bad',
      name: 'Bad',
      enabled: true,
      dimension: 'bad',
      includeUnmatched: false,
      unmatchedValue: 'bad',
      aliases: {},
      kind: 'regex',
      regex: '[',
      flags: '',
      captureGroup: 'tag',
      normalization: 'none',
    };
    const invalid = analyzeCommitMetadataTrends(createAnalytics(records), createSettings([invalidRegex]));
    const unavailable = analyzeCommitMetadataTrends(createAnalytics(records), createSettings([builtInExtractor('dir', 'directory')]), {
      includeUncategorized: false,
    });

    expect(limited.series.map((point) => point.value).sort()).toEqual(['Other', 'a', 'b']);
    expect(invalid.diagnostics.invalidExtractorIds).toEqual(['bad']);
    expect(invalid.diagnostics.availability).toBe('partial');
    expect(unavailable.diagnostics.unavailableDimensions).toEqual(['directory']);
    expect(unavailable.diagnostics.availability).toBe('unavailable');
  });
});
