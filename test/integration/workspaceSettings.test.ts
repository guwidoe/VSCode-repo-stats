import * as assert from 'assert';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as vscode from 'vscode';

suite('Workspace-folder settings persistence', () => {
  test('writes repo-scoped settings into .vscode/settings.json', async () => {
    const extension = vscode.extensions.getExtension('guwidoe.vscode-repo-stats');
    assert.ok(extension, 'Extension should be available in the test host');
    await extension.activate();

    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    assert.ok(workspaceFolder, 'Expected a workspace folder for integration tests');

    const workspaceUri = workspaceFolder.uri;
    const config = vscode.workspace.getConfiguration('repoStats', workspaceUri);
    const settingsDir = path.join(workspaceUri.fsPath, '.vscode');
    const settingsPath = path.join(settingsDir, 'settings.json');

    const previousSettingsFile = await fs.readFile(settingsPath, 'utf8').catch(() => undefined);
    const previousMaxCommits = config.inspect<number>('maxCommitsToAnalyze')?.workspaceFolderValue;
    const previousMaxSeries = config.inspect<number>('evolution.maxSeries')?.workspaceFolderValue;

    try {
      await config.update('maxCommitsToAnalyze', 4321, vscode.ConfigurationTarget.WorkspaceFolder);
      await config.update('evolution.maxSeries', 17, vscode.ConfigurationTarget.WorkspaceFolder);

      const settingsFile = await fs.readFile(settingsPath, 'utf8');
      const parsed = JSON.parse(settingsFile) as Record<string, unknown>;

      assert.strictEqual(parsed['repoStats.maxCommitsToAnalyze'], 4321);
      assert.strictEqual(parsed['repoStats.evolution.maxSeries'], 17);
      assert.strictEqual(config.inspect<number>('maxCommitsToAnalyze')?.workspaceFolderValue, 4321);
      assert.strictEqual(config.inspect<number>('evolution.maxSeries')?.workspaceFolderValue, 17);
    } finally {
      await config.update(
        'maxCommitsToAnalyze',
        previousMaxCommits,
        vscode.ConfigurationTarget.WorkspaceFolder
      );
      await config.update(
        'evolution.maxSeries',
        previousMaxSeries,
        vscode.ConfigurationTarget.WorkspaceFolder
      );

      if (previousSettingsFile !== undefined) {
        await fs.mkdir(settingsDir, { recursive: true });
        await fs.writeFile(settingsPath, previousSettingsFile, 'utf8');
      } else {
        await fs.rm(settingsPath, { force: true });
        await fs.rmdir(settingsDir).catch(() => undefined);
      }
    }
  });
});
