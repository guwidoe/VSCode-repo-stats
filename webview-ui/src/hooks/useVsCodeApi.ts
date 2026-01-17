interface VsCodeApi {
  postMessage: (message: unknown) => void;
  getState: () => unknown;
  setState: (state: unknown) => void;
}

// Declare the VSCode API function that's injected by the webview
declare function acquireVsCodeApi(): VsCodeApi;

// Cache the API instance
let vscodeApi: VsCodeApi | null = null;

/**
 * Hook to access the VSCode webview API
 * Returns a singleton instance of the API
 */
export function useVsCodeApi(): VsCodeApi {
  if (!vscodeApi) {
    try {
      vscodeApi = acquireVsCodeApi();
    } catch {
      // Fallback for development/testing outside VSCode
      console.warn('VSCode API not available, using mock');
      vscodeApi = {
        postMessage: (message) => console.log('postMessage:', message),
        getState: () => ({}),
        setState: (state) => console.log('setState:', state),
      };
    }
  }
  return vscodeApi;
}
