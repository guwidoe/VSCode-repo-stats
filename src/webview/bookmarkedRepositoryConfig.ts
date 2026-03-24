import * as path from 'path';
import * as vscode from 'vscode';

export function getConfiguredBookmarkedRepositories(): string[] {
  return normalizeBookmarkedRepositoryPaths(
    vscode.workspace.getConfiguration('repoStats').get<unknown>('bookmarkedRepositories')
  );
}

export function normalizeBookmarkedRepositoryPaths(configured: unknown): string[] {
  if (!Array.isArray(configured)) {
    return [];
  }

  return configured
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    .map((value) => path.resolve(value.trim()));
}
