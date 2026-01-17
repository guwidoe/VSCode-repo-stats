import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./webview-ui/test/setup.ts'],
    include: ['webview-ui/**/*.test.{ts,tsx}', 'src/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/out/**', 'test/extension/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts', 'webview-ui/src/**/*.{ts,tsx}'],
      exclude: [
        '**/*.test.{ts,tsx}',
        '**/test/**',
        '**/types/**',
        '**/*.d.ts',
      ],
      thresholds: {
        statements: 70,
        branches: 60,
        functions: 70,
        lines: 70,
      },
    },
  },
});
