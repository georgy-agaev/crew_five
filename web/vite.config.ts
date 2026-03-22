import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { configDefaults } from 'vitest/config'
import { devProxyConfig } from './src/devProxyConfig'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: devProxyConfig,
  },
  test: {
    ...configDefaults,
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    exclude: [...configDefaults.exclude, 'e2e/**'],
    environment: 'jsdom',
    globals: true,
  },
})
