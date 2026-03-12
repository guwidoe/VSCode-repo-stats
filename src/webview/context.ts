import * as vscode from 'vscode';
import type { RepositoryOption } from '../types/index.js';

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

export interface RepositorySelection {
  repositories: RepositoryContext[];
  selected: RepositoryContext | null;
}
