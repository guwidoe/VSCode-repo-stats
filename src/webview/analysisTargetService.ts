import {
  buildTargetForSelectedRepositories,
  selectPreferredRepositoryIds,
  toAnalysisTargetOption,
} from './analysisTargetSelection.js';
import type {
  AnalysisTargetContext,
  AnalysisTargetSelection,
  RepositoryContext,
} from './context.js';
import { RepositoryService } from './repositoryService.js';

export class AnalysisTargetService {
  private static readonly selectedRepositoryIdsStateKey = 'repoStats.selectedRepositoryIds';

  private readonly selectionStateKey = AnalysisTargetService.selectedRepositoryIdsStateKey;

  constructor(
    private readonly workspaceState: { get<T>(key: string): T | undefined; update(key: string, value: unknown): Thenable<void> },
    private readonly repositoryService: RepositoryService
  ) {}

  async getSelectedTarget(): Promise<AnalysisTargetContext | null> {
    const selection = await this.resolveSelection(undefined, { persist: false });
    return selection.selectedTarget;
  }

  async resolveSelection(
    preferredRepositoryIds?: string[],
    options: { persist?: boolean } = {}
  ): Promise<AnalysisTargetSelection> {
    const repositories = await this.repositoryService.listAvailableRepositories();
    const persistedRepositoryIds = preferredRepositoryIds
      ?? this.workspaceState.get<string[]>(this.selectionStateKey);
    const selectedRepositoryIds = selectPreferredRepositoryIds(
      repositories.map((repository) => repository.option),
      persistedRepositoryIds
    );
    const selectedRepositories = this.getSelectedRepositories(repositories, selectedRepositoryIds);
    const selectedTarget = this.buildSelectedTarget(selectedRepositories);

    if (options.persist ?? true) {
      await this.persistSelectedRepositoryIds(selectedRepositoryIds);
    }

    return {
      repositories,
      selectedRepositoryIds,
      selectedTarget,
      selectedTargetOption: selectedTarget ? toAnalysisTargetOption(selectedTarget.target) : null,
    };
  }

  async persistSelectedRepositoryIds(repositoryIds: string[]): Promise<void> {
    await this.workspaceState.update(
      this.selectionStateKey,
      repositoryIds.length > 0 ? repositoryIds : undefined
    );
  }

  private getSelectedRepositories(
    repositories: RepositoryContext[],
    selectedRepositoryIds: string[]
  ): RepositoryContext[] {
    const selectedIds = new Set(selectedRepositoryIds);
    return repositories.filter((repository) => selectedIds.has(repository.option.path));
  }

  private buildSelectedTarget(selectedRepositories: RepositoryContext[]): AnalysisTargetContext | null {
    const target = buildTargetForSelectedRepositories(
      selectedRepositories.map((repository) => ({
        option: repository.option,
        rootPath: repository.rootUri.fsPath,
      }))
    );

    if (!target) {
      return null;
    }

    return {
      option: toAnalysisTargetOption(target),
      target,
      settingsRepository: selectedRepositories.length === 1 ? selectedRepositories[0] : undefined,
    };
  }
}
