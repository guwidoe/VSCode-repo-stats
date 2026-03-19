import * as path from 'path';
import simpleGit from 'simple-git';
import {
  buildRepositoryWithSubmodulesTarget,
  buildSingleRepositoryTarget,
  buildWorkspaceTarget,
  selectPreferredTargetId,
  toAnalysisTargetOption,
} from './analysisTargetSelection.js';
import type {
  AnalysisTargetContext,
  AnalysisTargetSelection,
  RepositoryContext,
} from './context.js';
import { RepositoryService } from './repositoryService.js';

export class AnalysisTargetService {
  private static readonly selectedTargetIdStateKey = 'repoStats.selectedTargetId';

  constructor(
    private readonly workspaceState: { get<T>(key: string): T | undefined; update(key: string, value: unknown): Thenable<void> },
    private readonly repositoryService: RepositoryService
  ) {}

  async getSelectedTarget(): Promise<AnalysisTargetContext | undefined> {
    const selection = await this.resolveSelection();
    return selection.selected ?? undefined;
  }

  async resolveSelection(preferredTargetId?: string): Promise<AnalysisTargetSelection> {
    const repositories = await this.repositoryService.listAvailableRepositories();
    const targets = await this.buildTargets(repositories);
    const persistedTargetId = preferredTargetId ?? this.workspaceState.get<string>(AnalysisTargetService.selectedTargetIdStateKey);
    const selectedTargetId = selectPreferredTargetId(
      targets.map((target) => target.target),
      persistedTargetId
    );

    await this.persistSelectedTargetId(selectedTargetId);

    return {
      targets,
      selected: targets.find((target) => target.target.id === selectedTargetId) ?? null,
    };
  }

  async persistSelectedTargetId(targetId: string | null): Promise<void> {
    await this.workspaceState.update(AnalysisTargetService.selectedTargetIdStateKey, targetId ?? undefined);
  }

  private async buildTargets(repositories: RepositoryContext[]): Promise<AnalysisTargetContext[]> {
    const targets: AnalysisTargetContext[] = [];

    for (const repository of repositories) {
      const singleTarget = buildSingleRepositoryTarget({
        option: repository.option,
        rootPath: repository.rootUri.fsPath,
      });
      targets.push({
        option: toAnalysisTargetOption(singleTarget),
        target: singleTarget,
        settingsRepository: repository,
      });

      const submodulePaths = await this.getValidSubmodulePaths(repository.rootUri.fsPath);
      if (submodulePaths.length > 0) {
        const submoduleTarget = buildRepositoryWithSubmodulesTarget({
          repository: {
            option: repository.option,
            rootPath: repository.rootUri.fsPath,
          },
          submodulePaths,
        });
        targets.push({
          option: toAnalysisTargetOption(submoduleTarget),
          target: submoduleTarget,
          settingsRepository: repository,
        });
      }
    }

    if (repositories.length > 1) {
      const workspaceTarget = buildWorkspaceTarget(
        repositories.map((repository) => ({
          option: repository.option,
          rootPath: repository.rootUri.fsPath,
        }))
      );
      targets.push({
        option: toAnalysisTargetOption(workspaceTarget),
        target: workspaceTarget,
      });
    }

    return targets.sort((a, b) => {
      const kindOrder = this.getTargetKindOrder(a.target.kind) - this.getTargetKindOrder(b.target.kind);
      if (kindOrder !== 0) {
        return kindOrder;
      }

      return a.option.label.localeCompare(b.option.label) || a.option.id.localeCompare(b.option.id);
    });
  }

  private getTargetKindOrder(kind: AnalysisTargetContext['target']['kind']): number {
    switch (kind) {
      case 'repository':
        return 0;
      case 'repositoryWithSubmodules':
        return 1;
      case 'workspace':
        return 2;
    }
  }

  private async getValidSubmodulePaths(repoPath: string): Promise<string[]> {
    const git = simpleGit(repoPath);
    const output = await git.raw(['submodule', 'status', '--recursive']).catch(() => '');
    const paths: string[] = [];

    for (const line of output.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed) {
        continue;
      }

      const match = trimmed.match(/^[+-]?\s*[a-f0-9]+\s+(\S+)/);
      if (!match) {
        continue;
      }

      const submoduleRootPath = path.join(repoPath, match[1]);
      const submoduleGit = simpleGit(submoduleRootPath);
      if (await submoduleGit.checkIsRepo().catch(() => false)) {
        paths.push(match[1].replace(/\\/g, '/'));
      }
    }

    return Array.from(new Set(paths)).sort((a, b) => a.localeCompare(b));
  }
}
