import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'edge-runtime',
    include: ['./**/*.test.ts'],
    exclude: ['./dist/**', './example/**', './node_modules/**'],
  },
})
