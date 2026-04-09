import * as path from 'path';
import * as vscode from 'vscode';
import type { AnalysisTargetContext } from './context.js';
import { resolveContainedPath, validateLogicalPath } from './messageValidation.js';

export interface ProviderFileActionDependencies {
  getSelectedTarget: () => Promise<AnalysisTargetContext | null>;
}

export interface ProviderFileActionResult {
  ok: boolean;
  reason?: 'invalid-path' | 'unresolved-path';
}

export class ProviderFileActions {
  constructor(private readonly deps: ProviderFileActionDependencies) {}

  async openRepositoryFile(logicalPath: string, repositoryId?: string): Promise<ProviderFileActionResult> {
    const resolution = await this.resolveActionTarget(logicalPath, repositoryId);
    if (!resolution.ok) {
      return resolution;
    }

    await vscode.window.showTextDocument(vscode.Uri.file(resolution.filePath));
    return { ok: true };
  }

  async revealRepositoryFile(logicalPath: string, repositoryId?: string): Promise<ProviderFileActionResult> {
    const resolution = await this.resolveActionTarget(logicalPath, repositoryId);
    if (!resolution.ok) {
      return resolution;
    }

    await vscode.commands.executeCommand('revealInExplorer', vscode.Uri.file(resolution.filePath));
    return { ok: true };
  }

  async copyRepositoryPath(logicalPath: string, repositoryId?: string): Promise<ProviderFileActionResult> {
    const resolution = await this.resolveActionTarget(logicalPath, repositoryId);
    if (!resolution.ok) {
      return resolution;
    }

    await vscode.env.clipboard.writeText(resolution.filePath);
    return { ok: true };
  }

  private async resolveActionTarget(
    logicalPath: string,
    repositoryId?: string
  ): Promise<{ ok: true; filePath: string } | { ok: false; reason: 'invalid-path' | 'unresolved-path' }> {
    try {
      const filePath = await this.resolveTargetFilePath(logicalPath, repositoryId);
      if (!filePath) {
        return { ok: false, reason: 'unresolved-path' };
      }

      return { ok: true, filePath };
    } catch (error) {
      if (isLogicalPathValidationError(error)) {
        return { ok: false, reason: 'invalid-path' };
      }

      throw error;
    }
  }

  async resolveTargetFilePath(logicalPath: string, repositoryId?: string): Promise<string | undefined> {
    validateLogicalPath(logicalPath);

    const analysisTarget = await this.deps.getSelectedTarget();
    if (!analysisTarget) {
      return undefined;
    }

    const matchingMember = repositoryId
      ? analysisTarget.target.members.find((member) => member.id === repositoryId)
      : [...analysisTarget.target.members]
        .sort((a, b) => b.pathPrefix.length - a.pathPrefix.length)
        .find((member) => {
          if (!member.pathPrefix) {
            return true;
          }

          return logicalPath === member.pathPrefix || logicalPath.startsWith(`${member.pathPrefix}/`);
        });

    if (!matchingMember) {
      return undefined;
    }

    const relativePath = matchingMember.pathPrefix && logicalPath.startsWith(`${matchingMember.pathPrefix}/`)
      ? logicalPath.slice(matchingMember.pathPrefix.length + 1)
      : matchingMember.pathPrefix === logicalPath
        ? ''
        : logicalPath;

    return resolveContainedPath(matchingMember.repoPath, relativePath, path);
  }
}

function isLogicalPathValidationError(error: unknown): error is Error {
  return error instanceof Error
    && (error.message.startsWith('Repo Stats rejected ') || error.message.startsWith('Repo Stats received '));
}
