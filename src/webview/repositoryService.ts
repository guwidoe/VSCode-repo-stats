import * as vscode from 'vscode';
import simpleGit from 'simple-git';
import * as path from 'path';
import {
  buildRepositoryOption,
} from './repositorySelection.js';
import { getConfiguredBookmarkedRepositories } from './bookmarkedRepositoryConfig.js';
import { RepositoryRootResolver, type RepositoryRootResolution } from './repositoryRootResolver.js';
import type {
  GitExtensionExports,
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

  constructor(_workspaceState: vscode.Memento) {}

  async listAvailableRepositories(): Promise<RepositoryContext[]> {
    const result = await this.listAvailableRepositoriesDetailed();

    return result.repositories;
  }

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
    const seen = new Set<string>();
    const repositories: vscode.Uri[] = [];
    const warnings: RepositoryDiscoveryWarning[] = [];

    const addRepositoryUri = (rootUri: vscode.Uri) => {
      const workspaceFolder = vscode.workspace.getWorkspaceFolder(rootUri);
      if (!workspaceFolder || seen.has(rootUri.fsPath)) {
        return;
      }

      seen.add(rootUri.fsPath);
      repositories.push(rootUri);
    };

    const gitExtensionDiscovery = await this.getGitExtensionRepositoryUris();
    warnings.push(...gitExtensionDiscovery.warnings);
    const gitExtensionRoots = gitExtensionDiscovery.repositories;
    gitExtensionRoots.forEach(addRepositoryUri);

    const scannedDiscovery = await this.findNestedRepositoryRootUris(workspaceFolders);
    warnings.push(...scannedDiscovery.warnings);
    const scannedRoots = scannedDiscovery.repositories;
    scannedRoots.forEach(addRepositoryUri);

    const submoduleDiscovery = await this.findSubmoduleRootUris(repositories);
    warnings.push(...submoduleDiscovery.warnings);
    const submoduleRoots = submoduleDiscovery.repositories;
    submoduleRoots.forEach(addRepositoryUri);

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

  private async getGitExtensionRepositoryUris(): Promise<{ repositories: vscode.Uri[]; warnings: RepositoryDiscoveryWarning[] }> {
    const gitExtension = vscode.extensions.getExtension<GitExtensionExports>('vscode.git');
    if (!gitExtension) {
      return { repositories: [], warnings: [] };
    }

    let gitApi: GitExtensionExports | undefined;
    try {
      gitApi = (gitExtension.isActive ? gitExtension.exports : await gitExtension.activate()) as GitExtensionExports;
    } catch (error) {
      return {
        repositories: [],
        warnings: [{
          source: 'git-extension',
          message: `Failed to activate the Git extension while discovering repositories: ${this.formatErrorMessage(error)}`,
        }],
      };
    }

    if (!gitApi) {
      return { repositories: [], warnings: [] };
    }

    try {
      return {
        repositories: gitApi.getAPI(1).repositories.map((repository) => repository.rootUri),
        warnings: [],
      };
    } catch (error) {
      return {
        repositories: [],
        warnings: [{
          source: 'git-extension',
          message: `Failed to read repositories from the Git extension: ${this.formatErrorMessage(error)}`,
        }],
      };
    }
  }

  private async findNestedRepositoryRootUris(
    workspaceFolders: readonly vscode.WorkspaceFolder[]
  ): Promise<{ repositories: vscode.Uri[]; warnings: RepositoryDiscoveryWarning[] }> {
    const discovered = new Map<string, vscode.Uri>();
    const warnings: RepositoryDiscoveryWarning[] = [];

    for (const workspaceFolder of workspaceFolders) {
      try {
        const configUris = await vscode.workspace.findFiles(
          new vscode.RelativePattern(workspaceFolder, '**/.git/config'),
          new vscode.RelativePattern(workspaceFolder, '**/{node_modules,dist,build,.next,.nuxt,.yarn,.pnpm-store}/**')
        );

        for (const configUri of configUris) {
          const repoRoot = path.dirname(path.dirname(configUri.fsPath));
          discovered.set(repoRoot, vscode.Uri.file(repoRoot));
        }
      } catch (error) {
        warnings.push({
          source: 'workspace',
          message: `Failed to scan workspace folder for nested repositories: ${this.formatErrorMessage(error)}`,
          repositoryPath: workspaceFolder.uri.fsPath,
        });
      }
    }

    return {
      repositories: [...discovered.values()],
      warnings,
    };
  }

  private async findSubmoduleRootUris(
    repositoryRoots: readonly vscode.Uri[]
  ): Promise<{ repositories: vscode.Uri[]; warnings: RepositoryDiscoveryWarning[] }> {
    const discovered = new Map<string, vscode.Uri>();
    const warnings: RepositoryDiscoveryWarning[] = [];

    for (const repositoryRoot of repositoryRoots) {
      const git = simpleGit(repositoryRoot.fsPath);
      let output: string;

      try {
        output = await git.raw(['submodule', 'status', '--recursive']);
      } catch (error) {
        warnings.push({
          source: 'submodule',
          message: `Failed to inspect submodules: ${this.formatErrorMessage(error)}`,
          repositoryPath: repositoryRoot.fsPath,
        });
        continue;
      }

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

        const resolution = await this.resolveRepositoryRootUri(submoduleRoot, 'submodule');
        if (resolution.kind === 'resolved') {
          discovered.set(resolution.rootUri.fsPath, resolution.rootUri);
        } else if (resolution.kind === 'error') {
          warnings.push(resolution.warning);
        }
      }
    }

    return {
      repositories: [...discovered.values()],
      warnings,
    };
  }

  private formatErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
