import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['packages/*/src/**/*.test.ts', 'apps/web/src/**/*.test.{ts,tsx}', 'tests/**/*.test.ts'],
    environment: 'node',
    testTimeout: 30_000,
  },
});
