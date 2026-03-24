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
      await runProviderCommand('show dashboard', () => provider?.showDashboard());
    }
  );

  // Register the refresh command
  const refreshCommand = vscode.commands.registerCommand(
    'repoStats.refreshStats',
    async () => {
      await runProviderCommand('refresh stats', () => provider?.refresh());
    }
  );

  const selectRepositoryCommand = vscode.commands.registerCommand(
    'repoStats.selectRepository',
    async () => {
      await runProviderCommand('select repositories', () => provider?.promptRepositorySelection());
    }
  );

  const addRepositoryCommand = vscode.commands.registerCommand(
    'repoStats.addRepository',
    async () => {
      await runProviderCommand('add repository', () => provider?.addRepository());
    }
  );

  // Add commands to subscriptions for cleanup
  context.subscriptions.push(showDashboardCommand);
  context.subscriptions.push(refreshCommand);
  context.subscriptions.push(selectRepositoryCommand);
  context.subscriptions.push(addRepositoryCommand);

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
}

export function deactivate(): void {
  provider = undefined;
}

async function runProviderCommand(
  action: string,
  command: () => Promise<void> | undefined
): Promise<void> {
  if (!provider) {
    const message = 'Repo Stats did not finish activating. Check the Extension Host log for details.';
    console.error(`[RepoStats] Cannot ${action}: provider is unavailable`);
    vscode.window.showErrorMessage(message);
    return;
  }

  try {
    await command();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[RepoStats] Failed to ${action}:`, error);
    vscode.window.showErrorMessage(`Repo Stats failed to ${action}: ${message}`);
  }
}
