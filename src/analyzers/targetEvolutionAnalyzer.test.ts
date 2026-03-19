import { afterEach, describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';
import { execFileSync } from 'child_process';
import type { AnalysisTarget, ExtensionSettings } from '../types';
import { createTargetEvolutionAnalyzer } from './targetEvolutionAnalyzer';

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

function createSettings(): ExtensionSettings {
  return {
    excludePatterns: [],
    maxCommitsToAnalyze: 1000,
    defaultColorMode: 'language',
    generatedPatterns: [],
    binaryExtensions: ['.png'],
    locExcludedExtensions: [],
    showEmptyTimePeriods: true,
    defaultGranularityMode: 'auto',
    autoGranularityThreshold: 20,
    overviewDisplayMode: 'percent',
    tooltipSettings: {
      showLinesOfCode: true,
      showFileSize: true,
      showLanguage: true,
      showLastModified: true,
      showComplexity: false,
      showCommentLines: false,
      showCommentRatio: false,
      showBlankLines: false,
      showCodeDensity: false,
      showFileCount: true,
    },
    treemap: {
      ageColorRangeMode: 'auto',
      ageColorNewestDate: '',
      ageColorOldestDate: '',
    },
    evolution: {
      autoRun: false,
      samplingMode: 'time',
      snapshotIntervalDays: 7,
      snapshotIntervalCommits: 1,
      showInactivePeriods: false,
      maxSnapshots: 20,
      maxSeries: 20,
      cohortFormat: '%Y',
    },
  };
}

describe('TargetEvolutionAnalyzer', () => {
  const repos: string[] = [];

  afterEach(() => {
    for (const repoPath of repos.splice(0)) {
      rmSync(repoPath, { recursive: true, force: true });
    }
  });

  it('merges evolution snapshots across multiple repositories', async () => {
    const repoA = mkdtempSync(path.join(tmpdir(), 'repo-stats-target-evo-a-'));
    const repoB = mkdtempSync(path.join(tmpdir(), 'repo-stats-target-evo-b-'));
    repos.push(repoA, repoB);

    for (const repoPath of [repoA, repoB]) {
      runGit(['init', '-b', 'main'], repoPath);
      runGit(['config', 'user.name', 'Test User'], repoPath);
      runGit(['config', 'user.email', 'test@example.com'], repoPath);
      runGit(['config', 'commit.gpgsign', 'false'], repoPath);
    }

    commitFile({
      repoPath: repoA,
      filePath: 'src/app.ts',
      content: 'const app = 1;\n',
      name: 'Alice',
      email: 'alice@example.com',
      date: '2024-01-01T12:00:00Z',
      message: 'add app',
    });
    commitFile({
      repoPath: repoB,
      filePath: 'lib/util.ts',
      content: 'export const util = 1;\n',
      name: 'Bob',
      email: 'bob@example.com',
      date: '2024-02-01T12:00:00Z',
      message: 'add util',
    });

    const target: AnalysisTarget = {
      id: 'workspace:test',
      kind: 'workspace',
      label: 'Workspace repositories',
      settingsScope: 'workspace',
      members: [
        {
          id: repoA,
          role: 'workspaceRepo',
          repoPath: repoA,
          displayName: 'repo-a',
          logicalRoot: 'repo-a',
          pathPrefix: 'repo-a',
        },
        {
          id: repoB,
          role: 'workspaceRepo',
          repoPath: repoB,
          displayName: 'repo-b',
          logicalRoot: 'repo-b',
          pathPrefix: 'repo-b',
        },
      ],
    };

    const phases: string[] = [];
    const result = await createTargetEvolutionAnalyzer(target, createSettings()).analyze((update) => {
      phases.push(update.phase);
    });

    expect(result.targetId).toBe('workspace:test');
    expect(result.historyMode).toBe('mergedMembers');
    expect(result.memberHeads).toHaveLength(2);
    expect(result.authors.labels).toEqual(expect.arrayContaining(['Alice', 'Bob']));
    expect(result.dirs.labels).toEqual(expect.arrayContaining(['repo-a/', 'repo-b/']));
    expect(result.authors.snapshots).toHaveLength(2);
    expect(result.authors.y.flat().reduce((sum, value) => sum + value, 0)).toBeGreaterThan(0);
    expect(phases).toEqual(expect.arrayContaining([
      expect.stringContaining('Selected 2 snapshots across 2 history events'),
      expect.stringContaining('Analyzing snapshots for repo-a'),
      expect.stringContaining('Analyzing snapshots for repo-b'),
    ]));
  });
});
