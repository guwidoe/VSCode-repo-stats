import * as vscode from 'vscode';
import type {
  AnalysisTarget,
  AnalysisTargetOption,
  RepositoryOption,
} from '../types/index.js';

export interface GitRepositoryHandle {
  rootUri: vscode.Uri;
}

export interface GitApi {
  repositories: GitRepositoryHandle[];
}

export interface GitExtensionExports {
  getAPI(version: number): GitApi;
}

export interface RepositoryContext {
  option: RepositoryOption;
  rootUri: vscode.Uri;
  workspaceFolder?: vscode.WorkspaceFolder;
}

export interface AnalysisTargetContext {
  option: AnalysisTargetOption;
  target: AnalysisTarget;
  settingsRepository?: RepositoryContext;
}

export interface RepositorySelection {
  repositories: RepositoryContext[];
  selected: RepositoryContext | null;
}

export interface AnalysisTargetSelection {
  targets: AnalysisTargetContext[];
  selected: AnalysisTargetContext | null;
}
