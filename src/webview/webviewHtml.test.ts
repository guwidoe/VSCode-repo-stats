import * as fs from 'fs/promises';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('vscode', () => ({
  Uri: {
    joinPath: (...parts: Array<{ fsPath?: string } | string>) => ({
      fsPath: parts.map((part) => typeof part === 'string' ? part : part.fsPath ?? '').join('/'),
    }),
  },
}));

import { getRepoStatsWebviewHtml } from './webviewHtml.js';

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe('getRepoStatsWebviewHtml', () => {
  it('returns fallback html when the built webview is missing', () => {
    const html = getRepoStatsWebviewHtml(
      {
        cspSource: 'vscode-webview:',
        asWebviewUri: ((uri: { fsPath: string }) => ({
          fsPath: `webview:${uri.fsPath}`,
          toString: () => `webview:${uri.fsPath}`,
        })) as never,
      },
      { fsPath: '/missing-extension' } as never
    );

    expect(html).toContain('The webview UI has not been built yet');
  });

  it('rewrites asset urls and injects CSP metadata for built html', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'repo-stats-webview-html-'));
    tempDirs.push(dir);
    const distDir = path.join(dir, 'webview-ui', 'dist', 'assets');
    await fs.mkdir(distDir, { recursive: true });
    await fs.writeFile(
      path.join(dir, 'webview-ui', 'dist', 'index.html'),
      '<html><head></head><body><link rel="stylesheet" crossorigin href="./assets/index.css"><script type="module" crossorigin src="./assets/index.js"></script></body></html>',
      'utf8'
    );

    const html = getRepoStatsWebviewHtml(
      {
        cspSource: 'vscode-webview:',
        asWebviewUri: ((uri: { fsPath: string }) => ({
          fsPath: `webview:${uri.fsPath}`,
          toString: () => `webview:${uri.fsPath}`,
        })) as never,
      },
      { fsPath: dir } as never
    );

    expect(html).toContain('Content-Security-Policy');
    expect(html).toContain('webview:');
    expect(html).toContain('nonce="');
    expect(html).not.toContain('crossorigin href="./assets/index.css"');
    expect(html).not.toContain('crossorigin src="./assets/index.js"');
  });
});
