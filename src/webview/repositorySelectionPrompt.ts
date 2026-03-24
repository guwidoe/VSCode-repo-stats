import type { AnalysisTargetSelection } from './context.js';
import { formatRepositoryDiscoveryWarning } from './repositoryService.js';

export interface RepositorySelectionQuickPickItem {
  label: string;
  description: string;
  detail: string;
  picked: boolean;
  repositoryId: string;
}

export function buildRepositorySelectionQuickPickItems(
  selection: AnalysisTargetSelection
): RepositorySelectionQuickPickItem[] {
  const selectedIds = new Set(selection.selectedRepositoryIds);

  return selection.repositories.map((repository) => ({
    label: repository.option.name,
    description: repository.option.workspaceFolderName
      ? `${repository.option.workspaceFolderName} • ${repository.option.relativePath ?? '.'}`
      : 'Bookmarked repository',
    detail: repository.rootUri.fsPath,
    picked: selectedIds.has(repository.option.path),
    repositoryId: repository.option.path,
  }));
}

export function createRepositorySelectionMessage(
  warnings: string[] | AnalysisTargetSelection['repositoryDiscoveryWarnings']
): string {
  const details = warnings
    .map((warning) => typeof warning === 'string' ? warning : formatRepositoryDiscoveryWarning(warning))
    .slice(0, 3);
  const remaining = warnings.length - details.length;

  return remaining > 0
    ? `Repository discovery encountered problems: ${details.join(' | ')} | +${remaining} more`
    : `Repository discovery encountered problems: ${details.join(' | ')}`;
}
