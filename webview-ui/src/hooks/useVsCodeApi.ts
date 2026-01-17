/**
 * Hook for communicating with the VSCode extension.
 */

import { useCallback, useEffect } from 'react';
import type { WebviewMessage, ExtensionMessage } from '../types';
import { useStore } from '../store';

// ============================================================================
// VSCode API Type
// ============================================================================

interface VsCodeApi {
  postMessage: (message: WebviewMessage) => void;
  getState: () => unknown;
  setState: (state: unknown) => void;
}

// ============================================================================
// Get VSCode API (singleton)
// ============================================================================

let vsCodeApi: VsCodeApi | null = null;

function getVsCodeApi(): VsCodeApi {
  if (vsCodeApi) {return vsCodeApi;}

  // In VSCode webview, acquireVsCodeApi is available globally
  if (typeof acquireVsCodeApi === 'function') {
    vsCodeApi = acquireVsCodeApi();
  } else {
    // Mock for development/testing
    vsCodeApi = {
      postMessage: (message) => console.log('postMessage:', message),
      getState: () => ({}),
      setState: () => {},
    };
  }

  return vsCodeApi;
}

// ============================================================================
// Hook
// ============================================================================

export function useVsCodeApi() {
  const { setData, setError, setLoading } = useStore();

  // Handle messages from extension
  useEffect(() => {
    const handleMessage = (event: MessageEvent<ExtensionMessage>) => {
      const message = event.data;

      switch (message.type) {
        case 'analysisStarted':
          setLoading({ isLoading: true, phase: 'Starting analysis...', progress: 0 });
          break;

        case 'analysisProgress':
          setLoading({
            isLoading: true,
            phase: message.phase,
            progress: message.progress,
          });
          break;

        case 'analysisComplete':
          setData(message.data);
          break;

        case 'analysisError':
          setError(message.error);
          break;

        case 'incrementalUpdate': {
          // Handle incremental updates (merge with existing data)
          const currentData = useStore.getState().data;
          if (currentData && message.data) {
            setData({
              ...currentData,
              ...message.data,
            });
          }
          break;
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [setData, setError, setLoading]);

  // Actions
  const requestAnalysis = useCallback(() => {
    getVsCodeApi().postMessage({ type: 'requestAnalysis' });
  }, []);

  const requestRefresh = useCallback(() => {
    getVsCodeApi().postMessage({ type: 'requestRefresh' });
  }, []);

  const openFile = useCallback((path: string) => {
    getVsCodeApi().postMessage({ type: 'openFile', path });
  }, []);

  const revealInExplorer = useCallback((path: string) => {
    getVsCodeApi().postMessage({ type: 'revealInExplorer', path });
  }, []);

  const copyPath = useCallback((path: string) => {
    getVsCodeApi().postMessage({ type: 'copyPath', path });
  }, []);

  return {
    requestAnalysis,
    requestRefresh,
    openFile,
    revealInExplorer,
    copyPath,
  };
}

// ============================================================================
// Type Declaration for VSCode API
// ============================================================================

declare function acquireVsCodeApi(): VsCodeApi;
