import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  resolve: {
    alias: {
      '@clickup/contracts':    path.resolve(__dirname, '../../packages/contracts/src/index.ts'),
      '@clickup/sdk':          path.resolve(__dirname, '../../packages/sdk/src/index.ts'),
      '@clickup/test-helpers': path.resolve(__dirname, '../../packages/test-helpers/src/index.ts'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
  },
})
