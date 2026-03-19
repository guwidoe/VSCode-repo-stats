import * as path from 'path';
import type {
  AnalysisTarget,
  AnalysisTargetMember,
  AnalysisTargetOption,
  RepositoryOption,
} from '../types/index.js';

interface RepositoryTargetInput {
  option: RepositoryOption;
  rootPath: string;
}

function normalizePath(filePath: string): string {
  return filePath.replace(/\\/g, '/');
}

function buildRepositoryTargetId(repoPath: string): string {
  return `repo:${normalizePath(repoPath)}`;
}

function buildSelectionTargetId(repoPaths: string[]): string {
  return `selection:${repoPaths.map(normalizePath).sort((a, b) => a.localeCompare(b)).join('|')}`;
}

function buildWorkspaceMemberPrefix(option: RepositoryOption): string {
  if (option.source === 'workspace') {
    if (option.relativePath && option.relativePath !== '.') {
      return `${option.workspaceFolderName ?? option.name}/${option.relativePath}`;
    }

    return option.workspaceFolderName ?? option.name;
  }

  return option.name;
}

function ensureUniquePrefixes(prefixes: string[]): string[] {
  const counts = new Map<string, number>();

  return prefixes.map((prefix) => {
    const normalized = normalizePath(prefix);
    const currentCount = counts.get(normalized) ?? 0;
    counts.set(normalized, currentCount + 1);
    if (currentCount === 0) {
      return normalized;
    }

    return `${normalized}-${currentCount + 1}`;
  });
}

function isNestedRepositoryPath(parentRepoPath: string, childRepoPath: string): boolean {
  const normalizedParent = normalizePath(parentRepoPath).replace(/\/+$/, '');
  const normalizedChild = normalizePath(childRepoPath).replace(/\/+$/, '');

  return normalizedChild.startsWith(`${normalizedParent}/`);
}

function buildExcludePatternsForNestedRepositories(
  repository: RepositoryTargetInput,
  selectedRepositories: RepositoryTargetInput[]
): string[] | undefined {
  const nestedPaths = selectedRepositories
    .filter((candidate) => candidate.rootPath !== repository.rootPath)
    .filter((candidate) => isNestedRepositoryPath(repository.rootPath, candidate.rootPath))
    .map((candidate) => normalizePath(path.relative(repository.rootPath, candidate.rootPath)))
    .sort((a, b) => a.localeCompare(b));

  return nestedPaths.length > 0 ? nestedPaths : undefined;
}

export function buildSingleRepositoryTarget(repository: RepositoryTargetInput): AnalysisTarget {
  return {
    id: buildRepositoryTargetId(repository.option.path),
    kind: 'repository',
    label: repository.option.name,
    description: repository.option.source === 'workspace'
      ? repository.option.relativePath === '.' || !repository.option.relativePath
        ? repository.option.workspaceFolderName ?? 'Workspace repository'
        : `${repository.option.workspaceFolderName ?? 'Workspace'}/${repository.option.relativePath}`
      : `Bookmarked repository • ${repository.option.path}`,
    settingsScope: 'repo',
    settingsPath: repository.rootPath,
    members: [
      {
        id: repository.option.path,
        role: 'primary',
        repoPath: repository.rootPath,
        displayName: repository.option.name,
        logicalRoot: repository.option.name,
        pathPrefix: '',
        workspaceFolderName: repository.option.workspaceFolderName,
      },
    ],
  };
}

export function buildSelectionTarget(repositories: RepositoryTargetInput[]): AnalysisTarget {
  if (repositories.length === 1) {
    return buildSingleRepositoryTarget(repositories[0]);
  }

  const prefixes = ensureUniquePrefixes(
    repositories.map((repository) => buildWorkspaceMemberPrefix(repository.option))
  );

  const members: AnalysisTargetMember[] = repositories.map((repository, index) => ({
    id: repository.option.path,
    role: 'workspaceRepo',
    repoPath: repository.rootPath,
    displayName: repository.option.name,
    logicalRoot: prefixes[index],
    pathPrefix: prefixes[index],
    workspaceFolderName: repository.option.workspaceFolderName,
    excludePatterns: buildExcludePatternsForNestedRepositories(repository, repositories),
  }));

  return {
    id: buildSelectionTargetId(repositories.map((repository) => repository.rootPath)),
    kind: 'workspace',
    label: 'Selected repositories',
    description: `${repositories.length} repositories selected`,
    settingsScope: 'workspace',
    members,
  };
}

export function buildTargetForSelectedRepositories(repositories: RepositoryTargetInput[]): AnalysisTarget | null {
  if (repositories.length === 0) {
    return null;
  }

  return buildSelectionTarget(repositories);
}

export function toAnalysisTargetOption(target: AnalysisTarget): AnalysisTargetOption {
  return {
    id: target.id,
    kind: target.kind,
    label: target.label,
    description: target.description,
    memberCount: target.members.length,
    settingsScope: target.settingsScope,
  };
}

export function selectPreferredRepositoryIds(
  repositories: Pick<RepositoryOption, 'path'>[],
  preferredRepositoryIds?: string[]
): string[] {
  if (repositories.length === 0) {
    return [];
  }

  const preferredIds = new Set(preferredRepositoryIds ?? []);
  const preferred = repositories
    .map((repository) => repository.path)
    .filter((repositoryId) => preferredIds.has(repositoryId));

  if (preferred.length > 0) {
    return preferred;
  }

  return repositories.map((repository) => repository.path);
}

export function getTopLevelRepositoryIds(repositories: Array<Pick<RepositoryOption, 'path'>>): string[] {
  return repositories
    .filter((repository) => !repositories.some((candidate) => (
      candidate.path !== repository.path && isNestedRepositoryPath(candidate.path, repository.path)
    )))
    .map((repository) => repository.path);
}
