import * as fs from 'fs/promises';
import * as vscode from 'vscode';
import type { AnalysisTargetSelection, RepositoryContext } from './context.js';
import type { RepositorySettingsService } from './settingsService.js';
import {
  getWorkspaceFileExcludePatterns,
  isNestedRepositoryDiscoveryEnabled,
} from './workspaceRepositoryScanner.js';

interface InotifyWatchCount {
  supported: boolean;
  count?: number;
  error?: string;
}

export class RepoStatsDiagnosticsService {
  private outputChannel: vscode.OutputChannel | undefined;

  constructor(
    private readonly settingsService: RepositorySettingsService
  ) {}

  async show(selection: AnalysisTargetSelection): Promise<void> {
    const report = await this.buildReport(selection);
    const outputChannel = this.getOutputChannel();
    outputChannel.clear();
    outputChannel.append(report);
    outputChannel.show(true);
  }

  private getOutputChannel(): vscode.OutputChannel {
    this.outputChannel ??= vscode.window.createOutputChannel('Repo Stats Diagnostics');
    return this.outputChannel;
  }

  private async buildReport(selection: AnalysisTargetSelection): Promise<string> {
    const workspaceFolders = vscode.workspace.workspaceFolders ?? [];
    const selectedTarget = selection.selectedTarget;
    const settings = this.settingsService.getSettings(selectedTarget?.settingsRepository);
    const packageActivationEvents = this.getPackageActivationEvents();
    const inotify = await countCurrentProcessInotifyWatches();

    return [
      '# Repo Stats Diagnostics',
      '',
      `Generated: ${new Date().toISOString()}`,
      '',
      '## Activation',
      '',
      '- Eager startup activation: disabled',
      '- Git-workspace activation (`workspaceContains:.git`): disabled',
      '- Expected activation path: Repo Stats commands only',
      `- Package activation events: ${formatListInline(packageActivationEvents)}`,
      '',
      '## Workspace discovery',
      '',
      `- Workspace folders: ${workspaceFolders.length}`,
      ...workspaceFolders.map((folder) => `  - ${folder.name}: ${folder.uri.fsPath}`),
      `- Nested repository scan: ${isNestedRepositoryDiscoveryEnabled() ? 'enabled' : 'disabled'}`,
      '- Nested scan implementation: VS Code file search only when explicitly enabled',
      '- Built-in Git extension activation during discovery: disabled',
      '',
      '## Discovery exclude patterns',
      '',
      ...this.formatDiscoveryExcludePatterns(workspaceFolders),
      '',
      '## Repositories',
      '',
      `- Available repositories: ${selection.repositories.length}`,
      ...selection.repositories.map((repository) => this.formatRepository(repository)),
      `- Selected repository IDs: ${formatListInline(selection.selectedRepositoryIds)}`,
      `- Selected target: ${selectedTarget?.target.label ?? '<none>'}`,
      '',
      '## Effective Repo Stats analysis excludes',
      '',
      ...formatList(settings.excludePatterns),
      '',
      '## Extension host inotify watches',
      '',
      '- Repo Stats file watchers: none',
      ...formatInotify(inotify),
      '',
      'Notes:',
      '- The inotify number is for the current VS Code extension host process, not solely Repo Stats.',
      '- Repo Stats does not create long-lived file watchers; diagnostics expose the process count to help verify that Repo Stats activation is not inflating it.',
      '',
    ].join('\n');
  }

  private getPackageActivationEvents(): string[] {
    const extension = vscode.extensions.getExtension('guwidoe.vscode-repo-stats');
    const activationEvents = extension?.packageJSON?.activationEvents;
    return Array.isArray(activationEvents)
      ? activationEvents.filter((event): event is string => typeof event === 'string')
      : [];
  }

  private formatDiscoveryExcludePatterns(
    workspaceFolders: readonly vscode.WorkspaceFolder[]
  ): string[] {
    if (workspaceFolders.length === 0) {
      return ['- <no workspace folders>'];
    }

    return workspaceFolders.flatMap((folder) => [
      `- ${folder.name}:`,
      ...formatList(getWorkspaceFileExcludePatterns(folder), '  '),
    ]);
  }

  private formatRepository(repository: RepositoryContext): string {
    const source = repository.option.source;
    const workspaceFolder = repository.workspaceFolder?.name ?? '<outside workspace>';
    return `  - ${repository.option.name} (${source}, workspace: ${workspaceFolder}): ${repository.rootUri.fsPath}`;
  }
}

async function countCurrentProcessInotifyWatches(): Promise<InotifyWatchCount> {
  if (process.platform !== 'linux') {
    return { supported: false };
  }

  try {
    const fdInfoDirectory = '/proc/self/fdinfo';
    const entries = await fs.readdir(fdInfoDirectory);
    let count = 0;

    for (const entry of entries) {
      const content = await fs.readFile(`${fdInfoDirectory}/${entry}`, 'utf8').catch((error: unknown) => {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
          return '';
        }
        throw error;
      });
      count += content.match(/^inotify wd:/gm)?.length ?? 0;
    }

    return { supported: true, count };
  } catch (error) {
    return {
      supported: true,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function formatListInline(values: readonly string[]): string {
  if (values.length === 0) {
    return '<none>';
  }

  return values.map((value) => `\`${value}\``).join(', ');
}

function formatList(values: readonly string[], indent = ''): string[] {
  if (values.length === 0) {
    return [`${indent}- <none>`];
  }

  return values.map((value) => `${indent}- \`${value}\``);
}

function formatInotify(inotify: InotifyWatchCount): string[] {
  if (!inotify.supported) {
    return ['- Not available on this platform.'];
  }

  if (inotify.error) {
    return [`- Unable to read /proc/self/fdinfo: ${inotify.error}`];
  }

  return [
    `- Platform: ${process.platform}`,
    `- Extension host PID: ${process.pid}`,
    `- Current process inotify watches: ${inotify.count ?? 0}`,
  ];
}
