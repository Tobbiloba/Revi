import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/__tests__/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/__tests__/',
        '**/*.d.ts',
        '**/*.config.*',
        'dist/'
      ]
    },
    // Add timeout for long-running resilience tests
    testTimeout: 30000,
    // Allow tests to run longer for benchmarks
    hookTimeout: 60000
  },
  resolve: {
    alias: {
      '@': '/src'
    }
  }
});