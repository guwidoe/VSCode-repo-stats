import type { WebviewMessage } from '../types';

interface VscodeApi {
  postMessage: (message: WebviewMessage) => void;
  getState: () => unknown;
  setState: (state: unknown) => void;
}

type VscodeApiSource = 'vscode' | 'mock';

let vscodeApi: VscodeApi | null = null;
let vscodeApiSource: VscodeApiSource | null = null;

function createMockVscodeApi(): VscodeApi {
  return {
    postMessage: () => {},
    getState: () => ({}),
    setState: () => {},
  };
}

export function resetVscodeApiForTests(): void {
  vscodeApi = null;
  vscodeApiSource = null;
}

export function getOrCreateVscodeApi(): VscodeApi {
  const nextSource: VscodeApiSource = typeof acquireVsCodeApi === 'function' ? 'vscode' : 'mock';
  if (nextSource === 'mock') {
    return createMockVscodeApi();
  }

  if (vscodeApi && vscodeApiSource === nextSource) {
    return vscodeApi;
  }

  vscodeApi = acquireVsCodeApi();
  vscodeApiSource = nextSource;

  return vscodeApi;
}

export function postVscodeMessage(message: WebviewMessage): void {
  getOrCreateVscodeApi().postMessage(message);
}

declare function acquireVsCodeApi(): VscodeApi;
