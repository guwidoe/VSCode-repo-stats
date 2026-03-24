import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

export function getRepoStatsWebviewHtml(
  webview: Pick<vscode.Webview, 'asWebviewUri' | 'cspSource'>,
  extensionUri: vscode.Uri
): string {
  const distPath = vscode.Uri.joinPath(extensionUri, 'webview-ui', 'dist');
  const distFsPath = distPath.fsPath;
  const indexPath = path.join(distFsPath, 'index.html');

  if (!fs.existsSync(indexPath)) {
    return createMissingBuildHtml();
  }

  let html = fs.readFileSync(indexPath, 'utf-8');

  const scriptUri = webview.asWebviewUri(
    vscode.Uri.joinPath(distPath, 'assets', 'index.js')
  );
  const styleUri = webview.asWebviewUri(
    vscode.Uri.joinPath(distPath, 'assets', 'index.css')
  );

  html = html.replace(
    /<link rel="stylesheet" crossorigin href="[./]*assets\/index\.css">/g,
    `<link rel="stylesheet" href="${styleUri}">`
  );
  html = html.replace(
    /<script type="module" crossorigin src="[./]*assets\/index\.js"><\/script>/g,
    `<script type="module" src="${scriptUri}"></script>`
  );

  const nonce = getNonce();
  const csp = `
    default-src 'none';
    style-src ${webview.cspSource} 'unsafe-inline';
    script-src 'nonce-${nonce}' ${webview.cspSource};
    img-src ${webview.cspSource} data:;
    font-src ${webview.cspSource};
  `.replace(/\s+/g, ' ').trim();

  html = html.replace(
    '<head>',
    `<head>\n    <meta http-equiv="Content-Security-Policy" content="${csp}">`
  );
  html = html.replace(
    /<script/g,
    `<script nonce="${nonce}"`
  );

  return html;
}

function createMissingBuildHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Repo Stats</title>
  <style>
    body {
      font-family: var(--vscode-font-family);
      padding: 20px;
      color: var(--vscode-foreground);
      background: var(--vscode-editor-background);
    }
    .error {
      color: var(--vscode-errorForeground);
    }
  </style>
</head>
<body>
  <h1>Repo Stats</h1>
  <p class="error">The webview UI has not been built yet. Run <code>npm run compile:webview</code> to build it.</p>
</body>
</html>`;
}

function getNonce(): string {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let index = 0; index < 32; index += 1) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
