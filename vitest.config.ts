import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['{shared,web,worker}/src/**/*.test.{ts,tsx}'],
    environment: 'node',
  },
})
