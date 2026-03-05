import { describe, expect, it } from 'vitest';
import { analyzeHeadBlameMetrics, parseBlamePorcelain } from './blameMetrics';
import type { TreemapNode } from '../types/index';

const NOW_UNIX_SECONDS = 1_800_000_000;

describe('parseBlamePorcelain', () => {
  it('parses hunk ownership and age distribution', () => {
    const output = [
      'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa 1 1 2',
      'author Alice',
      'author-mail <alice@example.com>',
      'author-time 1799990000',
      '\tline a',
      '\tline b',
      'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb 3 3 1',
      'author Bob',
      'author-mail <bob@example.com>',
      'author-time 1799000000',
      '\tline c',
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
          '\tline a',
          '\tline b',
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
          '\tline c',
          '',
        ].join('\n'),
      ],
    ]);

    const metrics = await analyzeHeadBlameMetrics({
      headSha: 'head123',
      fileTargets: [
        { path: 'src/a.ts', node: nodeA },
        { path: 'src/b.ts', node: nodeB },
      ],
      runGitRaw: async (args) => {
        const path = args[args.length - 1];
        const output = blameMap.get(path);
        if (!output) {
          throw new Error(`No blame output for ${path}`);
        }
        return output;
      },
    });

    expect(metrics.totals.filesAnalyzed).toBe(2);
    expect(metrics.totals.filesSkipped).toBe(0);
    expect(metrics.totals.totalBlamedLines).toBe(3);
    expect(metrics.ownershipByAuthor[0].author).toBe('Alice');
    expect(nodeA.blamedLines).toBe(2);
    expect(nodeA.topOwnerAuthor).toBe('Alice');
    expect(nodeB.blamedLines).toBe(1);
    expect(nodeB.topOwnerAuthor).toBe('Bob');
  });
});
