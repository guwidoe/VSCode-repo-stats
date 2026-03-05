import { describe, expect, it } from 'vitest';
import { analyzeHeadBlameMetrics, parseBlamePorcelain } from './blameMetrics';
import type { TreemapNode } from '../types/index';

const NOW_UNIX_SECONDS = 1_800_000_000;

describe('parseBlamePorcelain', () => {
  it('parses incremental blame ownership and age distribution', () => {
    const output = [
      'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa 1 1 2',
      'author Alice',
      'author-mail <alice@example.com>',
      'author-time 1799990000',
      'filename src/a.ts',
      'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb 3 3 1',
      'author Bob',
      'author-mail <bob@example.com>',
      'author-time 1799000000',
      'filename src/a.ts',
      '',
    ].join('\n');

    const parsed = parseBlamePorcelain(output, NOW_UNIX_SECONDS);

    expect(parsed.totalLines).toBe(3);
    expect(parsed.topOwnerAuthor).toBe('Alice');
    expect(parsed.topOwnerLines).toBe(2);
    expect(parsed.topOwnerShare).toBeCloseTo(2 / 3, 5);
    expect(parsed.minAgeDays).toBeGreaterThanOrEqual(0);
    expect(parsed.maxAgeDays).toBeGreaterThanOrEqual(parsed.minAgeDays);
    expect(Array.from(parsed.ageCounts.values()).reduce((sum, c) => sum + c, 0)).toBe(3);
  });

  it('reuses commit metadata for repeated incremental hunks', () => {
    const output = [
      'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa 1 1 1',
      'author Alice',
      'author-mail <alice@example.com>',
      'author-time 1799000000',
      'filename src/a.ts',
      'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa 2 2 2',
      'filename src/a.ts',
      'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb 4 4 1',
      'author Bob',
      'author-mail <bob@example.com>',
      'author-time 1798000000',
      'filename src/a.ts',
      '',
    ].join('\n');

    const parsed = parseBlamePorcelain(output, NOW_UNIX_SECONDS);

    expect(parsed.totalLines).toBe(4);
    expect(parsed.topOwnerAuthor).toBe('Alice');
    expect(parsed.topOwnerLines).toBe(3);
    expect(parsed.ownership.get('Alice\u0000alice@example.com')?.lines).toBe(3);
    expect(parsed.ownership.get('Unknown\u0000unknown@unknown.local')).toBeUndefined();
    expect(parsed.maxAgeDays).toBeGreaterThan(0);
  });
});

describe('analyzeHeadBlameMetrics', () => {
  it('aggregates metrics and enriches file nodes', async () => {
    const nodeA: TreemapNode = {
      name: 'a.ts',
      path: 'src/a.ts',
      type: 'file',
      lines: 2,
      language: 'TypeScript',
    };
    const nodeB: TreemapNode = {
      name: 'b.ts',
      path: 'src/b.ts',
      type: 'file',
      lines: 1,
      language: 'TypeScript',
    };

    const blameMap = new Map<string, string>([
      [
        'src/a.ts',
        [
          'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa 1 1 2',
          'author Alice',
          'author-mail <alice@example.com>',
          'author-time 1799990000',
          'filename src/a.ts',
          '',
        ].join('\n'),
      ],
      [
        'src/b.ts',
        [
          'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb 1 1 1',
          'author Bob',
          'author-mail <bob@example.com>',
          'author-time 1799900000',
          'filename src/b.ts',
          '',
        ].join('\n'),
      ],
    ]);

    let commandCount = 0;
    const firstRun = await analyzeHeadBlameMetrics({
      headSha: 'head123',
      fileTargets: [
        { path: 'src/a.ts', node: nodeA },
        { path: 'src/b.ts', node: nodeB },
      ],
      headBlobShas: new Map([
        ['src/a.ts', 'sha-a'],
        ['src/b.ts', 'sha-b'],
      ]),
      runGitRaw: async (args) => {
        commandCount++;
        const path = args[args.length - 1];
        const output = blameMap.get(path);
        if (!output) {
          throw new Error(`No blame output for ${path}`);
        }
        return output;
      },
    });

    expect(firstRun.metrics.totals.filesAnalyzed).toBe(2);
    expect(firstRun.metrics.totals.filesSkipped).toBe(0);
    expect(firstRun.metrics.totals.totalBlamedLines).toBe(3);
    expect(firstRun.metrics.totals.cacheHits).toBe(0);
    expect(firstRun.metrics.ownershipByAuthor[0].author).toBe('Alice');
    expect(nodeA.blamedLines).toBe(2);
    expect(nodeA.topOwnerAuthor).toBe('Alice');
    expect(nodeB.blamedLines).toBe(1);
    expect(nodeB.topOwnerAuthor).toBe('Bob');

    const nodeA2: TreemapNode = {
      name: 'a.ts',
      path: 'src/a.ts',
      type: 'file',
      lines: 2,
      language: 'TypeScript',
    };

    const secondRun = await analyzeHeadBlameMetrics({
      headSha: 'head456',
      fileTargets: [{ path: 'src/a.ts', node: nodeA2 }],
      headBlobShas: new Map([['src/a.ts', 'sha-a']]),
      previousFileCache: firstRun.fileCache,
      runGitRaw: async () => {
        throw new Error('Should not execute blame command for cached blob');
      },
    });

    expect(commandCount).toBe(2);
    expect(secondRun.metrics.totals.cacheHits).toBe(1);
    expect(secondRun.metrics.totals.filesAnalyzed).toBe(1);
    expect(nodeA2.blamedLines).toBe(2);
  });

  it('emits partial blame snapshots while running', async () => {
    const nodeA: TreemapNode = {
      name: 'a.ts',
      path: 'src/a.ts',
      type: 'file',
      lines: 2,
      language: 'TypeScript',
    };
    const nodeB: TreemapNode = {
      name: 'b.ts',
      path: 'src/b.ts',
      type: 'file',
      lines: 1,
      language: 'TypeScript',
    };

    const partials: number[] = [];

    const result = await analyzeHeadBlameMetrics({
      headSha: 'head789',
      fileTargets: [
        { path: 'src/a.ts', node: nodeA },
        { path: 'src/b.ts', node: nodeB },
      ],
      runGitRaw: async (args) => {
        const path = args[args.length - 1];
        if (path === 'src/a.ts') {
          return [
            'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa 1 1 2',
            'author Alice',
            'author-mail <alice@example.com>',
            'author-time 1799990000',
            'filename src/a.ts',
            '',
          ].join('\n');
        }

        return [
          'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb 1 1 1',
          'author Bob',
          'author-mail <bob@example.com>',
          'author-time 1799900000',
          'filename src/b.ts',
          '',
        ].join('\n');
      },
      onPartial: (metrics) => {
        partials.push(metrics.totals.totalBlamedLines);
      },
    });

    expect(partials.length).toBeGreaterThan(0);
    expect(partials[partials.length - 1]).toBe(result.metrics.totals.totalBlamedLines);
  });
});
