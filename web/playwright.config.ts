import { defineConfig, devices } from '@playwright/test';

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
        // Use local Chromium installation
        launchOptions: {
          executablePath: process.env.PLAYWRIGHT_BROWSERS_PATH
            ? undefined
            : './node_modules/.cache/ms-playwright/chromium-1200/chrome-mac/Chromium.app/Contents/MacOS/Chromium'
        }
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
