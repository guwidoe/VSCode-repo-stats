import type { WebviewMessage } from '../types';

interface VsCodeApi {
  postMessage: (message: WebviewMessage) => void;
  getState: () => unknown;
  setState: (state: unknown) => void;
}

type VsCodeApiSource = 'vscode' | 'mock';

let vsCodeApi: VsCodeApi | null = null;
let vsCodeApiSource: VsCodeApiSource | null = null;

function createMockVsCodeApi(): VsCodeApi {
  return {
    postMessage: () => {},
    getState: () => ({}),
    setState: () => {},
  };
}

export function resetVsCodeApiForTests(): void {
  vsCodeApi = null;
  vsCodeApiSource = null;
}

export function getOrCreateVsCodeApi(): VsCodeApi {
  const nextSource: VsCodeApiSource = typeof acquireVsCodeApi === 'function' ? 'vscode' : 'mock';
  if (nextSource === 'mock') {
    return createMockVsCodeApi();
  }

  if (vsCodeApi && vsCodeApiSource === nextSource) {
    return vsCodeApi;
  }

  vsCodeApi = acquireVsCodeApi();
  vsCodeApiSource = nextSource;

  return vsCodeApi;
}

export function postVsCodeMessage(message: WebviewMessage): void {
  getOrCreateVsCodeApi().postMessage(message);
}

declare function acquireVsCodeApi(): VsCodeApi;
