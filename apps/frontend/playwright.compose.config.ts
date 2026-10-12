import { defineConfig, devices } from '@playwright/test';

/**
 * Acceptance tests against the deployed path: Chromium → HTTPS/Caddy → app.
 * `make` must have completed (including the standard seed) before this suite.
 */
export default defineConfig({
  testDir: './e2e',
  testMatch: 'compose-smoke.spec.ts',
  fullyParallel: false,
  workers: 1,
  timeout: 30_000,
  retries: 1,
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'https://localhost:4443',
    // Caddy's local development CA is not installed in CI browser profiles.
    // Production runs must set E2E_IGNORE_HTTPS_ERRORS=false.
    ignoreHTTPSErrors: process.env.E2E_IGNORE_HTTPS_ERRORS !== 'false',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium-desktop', use: { ...devices['Desktop Chrome'] } },
    {
      name: 'chromium-mobile',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 375, height: 812 },
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
});
