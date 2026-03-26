import { describe, expect, it } from 'vitest';
import { parseBlameStream } from './blameStream';

const defaults = {
  defaultAuthor: 'Unknown',
  defaultEmail: 'unknown@unknown.local',
  defaultAuthorTime: 1_800_000_000,
};

describe('parseBlameStream', () => {
  it('parses incremental blame hunks and reuses commit metadata', () => {
    const output = [
      'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa 1 1 1',
      'author Alice',
      'author-mail <alice@example.com>',
      'author-time 1799000000',
      'filename src/a.ts',
      'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa 2 2 2',
      'filename src/a.ts',
      '',
    ].join('\n');

    const hunks = parseBlameStream(output, defaults);

    expect(hunks).toEqual([
      {
        commit: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        lines: 1,
        author: 'Alice',
        email: 'alice@example.com',
        authorTime: 1799000000,
      },
      {
        commit: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        lines: 2,
        author: 'Alice',
        email: 'alice@example.com',
        authorTime: 1799000000,
      },
    ]);
  });

  it('parses line-porcelain blame hunks terminated by source lines', () => {
    const output = [
      'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb 1 1 2',
      'author Bob',
      'author-mail <bob@example.com>',
      'author-time 1798000000',
      '\tconst a = 1;',
      'cccccccccccccccccccccccccccccccccccccccc 3 3 1',
      'author Carol',
      'author-mail <carol@example.com>',
      'author-time 1797000000',
      '\tconst b = 2;',
      '',
    ].join('\n');

    const hunks = parseBlameStream(output, defaults);

    expect(hunks).toEqual([
      {
        commit: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
        lines: 2,
        author: 'Bob',
        email: 'bob@example.com',
        authorTime: 1798000000,
      },
      {
        commit: 'cccccccccccccccccccccccccccccccccccccccc',
        lines: 1,
        author: 'Carol',
        email: 'carol@example.com',
        authorTime: 1797000000,
      },
    ]);
  });
});
