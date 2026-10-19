import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'
export default defineConfig({
  resolve: { alias: { '~~': fileURLToPath(new URL('./', import.meta.url)) } },
  test: { include: ['tests/**/*.test.ts'], environment: 'node', testTimeout: 60_000, hookTimeout: 120_000, env: { NODE_ENV: 'test', QR_SECRET: 'test-qr-secret-0123456789', SESSION_SECRET: 'test-session-secret-0123456789' } }
})
