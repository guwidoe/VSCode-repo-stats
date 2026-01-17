import * as vscode from 'vscode';
import { RepoStatsProvider } from './webview/provider';
import { AnalysisCoordinator } from './analyzers/coordinator';

let coordinator: AnalysisCoordinator | undefined;

export function activate(context: vscode.ExtensionContext): void {
  console.log('Repo Stats extension is now active');

  // Create the webview provider
  const provider = new RepoStatsProvider(context.extensionUri, context);

  // Register the webview provider
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      RepoStatsProvider.viewType,
      provider
    )
  );

  // Register commands
  context.subscriptions.push(
    vscode.commands.registerCommand('repoStats.showDashboard', async () => {
      // Create a webview panel for the dashboard
      const panel = vscode.window.createWebviewPanel(
        'repoStatsDashboard',
        'Repo Stats Dashboard',
        vscode.ViewColumn.One,
        {
          enableScripts: true,
          retainContextWhenHidden: true,
          localResourceRoots: [
            vscode.Uri.joinPath(context.extensionUri, 'out'),
            vscode.Uri.joinPath(context.extensionUri, 'webview-ui', 'dist'),
          ],
        }
      );

      // Get the workspace folder
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) {
        vscode.window.showErrorMessage('Please open a folder to view repository statistics.');
        return;
      }

      // Initialize coordinator if needed
      if (!coordinator) {
        coordinator = new AnalysisCoordinator(workspaceFolder.uri.fsPath, context);
      }

      // Set up the webview content
      panel.webview.html = provider.getHtmlForWebview(panel.webview);

      // Handle messages from the webview
      panel.webview.onDidReceiveMessage(
        async (message) => {
          switch (message.type) {
            case 'requestData':
              try {
                const data = await coordinator?.analyze();
                panel.webview.postMessage({
                  type: 'dataUpdate',
                  payload: data,
                });
              } catch (error) {
                panel.webview.postMessage({
                  type: 'error',
                  payload: error instanceof Error ? error.message : 'Unknown error',
                });
              }
              break;

            case 'openFile':
              if (message.payload?.path) {
                const fileUri = vscode.Uri.file(message.payload.path);
                vscode.window.showTextDocument(fileUri);
              }
              break;
          }
        },
        undefined,
        context.subscriptions
      );

      // Initial data load
      try {
        panel.webview.postMessage({ type: 'loading', payload: true });
        const data = await coordinator.analyze();
        panel.webview.postMessage({
          type: 'dataUpdate',
          payload: data,
        });
      } catch (error) {
        panel.webview.postMessage({
          type: 'error',
          payload: error instanceof Error ? error.message : 'Unknown error',
        });
      } finally {
        panel.webview.postMessage({ type: 'loading', payload: false });
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('repoStats.refreshStats', async () => {
      if (coordinator) {
        await coordinator.invalidateCache();
        vscode.window.showInformationMessage('Repo Stats cache cleared. Refresh the dashboard to see updated data.');
      }
    })
  );
}

export function deactivate(): void {
  coordinator = undefined;
}
