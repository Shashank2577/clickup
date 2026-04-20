import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  resolve: {
    alias: {
      '@clickup/contracts': path.resolve(__dirname, '../../packages/contracts/dist/index.js'),
      '@clickup/sdk':       path.resolve(__dirname, '../../packages/sdk/dist/index.js'),
      '@clickup/test-helpers': path.resolve(__dirname, '../../packages/test-helpers/dist/index.js'),
    },
  },
  test: {
    globals: false,
    environment: 'node',
  },
})
