import { defineConfig, devices } from '@playwright/test';

/**
 * API acceptance tests against Compose. Run `make db-seed-e2e` first: unlike
 * the smoke suite this fixture deliberately contains two isolated tenants.
 */
export default defineConfig({
  testDir: './e2e',
  testMatch: 'compose-tenant-rbac.spec.ts',
  fullyParallel: false,
  workers: 1,
  timeout: 30_000,
  retries: 1,
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'https://localhost:4443',
    ignoreHTTPSErrors: process.env.E2E_IGNORE_HTTPS_ERRORS !== 'false',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [{ name: 'chromium-desktop', use: { ...devices['Desktop Chrome'] } }],
});
