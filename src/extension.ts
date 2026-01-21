/**
 * Extension Entry Point - Activates the Repo Stats extension.
 * This is a thin integration layer that wires everything together.
 */

import * as vscode from 'vscode';
import { RepoStatsProvider } from './webview/provider.js';

let provider: RepoStatsProvider | undefined;

export function activate(context: vscode.ExtensionContext): void {
  // Create the webview provider with globalStorageUri for scc binary storage
  provider = new RepoStatsProvider(
    context.extensionUri,
    context.workspaceState,
    context.globalStorageUri.fsPath
  );

  // Register the show dashboard command
  const showDashboardCommand = vscode.commands.registerCommand(
    'repoStats.showDashboard',
    async () => {
      await provider?.showDashboard();
    }
  );

  // Register the refresh command
  const refreshCommand = vscode.commands.registerCommand(
    'repoStats.refreshStats',
    async () => {
      await provider?.refresh();
    }
  );

  // Add commands to subscriptions for cleanup
  context.subscriptions.push(showDashboardCommand);
  context.subscriptions.push(refreshCommand);

  // Create status bar button for quick access to dashboard
  const statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    100
  );
  statusBarItem.command = 'repoStats.showDashboard';
  statusBarItem.text = '$(graph) Repo Stats';
  statusBarItem.tooltip = 'Open Repo Stats Dashboard';
  statusBarItem.show();
  context.subscriptions.push(statusBarItem);

  // Log activation
  console.log('Repo Stats extension activated');
}

export function deactivate(): void {
  provider = undefined;
  console.log('Repo Stats extension deactivated');
}
