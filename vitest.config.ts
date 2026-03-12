import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    conditions: ['source'],
  },
  test: {
    include: ['tests/**/*.test.ts', 'packages/*/tests/**/*.test.ts'],
    globals: true,
  },
});
