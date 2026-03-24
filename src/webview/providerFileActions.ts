import * as path from 'path';
import * as vscode from 'vscode';
import type { AnalysisTargetContext } from './context.js';
import { resolveContainedPath, validateLogicalPath } from './messageValidation.js';

export interface ProviderFileActionDependencies {
  getSelectedTarget: () => Promise<AnalysisTargetContext | null>;
}

export class ProviderFileActions {
  constructor(private readonly deps: ProviderFileActionDependencies) {}

  async openRepositoryFile(logicalPath: string, repositoryId?: string): Promise<void> {
    const filePath = await this.resolveTargetFilePath(logicalPath, repositoryId);
    if (!filePath) {
      return;
    }

    await vscode.window.showTextDocument(vscode.Uri.file(filePath));
  }

  async revealRepositoryFile(logicalPath: string, repositoryId?: string): Promise<void> {
    const filePath = await this.resolveTargetFilePath(logicalPath, repositoryId);
    if (!filePath) {
      return;
    }

    await vscode.commands.executeCommand('revealInExplorer', vscode.Uri.file(filePath));
  }

  async copyRepositoryPath(logicalPath: string, repositoryId?: string): Promise<void> {
    const filePath = await this.resolveTargetFilePath(logicalPath, repositoryId);
    if (!filePath) {
      return;
    }

    await vscode.env.clipboard.writeText(filePath);
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
