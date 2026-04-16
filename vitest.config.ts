import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: [
        'src/app/api/**/*.ts',
        'src/lib/**/*.ts',
      ],
      exclude: [
        'src/lib/prisma.ts',     // DB connection, no logic to test
        'src/lib/email.ts',      // External API, tested via integration
        'src/lib/rate-limit.ts', // Rate limiting, indirect test
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 70,
        statements: 80,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
