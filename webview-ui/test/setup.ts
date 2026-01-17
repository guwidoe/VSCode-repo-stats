import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

// Cleanup after each test
afterEach(() => {
  cleanup();
});

// Mock VSCode webview API
const mockVsCode = {
  postMessage: vi.fn(),
  getState: vi.fn(() => ({})),
  setState: vi.fn(),
};

(globalThis as unknown as { acquireVsCodeApi: () => typeof mockVsCode }).acquireVsCodeApi = () => mockVsCode;

// Export for use in tests
export { mockVsCode };

// Mock ResizeObserver
globalThis.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock canvas context
HTMLCanvasElement.prototype.getContext = vi.fn().mockImplementation(() => ({
  fillStyle: '',
  strokeStyle: '',
  lineWidth: 1,
  font: '',
  textBaseline: '',
  fillRect: vi.fn(),
  strokeRect: vi.fn(),
  clearRect: vi.fn(),
  fillText: vi.fn(),
  measureText: vi.fn(() => ({ width: 50 })),
}));
