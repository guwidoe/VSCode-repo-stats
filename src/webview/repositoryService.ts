import * as path from 'path';
import * as vscode from 'vscode';
import simpleGit from 'simple-git';
import {
  buildRepositoryOption,
} from './repositorySelection.js';
import type {
  GitExtensionExports,
  RepositoryContext,
} from './context.js';

export class RepositoryService {
  constructor(_workspaceState: vscode.Memento) {}

  async listAvailableRepositories(): Promise<RepositoryContext[]> {
    const workspaceRepositories = await this.listWorkspaceRepositories();
    const seenPaths = new Set(workspaceRepositories.map((repository) => repository.option.path));
    const bookmarkedRepositories = await this.listBookmarkedRepositories(seenPaths);

    return [...workspaceRepositories, ...bookmarkedRepositories].sort((a, b) => {
      const sourceOrder = this.getSourceOrder(a) - this.getSourceOrder(b);
      if (sourceOrder !== 0) {
        return sourceOrder;
      }

      return (a.option.workspaceFolderName ?? '').localeCompare(b.option.workspaceFolderName ?? '')
        || (a.option.relativePath ?? '').localeCompare(b.option.relativePath ?? '')
        || a.option.name.localeCompare(b.option.name)
        || a.option.path.localeCompare(b.option.path);
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

    return repositoryRoots.flatMap((rootUri) => {
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

    const addRepositoryUri = (rootUri: vscode.Uri) => {
      const workspaceFolder = vscode.workspace.getWorkspaceFolder(rootUri);
      if (!workspaceFolder || seen.has(rootUri.fsPath)) {
        return;
      }

      seen.add(rootUri.fsPath);
      repositories.push(rootUri);
    };

    const gitExtensionRoots = await this.getGitExtensionRepositoryUris();
    gitExtensionRoots.forEach(addRepositoryUri);

    const scannedRoots = await this.findNestedRepositoryRootUris(workspaceFolders);
    scannedRoots.forEach(addRepositoryUri);

    const submoduleRoots = await this.findSubmoduleRootUris(repositories);
    submoduleRoots.forEach(addRepositoryUri);

    if (repositories.length > 0) {
      return repositories;
    }

    for (const workspaceFolder of workspaceFolders) {
      const rootUri = await this.resolveRepositoryRootUri(workspaceFolder.uri.fsPath);
      if (rootUri) {
        addRepositoryUri(rootUri);
      }
    }

    return repositories;
  }

  private async getGitExtensionRepositoryUris(): Promise<vscode.Uri[]> {
    const gitExtension = vscode.extensions.getExtension<GitExtensionExports>('vscode.git');
    if (!gitExtension) {
      return [];
    }

    let gitApi: GitExtensionExports | undefined;
    try {
      gitApi = (gitExtension.isActive ? gitExtension.exports : await gitExtension.activate()) as GitExtensionExports;
    } catch (error) {
      console.warn('[RepoStats] Failed to activate the Git extension while discovering repositories:', error);
    }

    if (!gitApi) {
      return [];
    }

    try {
      return gitApi.getAPI(1).repositories.map((repository) => repository.rootUri);
    } catch (error) {
      console.warn('[RepoStats] Failed to read repositories from Git extension:', error);
    }

    return [];
  }

  private async findNestedRepositoryRootUris(
    workspaceFolders: readonly vscode.WorkspaceFolder[]
  ): Promise<vscode.Uri[]> {
    const discovered = new Map<string, vscode.Uri>();

    for (const workspaceFolder of workspaceFolders) {
      const configUris = await vscode.workspace.findFiles(
        new vscode.RelativePattern(workspaceFolder, '**/.git/config'),
        new vscode.RelativePattern(workspaceFolder, '**/{node_modules,dist,build,.next,.nuxt,.yarn,.pnpm-store}/**')
      );

      for (const configUri of configUris) {
        const repoRoot = path.dirname(path.dirname(configUri.fsPath));
        discovered.set(repoRoot, vscode.Uri.file(repoRoot));
      }
    }

    return [...discovered.values()];
  }

  private async findSubmoduleRootUris(repositoryRoots: readonly vscode.Uri[]): Promise<vscode.Uri[]> {
    const discovered = new Map<string, vscode.Uri>();

    for (const repositoryRoot of repositoryRoots) {
      const git = simpleGit(repositoryRoot.fsPath);
      const output = await git.raw(['submodule', 'status', '--recursive']).catch(() => '');

      for (const line of output.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed) {
          continue;
        }

        const match = trimmed.match(/^[+-]?\s*[a-f0-9]+\s+(\S+)/);
        if (!match) {
          continue;
        }

        const submoduleRoot = path.join(repositoryRoot.fsPath, match[1]);
        if (!vscode.workspace.getWorkspaceFolder(vscode.Uri.file(submoduleRoot))) {
          continue;
        }

        const resolvedRoot = await this.resolveRepositoryRootUri(submoduleRoot);
        if (resolvedRoot) {
          discovered.set(resolvedRoot.fsPath, resolvedRoot);
        }
      }
    }

    return [...discovered.values()];
  }
}
