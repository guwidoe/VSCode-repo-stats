import * as path from 'path';
import type {
  AnalysisTarget,
  AnalysisTargetMember,
  AnalysisTargetOption,
  RepositoryOption,
} from '../types/index.js';

function normalizePath(filePath: string): string {
  return filePath.replace(/\\/g, '/');
}

function buildRepositoryTargetId(repoPath: string): string {
  return `repo:${normalizePath(repoPath)}`;
}

function buildRepositoryWithSubmodulesTargetId(repoPath: string): string {
  return `repo+submodules:${normalizePath(repoPath)}`;
}

function buildWorkspaceTargetId(repoPaths: string[]): string {
  return `workspace:${repoPaths.map(normalizePath).sort((a, b) => a.localeCompare(b)).join('|')}`;
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

export function buildSingleRepositoryTarget(repository: {
  option: RepositoryOption;
  rootPath: string;
}): AnalysisTarget {
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

export function buildRepositoryWithSubmodulesTarget(input: {
  repository: {
    option: RepositoryOption;
    rootPath: string;
  };
  submodulePaths: string[];
}): AnalysisTarget {
  const { repository, submodulePaths } = input;
  const sortedSubmodulePaths = [...submodulePaths].sort((a, b) => a.localeCompare(b));
  const members: AnalysisTargetMember[] = [
    {
      id: repository.option.path,
      role: 'primary',
      repoPath: repository.rootPath,
      displayName: repository.option.name,
      logicalRoot: repository.option.name,
      pathPrefix: '',
      workspaceFolderName: repository.option.workspaceFolderName,
      excludePatterns: sortedSubmodulePaths,
    },
    ...sortedSubmodulePaths.map((submodulePath) => ({
      id: normalizePath(path.join(repository.rootPath, submodulePath)),
      role: 'submodule' as const,
      repoPath: path.join(repository.rootPath, submodulePath),
      displayName: path.basename(submodulePath),
      logicalRoot: submodulePath,
      pathPrefix: normalizePath(submodulePath),
      workspaceFolderName: repository.option.workspaceFolderName,
    })),
  ];

  return {
    id: buildRepositoryWithSubmodulesTargetId(repository.option.path),
    kind: 'repositoryWithSubmodules',
    label: `${repository.option.name} + submodules`,
    description: `${sortedSubmodulePaths.length} submodule${sortedSubmodulePaths.length === 1 ? '' : 's'}`,
    settingsScope: 'repo',
    settingsPath: repository.rootPath,
    members,
  };
}

export function buildWorkspaceTarget(repositories: Array<{
  option: RepositoryOption;
  rootPath: string;
}>): AnalysisTarget {
  const prefixes = ensureUniquePrefixes(
    repositories.map((repository) => buildWorkspaceMemberPrefix(repository.option))
  );

  return {
    id: buildWorkspaceTargetId(repositories.map((repository) => repository.rootPath)),
    kind: 'workspace',
    label: 'Workspace repositories',
    description: `${repositories.length} repositories`,
    settingsScope: 'workspace',
    members: repositories.map((repository, index) => ({
      id: repository.option.path,
      role: 'workspaceRepo',
      repoPath: repository.rootPath,
      displayName: repository.option.name,
      logicalRoot: prefixes[index],
      pathPrefix: prefixes[index],
      workspaceFolderName: repository.option.workspaceFolderName,
    })),
  };
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

export function selectPreferredTargetId(
  targets: Pick<AnalysisTarget, 'id'>[],
  preferredTargetId?: string
): string | null {
  if (targets.length === 0) {
    return null;
  }

  if (preferredTargetId && targets.some((target) => target.id === preferredTargetId)) {
    return preferredTargetId;
  }

  return targets[0]?.id ?? null;
}
