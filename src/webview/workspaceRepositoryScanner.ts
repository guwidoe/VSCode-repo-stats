import * as path from 'path';
import * as vscode from 'vscode';
import simpleGit, { type SimpleGit } from 'simple-git';
import type { RepositoryDiscoveryWarning } from './context.js';
import { RepositoryRootResolver } from './repositoryRootResolver.js';

interface RepositoryUriDiscovery {
  repositories: vscode.Uri[];
  warnings: RepositoryDiscoveryWarning[];
}

type GitFactory = (repoPath: string) => SimpleGit;

const nestedRepositoryDiscoverySetting = 'discovery.scanNestedRepositories';

export const defaultNestedRepositoryDiscoveryExcludePatterns = [
  '**/node_modules/**',
  '**/.pnpm/**',
  '**/.pnpm-store/**',
  '**/.next/**',
  '**/.nuxt/**',
  '**/.turbo/**',
  '**/.yarn/**',
  '**/dist/**',
  '**/build/**',
  '**/coverage/**',
  '**/output/**',
  '**/.cache/**',
  '**/.pytest_cache/**',
  '**/.mypy_cache/**',
  '**/.ruff_cache/**',
  '**/__pycache__/**',
  '**/.venv/**',
  '**/venv/**',
  '**/target/**',
  '**/.autoresearch-runs/**',
];

export function parseSubmoduleStatusPaths(output: string): string[] {
  return output
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => line.match(/^[+-]?\s*[a-f0-9]+\s+(\S+)/)?.[1] ?? null)
    .filter((pathValue): pathValue is string => pathValue !== null);
}

export function isNestedRepositoryDiscoveryEnabled(): boolean {
  return vscode.workspace
    .getConfiguration('repoStats')
    .get<boolean>(nestedRepositoryDiscoverySetting) ?? false;
}

export function getEnabledExcludePatterns(value: unknown): string[] {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return [];
  }

  return Object.entries(value)
    .filter((entry): entry is [string, true] => typeof entry[0] === 'string' && entry[1] === true)
    .map(([pattern]) => pattern.trim())
    .filter((pattern) => pattern.length > 0);
}

export function mergeExcludePatterns(patterns: readonly string[]): string[] {
  const seen = new Set<string>();
  const merged: string[] = [];

  for (const pattern of patterns) {
    const normalized = pattern.trim();
    if (!normalized || seen.has(normalized)) {
      continue;
    }

    seen.add(normalized);
    merged.push(normalized);
  }

  return merged;
}

export function toFindFilesExcludePattern(patterns: readonly string[]): string | undefined {
  const merged = mergeExcludePatterns(patterns);
  if (merged.length === 0) {
    return undefined;
  }

  if (merged.length === 1) {
    return merged[0];
  }

  return `{${merged.join(',')}}`;
}

export function getWorkspaceFileExcludePatterns(
  workspaceFolder: vscode.WorkspaceFolder
): string[] {
  const filesConfig = vscode.workspace.getConfiguration('files', workspaceFolder.uri);

  return mergeExcludePatterns([
    ...defaultNestedRepositoryDiscoveryExcludePatterns,
    ...getEnabledExcludePatterns(filesConfig.get('watcherExclude')),
    ...getEnabledExcludePatterns(filesConfig.get('exclude')),
  ]);
}

export function getWorkspaceFindFilesExcludePattern(
  workspaceFolder: vscode.WorkspaceFolder
): string | undefined {
  return toFindFilesExcludePattern(getWorkspaceFileExcludePatterns(workspaceFolder));
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

    const workspaceRootDiscovery = await this.findWorkspaceFolderRepositoryRootUris(workspaceFolders);
    warnings.push(...workspaceRootDiscovery.warnings);
    workspaceRootDiscovery.repositories.forEach(addRepositoryUri);

    if (isNestedRepositoryDiscoveryEnabled()) {
      const scannedDiscovery = await this.findNestedRepositoryRootUris(workspaceFolders);
      warnings.push(...scannedDiscovery.warnings);
      scannedDiscovery.repositories.forEach(addRepositoryUri);
    }

    const submoduleDiscovery = await this.findSubmoduleRootUris(repositories);
    warnings.push(...submoduleDiscovery.warnings);
    submoduleDiscovery.repositories.forEach(addRepositoryUri);

    return { repositories, warnings };
  }

  private async findWorkspaceFolderRepositoryRootUris(
    workspaceFolders: readonly vscode.WorkspaceFolder[]
  ): Promise<RepositoryUriDiscovery> {
    const discovered = new Map<string, vscode.Uri>();
    const warnings: RepositoryDiscoveryWarning[] = [];

    for (const workspaceFolder of workspaceFolders) {
      const resolution = await this.rootResolver.resolve(workspaceFolder.uri.fsPath, 'workspace');
      if (resolution.kind === 'resolved') {
        discovered.set(resolution.rootUri.fsPath, resolution.rootUri);
      } else if (resolution.kind === 'error') {
        warnings.push(resolution.warning);
      }
    }

    return {
      repositories: [...discovered.values()],
      warnings,
    };
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
          getWorkspaceFindFilesExcludePattern(workspaceFolder)
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
