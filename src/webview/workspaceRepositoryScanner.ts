import * as path from 'path';
import * as vscode from 'vscode';
import simpleGit, { type SimpleGit } from 'simple-git';
import type { GitExtensionExports, RepositoryDiscoveryWarning } from './context.js';
import { RepositoryRootResolver } from './repositoryRootResolver.js';

interface RepositoryUriDiscovery {
  repositories: vscode.Uri[];
  warnings: RepositoryDiscoveryWarning[];
}

type GitFactory = (repoPath: string) => SimpleGit;

export function parseSubmoduleStatusPaths(output: string): string[] {
  return output
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => line.match(/^[+-]?\s*[a-f0-9]+\s+(\S+)/)?.[1] ?? null)
    .filter((pathValue): pathValue is string => pathValue !== null);
}

export class WorkspaceRepositoryScanner {
  constructor(
    private readonly rootResolver: RepositoryRootResolver = new RepositoryRootResolver(),
    private readonly createGit: GitFactory = simpleGit
  ) {}

  async discoverRepositoryRoots(
    workspaceFolders: readonly vscode.WorkspaceFolder[]
  ): Promise<RepositoryUriDiscovery> {
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
    gitExtensionDiscovery.repositories.forEach(addRepositoryUri);

    const scannedDiscovery = await this.findNestedRepositoryRootUris(workspaceFolders);
    warnings.push(...scannedDiscovery.warnings);
    scannedDiscovery.repositories.forEach(addRepositoryUri);

    const submoduleDiscovery = await this.findSubmoduleRootUris(repositories);
    warnings.push(...submoduleDiscovery.warnings);
    submoduleDiscovery.repositories.forEach(addRepositoryUri);

    return { repositories, warnings };
  }

  private async getGitExtensionRepositoryUris(): Promise<RepositoryUriDiscovery> {
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
  ): Promise<RepositoryUriDiscovery> {
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
  ): Promise<RepositoryUriDiscovery> {
    const discovered = new Map<string, vscode.Uri>();
    const warnings: RepositoryDiscoveryWarning[] = [];

    for (const repositoryRoot of repositoryRoots) {
      const git = this.createGit(repositoryRoot.fsPath);
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

      for (const relativePath of parseSubmoduleStatusPaths(output)) {
        const submoduleRoot = path.join(repositoryRoot.fsPath, relativePath);
        if (!vscode.workspace.getWorkspaceFolder(vscode.Uri.file(submoduleRoot))) {
          continue;
        }

        const resolution = await this.rootResolver.resolve(submoduleRoot, 'submodule');
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
