import * as path from 'path';
import type { RepositoryOption } from '../types/index.js';

interface WorkspaceRepositoryOptionInput {
  source: 'workspace';
  repoPath: string;
  workspaceFolderPath: string;
  workspaceFolderName: string;
}

interface BookmarkedRepositoryOptionInput {
  source: 'bookmarked';
  repoPath: string;
}

type RepositoryOptionInput = WorkspaceRepositoryOptionInput | BookmarkedRepositoryOptionInput;

function normalizePath(filePath: string): string {
  return filePath.replace(/\\/g, '/');
}

export function getRepositoryRelativePath(repoPath: string, workspaceFolderPath: string): string {
  const relativePath = normalizePath(path.relative(workspaceFolderPath, repoPath));
  return relativePath === '' ? '.' : relativePath;
}

export function buildRepositoryOption(
  input: RepositoryOptionInput
): RepositoryOption {
  if (input.source === 'bookmarked') {
    return {
      path: input.repoPath,
      name: path.basename(input.repoPath),
      source: 'bookmarked',
    };
  }

  return {
    path: input.repoPath,
    name: path.basename(input.repoPath),
    source: 'workspace',
    workspaceFolderName: input.workspaceFolderName,
    relativePath: getRepositoryRelativePath(input.repoPath, input.workspaceFolderPath),
  };
}

export function selectPreferredRepositoryPath(
  repositories: Pick<RepositoryOption, 'path'>[],
  preferredPath?: string
): string | null {
  if (repositories.length === 0) {
    return null;
  }

  if (preferredPath && repositories.some((repository) => repository.path === preferredPath)) {
    return preferredPath;
  }

  return repositories[0]?.path ?? null;
}
