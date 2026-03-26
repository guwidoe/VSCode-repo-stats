import * as vscode from 'vscode';
import {
  buildRepositoryOption,
} from './repositorySelection.js';
import { getConfiguredBookmarkedRepositories } from './bookmarkedRepositoryConfig.js';
import { RepositoryRootResolver, type RepositoryRootResolution } from './repositoryRootResolver.js';
import { WorkspaceRepositoryScanner } from './workspaceRepositoryScanner.js';
import type {
  RepositoryDiscoveryWarning,
  RepositoryContext,
} from './context.js';

export interface RepositoryDiscoveryResult {
  repositories: RepositoryContext[];
  warnings: RepositoryDiscoveryWarning[];
}

export function formatRepositoryDiscoveryWarning(warning: RepositoryDiscoveryWarning): string {
  const location = warning.repositoryPath ? ` (${warning.repositoryPath})` : '';
  return `${warning.source}: ${warning.message}${location}`;
}

export class RepositoryService {
  private readonly rootResolver = new RepositoryRootResolver();
  private readonly workspaceScanner = new WorkspaceRepositoryScanner(this.rootResolver);

  async listAvailableRepositoriesDetailed(): Promise<RepositoryDiscoveryResult> {
    const workspaceDiscovery = await this.listWorkspaceRepositories();
    const workspaceRepositories = workspaceDiscovery.repositories;
    const seenPaths = new Set(workspaceRepositories.map((repository) => repository.option.path));
    const bookmarkedDiscovery = await this.listBookmarkedRepositories(seenPaths);
    const bookmarkedRepositories = bookmarkedDiscovery.repositories;

    const repositories = [...workspaceRepositories, ...bookmarkedRepositories].sort((a, b) => {
      const sourceOrder = this.getSourceOrder(a) - this.getSourceOrder(b);
      if (sourceOrder !== 0) {
        return sourceOrder;
      }

      return (a.option.workspaceFolderName ?? '').localeCompare(b.option.workspaceFolderName ?? '')
        || (a.option.relativePath ?? '').localeCompare(b.option.relativePath ?? '')
        || a.option.name.localeCompare(b.option.name)
        || a.option.path.localeCompare(b.option.path);
    });

    return {
      repositories,
      warnings: [...workspaceDiscovery.warnings, ...bookmarkedDiscovery.warnings],
    };
  }

  private getSourceOrder(repository: RepositoryContext): number {
    return repository.option.source === 'workspace' ? 0 : 1;
  }

  private async listWorkspaceRepositories(): Promise<RepositoryDiscoveryResult> {
    const workspaceFolders = vscode.workspace.workspaceFolders ?? [];
    if (workspaceFolders.length === 0) {
      return { repositories: [], warnings: [] };
    }

    const discovery = await this.getRepositoryRootUris(workspaceFolders);
    const repositories = discovery.repositories.flatMap((rootUri) => {
      const workspaceFolder = vscode.workspace.getWorkspaceFolder(rootUri);
      if (!workspaceFolder) {
        return [];
      }

      return [{
        option: buildRepositoryOption({
          source: 'workspace',
          repoPath: rootUri.fsPath,
          workspaceFolderPath: workspaceFolder.uri.fsPath,
          workspaceFolderName: workspaceFolder.name,
        }),
        rootUri,
        workspaceFolder,
      } satisfies RepositoryContext];
    });

    return {
      repositories,
      warnings: discovery.warnings,
    };
  }

  private async listBookmarkedRepositories(
    seenPaths: Set<string>
  ): Promise<RepositoryDiscoveryResult> {
    const bookmarkedPaths = getConfiguredBookmarkedRepositories();
    const repositories: RepositoryContext[] = [];
    const warnings: RepositoryDiscoveryWarning[] = [];

    for (const bookmarkedPath of bookmarkedPaths) {
      const resolution = await this.resolveRepositoryRootUri(bookmarkedPath, 'bookmarked');
      if (resolution.kind === 'not-repository') {
        warnings.push({
          source: 'bookmarked',
          message: 'Configured bookmark is not currently a Git repository.',
          repositoryPath: bookmarkedPath,
        });
        continue;
      }

      if (resolution.kind === 'error') {
        warnings.push(resolution.warning);
        continue;
      }

      const rootUri = resolution.rootUri;

      if (seenPaths.has(rootUri.fsPath)) {
        continue;
      }

      seenPaths.add(rootUri.fsPath);
      repositories.push({
        option: buildRepositoryOption({
          source: 'bookmarked',
          repoPath: rootUri.fsPath,
        }),
        rootUri,
        workspaceFolder: vscode.workspace.getWorkspaceFolder(rootUri),
      });
    }

    return {
      repositories,
      warnings,
    };
  }

  private async resolveRepositoryRootUri(
    repoPath: string,
    source: RepositoryDiscoveryWarning['source']
  ): Promise<RepositoryRootResolution> {
    return this.rootResolver.resolve(repoPath, source);
  }

  private async getRepositoryRootUris(
    workspaceFolders: readonly vscode.WorkspaceFolder[]
  ): Promise<{ repositories: vscode.Uri[]; warnings: RepositoryDiscoveryWarning[] }> {
    const discovered = await this.workspaceScanner.discoverRepositoryRoots(workspaceFolders);
    const repositories = [...discovered.repositories];
    const warnings = [...discovered.warnings];
    const seen = new Set(repositories.map((rootUri) => rootUri.fsPath));
    const addRepositoryUri = (rootUri: vscode.Uri) => {
      const workspaceFolder = vscode.workspace.getWorkspaceFolder(rootUri);
      if (!workspaceFolder || seen.has(rootUri.fsPath)) {
        return;
      }

      seen.add(rootUri.fsPath);
      repositories.push(rootUri);
    };

    if (repositories.length > 0) {
      return { repositories, warnings };
    }

    for (const workspaceFolder of workspaceFolders) {
      const resolution = await this.resolveRepositoryRootUri(workspaceFolder.uri.fsPath, 'workspace');
      if (resolution.kind === 'resolved') {
        addRepositoryUri(resolution.rootUri);
      } else if (resolution.kind === 'error') {
        warnings.push(resolution.warning);
      }
    }

    return { repositories, warnings };
  }
}
