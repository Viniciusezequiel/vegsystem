import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  forbidOnly: true,
  timeout: 90_000,
  // Mutating production fixtures must never be replayed implicitly.
  retries: 0,
  globalSetup: './tests/e2e/auth.global-setup.ts',
  globalTeardown: './tests/e2e/auth.global-teardown.ts',
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: process.env.E2E_BASE_URL || 'https://www.vegsystem.site',
    // Authenticated runs handle secrets. Never persist page/request artifacts.
    trace: 'off',
    screenshot: 'off',
    video: 'off',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
