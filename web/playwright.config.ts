import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment for E2E tests.
// - Repo root `.env` is used for Supabase/service keys and web adapter config.
// - Web `.env` is used for Vite client config (VITE_*).
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });
dotenv.config({ path: path.resolve(__dirname, '.env') });

/**
 * Playwright E2E Test Configuration
 * Tests for segment creation workflows (T029, T030)
 *
 * Note: Chromium browser installed to local node_modules cache
 * Set PLAYWRIGHT_BROWSERS_PATH=./node_modules/.cache/ms-playwright if needed
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false, // Run sequentially to avoid DB conflicts
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : 1, // Single worker to avoid race conditions
  reporter: 'html',

  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
      },
    },
  ],

  // Web server configuration (auto-start dev server for tests)
  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
});
