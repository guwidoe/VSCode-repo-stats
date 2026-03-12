import * as path from 'path';
import * as vscode from 'vscode';
import simpleGit from 'simple-git';
import {
  buildRepositoryOption,
  selectPreferredRepositoryPath,
} from './repositorySelection.js';
import type {
  GitExtensionExports,
  RepositoryContext,
  RepositorySelection,
} from './context.js';

export class RepositoryService {
  private static readonly selectedRepoPathStateKey = 'repoStats.selectedRepoPath';

  constructor(private readonly workspaceState: vscode.Memento) {}

  async getSelectedRepository(): Promise<RepositoryContext | undefined> {
    const selection = await this.resolveSelection();
    return selection.selected ?? undefined;
  }

  async resolveSelection(preferredRepoPath?: string): Promise<RepositorySelection> {
    const repositories = await this.listAvailableRepositories();
    const persistedRepoPath = preferredRepoPath ?? this.workspaceState.get<string>(RepositoryService.selectedRepoPathStateKey);
    const selectedRepoPath = selectPreferredRepositoryPath(
      repositories.map((repository) => repository.option),
      persistedRepoPath
    );

    await this.persistSelectedRepoPath(selectedRepoPath);

    return {
      repositories,
      selected: repositories.find((repository) => repository.option.path === selectedRepoPath) ?? null,
    };
  }

  async persistSelectedRepoPath(repoPath: string | null): Promise<void> {
    await this.workspaceState.update(RepositoryService.selectedRepoPathStateKey, repoPath ?? undefined);
  }

  async listAvailableRepositories(): Promise<RepositoryContext[]> {
    const workspaceRepositories = await this.listWorkspaceRepositories();
    const seenPaths = new Set(workspaceRepositories.map((repository) => repository.option.path));
    const bookmarkedRepositories = await this.listBookmarkedRepositories(seenPaths);

    return [...workspaceRepositories, ...bookmarkedRepositories].sort((a, b) => {
      const sourceOrder = this.getSourceOrder(a) - this.getSourceOrder(b);
      if (sourceOrder !== 0) {
        return sourceOrder;
      }

      return (a.option.workspaceFolderName ?? '').localeCompare(b.option.workspaceFolderName ?? '') ||
        (a.option.relativePath ?? '').localeCompare(b.option.relativePath ?? '') ||
        a.option.name.localeCompare(b.option.name) ||
        a.option.path.localeCompare(b.option.path);
    });
  }

  private getSourceOrder(repository: RepositoryContext): number {
    return repository.option.source === 'workspace' ? 0 : 1;
  }

  private async listWorkspaceRepositories(): Promise<RepositoryContext[]> {
    const workspaceFolders = vscode.workspace.workspaceFolders ?? [];
    if (workspaceFolders.length === 0) {
      return [];
    }

    const repositoryRoots = await this.getRepositoryRootUris(workspaceFolders);

    const repositories: RepositoryContext[] = [];

    for (const rootUri of repositoryRoots) {
      const workspaceFolder = vscode.workspace.getWorkspaceFolder(rootUri);
      if (!workspaceFolder) {
        continue;
      }

      repositories.push({
        option: buildRepositoryOption({
          source: 'workspace',
          repoPath: rootUri.fsPath,
          workspaceFolderPath: workspaceFolder.uri.fsPath,
          workspaceFolderName: workspaceFolder.name,
        }),
        rootUri,
        workspaceFolder,
      });
    }

    return repositories;
  }

  private async listBookmarkedRepositories(
    seenPaths: Set<string>
  ): Promise<RepositoryContext[]> {
    const bookmarkedPaths = this.getBookmarkedRepositoryPaths();
    const repositories: RepositoryContext[] = [];

    for (const bookmarkedPath of bookmarkedPaths) {
      const rootUri = await this.resolveRepositoryRootUri(bookmarkedPath);
      if (!rootUri) {
        console.warn(`[RepoStats] Ignoring bookmarked repository that is not available as a Git repo: ${bookmarkedPath}`);
        continue;
      }

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

    return repositories;
  }

  private getBookmarkedRepositoryPaths(): string[] {
    const configuredPaths = vscode.workspace
      .getConfiguration('repoStats')
      .get<unknown>('bookmarkedRepositories');

    if (!Array.isArray(configuredPaths)) {
      return [];
    }

    return configuredPaths
      .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
      .map((value) => path.resolve(value.trim()));
  }

  private async resolveRepositoryRootUri(repoPath: string): Promise<vscode.Uri | undefined> {
    const git = simpleGit(repoPath);

    try {
      if (!(await git.checkIsRepo())) {
        return undefined;
      }

      const rootPath = (await git.revparse(['--show-toplevel'])).trim();
      if (rootPath.length === 0) {
        return undefined;
      }

      return vscode.Uri.file(rootPath);
    } catch (error) {
      console.warn(`[RepoStats] Failed to resolve repository root for ${repoPath}:`, error);
      return undefined;
    }
  }

  private async getRepositoryRootUris(
    workspaceFolders: readonly vscode.WorkspaceFolder[]
  ): Promise<vscode.Uri[]> {
    const seen = new Set<string>();
    const repositories: vscode.Uri[] = [];

    const gitExtension = vscode.extensions.getExtension<GitExtensionExports>('vscode.git');
    if (gitExtension) {
      const gitApi = (gitExtension.isActive ? gitExtension.exports : await gitExtension.activate()) as GitExtensionExports;
      try {
        for (const repository of gitApi.getAPI(1).repositories) {
          const workspaceFolder = vscode.workspace.getWorkspaceFolder(repository.rootUri);
          if (!workspaceFolder || seen.has(repository.rootUri.fsPath)) {
            continue;
          }
          seen.add(repository.rootUri.fsPath);
          repositories.push(repository.rootUri);
        }
      } catch (error) {
        console.warn('[RepoStats] Failed to read repositories from Git extension:', error);
      }
    }

    if (repositories.length > 0) {
      return repositories;
    }

    for (const workspaceFolder of workspaceFolders) {
      const rootUri = await this.resolveRepositoryRootUri(workspaceFolder.uri.fsPath);
      if (!rootUri || seen.has(rootUri.fsPath)) {
        continue;
      }

      seen.add(rootUri.fsPath);
      repositories.push(rootUri);
    }

    return repositories;
  }
}
