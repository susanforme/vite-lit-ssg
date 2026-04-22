import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['unit/**/*.test.ts', 'integration/**/*.test.ts'],
    environment: 'node',
    fileParallelism: false,
    env: {
      NODE_ENV: 'development',
    },
  },
})
