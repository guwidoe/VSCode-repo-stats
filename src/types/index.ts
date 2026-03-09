/**
 * Extension type entrypoint.
 * Shared contracts live in `src/shared/contracts.ts`; extension-only errors stay here.
 */

export * from '../shared/contracts.js';

// ============================================================================
// Error Types
// ============================================================================

export class RepoStatsError extends Error {
  constructor(
    message: string,
    public readonly code: string
  ) {
    super(message);
    this.name = 'RepoStatsError';
  }
}

export class NotAGitRepoError extends RepoStatsError {
  constructor(path: string) {
    super(`"${path}" is not a Git repository`, 'NOT_GIT_REPO');
    this.name = 'NotAGitRepoError';
  }
}

export class GitNotFoundError extends RepoStatsError {
  constructor() {
    super('Git is not installed or not in PATH', 'GIT_NOT_FOUND');
    this.name = 'GitNotFoundError';
  }
}

export class SccNotFoundError extends RepoStatsError {
  constructor() {
    super(
      'scc binary not found and auto-download failed. ' +
        'Please install scc manually: https://github.com/boyter/scc#install',
      'SCC_NOT_FOUND'
    );
    this.name = 'SccNotFoundError';
  }
}
