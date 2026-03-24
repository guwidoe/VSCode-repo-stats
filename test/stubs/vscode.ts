export const window = {};
export const workspace = {};
export const commands = {};
export const env = {};
export const Uri = {
  file: (fsPath: string) => ({ fsPath }),
  joinPath: (...parts: Array<{ fsPath?: string } | string>) => ({
    fsPath: parts.map((part) => typeof part === 'string' ? part : part.fsPath ?? '').join('/'),
  }),
};
export const ConfigurationTarget = {
  Global: 'global',
  WorkspaceFolder: 'workspaceFolder',
};
export const ViewColumn = { One: 1 };
export const StatusBarAlignment = { Right: 1 };
