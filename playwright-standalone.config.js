import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for standalone E2E tests
 * Assumes server is already running on port 7337
 */
export default defineConfig({
  testDir: './tests/e2e',

  // Maximum time one test can run
  timeout: 30 * 1000,

  // Test execution settings
  fullyParallel: false,
  forbidOnly: false,
  retries: 0,
  workers: 1,

  // Reporter configuration
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['list']
  ],

  // Shared settings for all tests
  use: {
    // Base URL for tests
    baseURL: 'http://localhost:7337',

    // Screenshot and trace settings
    screenshot: 'on',
    trace: 'retain-on-failure',
    video: 'retain-on-failure',

    // Browser context options
    viewport: { width: 1920, height: 1080 },
    ignoreHTTPSErrors: true,

    // Action timeout
    actionTimeout: 10000,
  },

  // Configure projects for different browsers
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // No webServer - assumes server is already running
});
