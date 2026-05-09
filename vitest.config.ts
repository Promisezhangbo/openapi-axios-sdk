import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts', 'scripts/**/*.{mjs,ts}'],
      exclude: ['scripts/generate.mjs'],
      reporter: ['text', 'html', 'json'],
    },
  },
});
