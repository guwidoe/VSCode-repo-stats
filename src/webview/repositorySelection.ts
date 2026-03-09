import * as path from 'path';
import type { RepositoryOption } from '../types/index.js';

interface RepositoryOptionInput {
  repoPath: string;
  workspaceFolderPath: string;
  workspaceFolderName: string;
}

function normalizePath(filePath: string): string {
  return filePath.replace(/\\/g, '/');
}

export function getRepositoryRelativePath(repoPath: string, workspaceFolderPath: string): string {
  const relativePath = normalizePath(path.relative(workspaceFolderPath, repoPath));
  return relativePath === '' ? '.' : relativePath;
}

export function buildRepositoryOption({
  repoPath,
  workspaceFolderPath,
  workspaceFolderName,
}: RepositoryOptionInput): RepositoryOption {
  return {
    path: repoPath,
    name: path.basename(repoPath),
    workspaceFolderName,
    relativePath: getRepositoryRelativePath(repoPath, workspaceFolderPath),
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
