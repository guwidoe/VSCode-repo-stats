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
    const workspaceFolders = vscode.workspace.workspaceFolders ?? [];
    if (workspaceFolders.length === 0) {
      return [];
    }

    const repositoryRoots = await this.getRepositoryRootUris(workspaceFolders);

    return repositoryRoots
      .map((rootUri) => {
        const workspaceFolder = vscode.workspace.getWorkspaceFolder(rootUri);
        if (!workspaceFolder) {
          return null;
        }

        return {
          option: buildRepositoryOption({
            repoPath: rootUri.fsPath,
            workspaceFolderPath: workspaceFolder.uri.fsPath,
            workspaceFolderName: workspaceFolder.name,
          }),
          rootUri,
          workspaceFolder,
        } satisfies RepositoryContext;
      })
      .filter((repository): repository is RepositoryContext => repository !== null)
      .sort((a, b) =>
        a.option.workspaceFolderName.localeCompare(b.option.workspaceFolderName) ||
        a.option.relativePath.localeCompare(b.option.relativePath) ||
        a.option.name.localeCompare(b.option.name)
      );
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
      const git = simpleGit(workspaceFolder.uri.fsPath);
      if (await git.checkIsRepo()) {
        if (!seen.has(workspaceFolder.uri.fsPath)) {
          seen.add(workspaceFolder.uri.fsPath);
          repositories.push(workspaceFolder.uri);
        }
      }
    }

    return repositories;
  }
}
