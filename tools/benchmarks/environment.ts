import * as path from 'path';
import { spawnSync } from 'child_process';

export function repoRoot(): string {
  return path.resolve(__dirname, '../..');
}

export function benchmarkWorkspaceRoot(): string {
  return path.join(repoRoot(), '.bench-results', 'workspaces', 'analysis');
}

export function sccStoragePath(): string {
  return path.join(repoRoot(), '.bench-results', 'scc-storage');
}

export function runGit(repoPath: string, args: string[], extraEnv: NodeJS.ProcessEnv = {}): string {
  const result = spawnSync('git', args, {
    cwd: repoPath,
    encoding: 'utf8',
    env: {
      ...process.env,
      ...extraEnv,
    },
  });

  if (result.status !== 0) {
    throw new Error(
      `git ${args.join(' ')} failed in ${repoPath}: ${result.stderr || result.stdout || 'unknown error'}`
    );
  }

  return result.stdout.trim();
}

export function safeGitValue(args: string[], fallback: string): string {
  const result = spawnSync('git', args, {
    cwd: repoRoot(),
    encoding: 'utf8',
  });
  return result.status === 0 ? result.stdout.trim() : fallback;
}
