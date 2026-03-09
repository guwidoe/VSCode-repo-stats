import { afterEach, describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';
import { execFileSync } from 'child_process';
import { GitAnalyzer } from './gitAnalyzer';

function runGit(args: string[], cwd: string, env: NodeJS.ProcessEnv = {}): string {
  return execFileSync('git', args, {
    cwd,
    env: { ...process.env, ...env },
    encoding: 'utf8',
  }).trim();
}

function commitFile(options: {
  repoPath: string;
  filePath: string;
  content: string;
  name: string;
  email: string;
  date: string;
  message: string;
}): void {
  const fullPath = path.join(options.repoPath, options.filePath);
  mkdirSync(path.dirname(fullPath), { recursive: true });
  writeFileSync(fullPath, options.content, 'utf8');
  runGit(['add', options.filePath], options.repoPath);
  runGit(['commit', '-m', options.message], options.repoPath, {
    GIT_AUTHOR_NAME: options.name,
    GIT_AUTHOR_EMAIL: options.email,
    GIT_AUTHOR_DATE: options.date,
    GIT_COMMITTER_NAME: options.name,
    GIT_COMMITTER_EMAIL: options.email,
    GIT_COMMITTER_DATE: options.date,
  });
}

describe('GitAnalyzer', () => {
  const repos: string[] = [];

  afterEach(() => {
    for (const repoPath of repos.splice(0)) {
      rmSync(repoPath, { recursive: true, force: true });
    }
  });

  it('excludes configured directories from contributor and code frequency stats', async () => {
    const repoPath = mkdtempSync(path.join(tmpdir(), 'repo-stats-git-analyzer-'));
    repos.push(repoPath);

    runGit(['init', '-b', 'main'], repoPath);
    runGit(['config', 'user.name', 'Test User'], repoPath);
    runGit(['config', 'user.email', 'test@example.com'], repoPath);
    runGit(['config', 'commit.gpgsign', 'false'], repoPath);

    commitFile({
      repoPath,
      filePath: 'src/app.ts',
      content: 'const app = 1;\n',
      name: 'Alice',
      email: 'alice@example.com',
      date: '2024-01-01T12:00:00Z',
      message: 'add app',
    });
    commitFile({
      repoPath,
      filePath: 'backend/fixtures/seed.ts',
      content: 'export const seed = 1;\n',
      name: 'Alice',
      email: 'alice@example.com',
      date: '2024-01-08T12:00:00Z',
      message: 'add excluded fixture',
    });
    commitFile({
      repoPath,
      filePath: 'src/app.ts',
      content: 'const app = 2;\nconst next = 3;\n',
      name: 'Bob',
      email: 'bob@example.com',
      date: '2024-01-15T12:00:00Z',
      message: 'update app',
    });

    const analyzer = new GitAnalyzer(repoPath);
    const excluded = ['**/backend/fixtures/**'];

    const analytics = await analyzer.getCommitAnalytics(10, excluded);
    const contributors = await analyzer.getContributorStats(10, excluded);
    const frequency = await analyzer.getCodeFrequency(10, excluded);

    expect(analytics.summary).toMatchObject({
      totalCommits: 2,
      totalChangedLines: 4,
    });
    expect(analytics.contributorSummaries).toEqual([
      expect.objectContaining({
        authorName: 'Alice',
        totalCommits: 1,
      }),
      expect.objectContaining({
        authorName: 'Bob',
        totalCommits: 1,
      }),
    ]);

    expect(contributors).toHaveLength(2);

    const contributorsByEmail = new Map(
      contributors.map((contributor) => [contributor.email, contributor])
    );

    expect(contributorsByEmail.get('alice@example.com')).toMatchObject({
      commits: 1,
      linesAdded: 1,
      linesDeleted: 0,
    });
    expect(contributorsByEmail.get('bob@example.com')).toMatchObject({
      commits: 1,
      linesAdded: 2,
      linesDeleted: 1,
    });

    expect(frequency).toHaveLength(2);
    expect(frequency.map((entry) => entry.week)).toEqual(['2024-W01', '2024-W03']);
    expect(frequency.map((entry) => ({ additions: entry.additions, deletions: entry.deletions }))).toEqual([
      { additions: 1, deletions: 0 },
      { additions: 2, deletions: 1 },
    ]);
  });
});
