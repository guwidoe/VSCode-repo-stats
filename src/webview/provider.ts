import * as vscode from 'vscode';

/**
 * Provides the webview content for the Repo Stats panel
 */
export class RepoStatsProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'repoStats.statsView';

  constructor(
    private readonly extensionUri: vscode.Uri,
    _context: vscode.ExtensionContext
  ) {}

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): void {
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this.extensionUri, 'out'),
        vscode.Uri.joinPath(this.extensionUri, 'webview-ui', 'dist'),
      ],
    };

    webviewView.webview.html = this.getHtmlForWebview(webviewView.webview);
  }

  /**
   * Generate the HTML content for the webview
   */
  getHtmlForWebview(webview: vscode.Webview): string {
    // Get URIs for the webview assets
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'webview-ui', 'dist', 'assets', 'index.js')
    );
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'webview-ui', 'dist', 'assets', 'index.css')
    );

    // Use a nonce for content security policy
    const nonce = this.getNonce();

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}'; img-src ${webview.cspSource} https: data:; font-src ${webview.cspSource};">
  <link rel="stylesheet" type="text/css" href="${styleUri}">
  <title>Repo Stats</title>
</head>
<body>
  <div id="root"></div>
  <script nonce="${nonce}" type="module" src="${scriptUri}"></script>
</body>
</html>`;
  }

  /**
   * Generate a random nonce for CSP
   */
  private getNonce(): string {
    let text = '';
    const possible =
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
      text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
  }
}
