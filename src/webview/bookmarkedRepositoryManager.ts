import * as path from 'path';
import * as vscode from 'vscode';
import simpleGit, { type SimpleGit } from 'simple-git';

type GitFactory = (repoPath: string) => SimpleGit;

export class BookmarkedRepositoryManager {
  constructor(private readonly createGit: GitFactory = simpleGit) {}

  getConfiguredBookmarkedRepositories(): string[] {
    const configured = vscode.workspace
      .getConfiguration('repoStats')
      .get<unknown>('bookmarkedRepositories');

    if (!Array.isArray(configured)) {
      return [];
    }

    return configured
      .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
      .map((value) => path.resolve(value.trim()));
  }

  async promptAndAddRepository(): Promise<string | null> {
    const pickedUris = await vscode.window.showOpenDialog({
      canSelectFiles: false,
      canSelectFolders: true,
      canSelectMany: false,
      openLabel: 'Add Repository',
      title: 'Select a Git repository to bookmark',
    });

    const pickedUri = pickedUris?.[0];
    if (!pickedUri) {
      return null;
    }

    const git = this.createGit(pickedUri.fsPath);
    const isGitRepo = await git.checkIsRepo();
    if (!isGitRepo) {
      vscode.window.showErrorMessage(`Selected folder is not a Git repository: ${pickedUri.fsPath}`);
      return null;
    }

    const repositoryRootPath = (await git.revparse(['--show-toplevel'])).trim();
    if (repositoryRootPath.length === 0) {
      vscode.window.showErrorMessage(`Could not determine the Git repository root for: ${pickedUri.fsPath}`);
      return null;
    }

    const bookmarkedRepositories = this.getConfiguredBookmarkedRepositories();
    if (bookmarkedRepositories.includes(repositoryRootPath)) {
      vscode.window.showInformationMessage(`Repository already bookmarked: ${repositoryRootPath}`);
      return null;
    }

    await vscode.workspace
      .getConfiguration('repoStats')
      .update(
        'bookmarkedRepositories',
        [...bookmarkedRepositories, repositoryRootPath],
        vscode.ConfigurationTarget.Global
      );

    vscode.window.showInformationMessage(`Added bookmarked repository: ${repositoryRootPath}`);
    return repositoryRootPath;
  }
}
