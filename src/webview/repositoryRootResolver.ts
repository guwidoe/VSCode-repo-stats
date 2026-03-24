import * as vscode from 'vscode';
import simpleGit, { type SimpleGit } from 'simple-git';
import type { RepositoryDiscoveryWarning } from './context.js';

export type RepositoryRootResolution =
  | { kind: 'resolved'; rootUri: vscode.Uri }
  | { kind: 'not-repository' }
  | { kind: 'error'; warning: RepositoryDiscoveryWarning };

type GitFactory = (repoPath: string) => SimpleGit;

export class RepositoryRootResolver {
  constructor(private readonly createGit: GitFactory = simpleGit) {}

  async resolve(
    repoPath: string,
    source: RepositoryDiscoveryWarning['source']
  ): Promise<RepositoryRootResolution> {
    const git = this.createGit(repoPath);

    try {
      if (!(await git.checkIsRepo())) {
        return { kind: 'not-repository' };
      }

      const rootPath = (await git.revparse(['--show-toplevel'])).trim();
      if (rootPath.length === 0) {
        return {
          kind: 'error',
          warning: {
            source,
            message: 'Git reported a repository but did not return a root path.',
            repositoryPath: repoPath,
          },
        };
      }

      return { kind: 'resolved', rootUri: vscode.Uri.file(rootPath) };
    } catch (error) {
      return {
        kind: 'error',
        warning: {
          source,
          message: `Failed to resolve repository root: ${formatResolverError(error)}`,
          repositoryPath: repoPath,
        },
      };
    }
  }
}

function formatResolverError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
