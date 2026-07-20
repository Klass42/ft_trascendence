import { type Page } from '@playwright/test';

/**
 * Seeded users (see prisma/seed.ts).
 */
export const TEACHER = 'user-diego-001';
export const STUDENT = 'user-lucia-001';
export const ADMIN = 'user-admin-0001';

/**
 * Make the browser act as a given seeded user for the whole test.
 *
 * The dev auth layer sends `getDevUserId()` as the `x-dev-user` header on every
 * request; `DevTokenStorage` reads the `dev-user-id` localStorage key first and
 * only then falls back to the build-time `VITE_DEV_USER_ID`. Setting that key
 * via an init script (runs before app boot on every navigation) lets each spec
 * choose its role, so the suite is green regardless of which user the developer
 * baked into `.env.development.local`.
 *
 * Call once in a `test.beforeEach` before any `page.goto`.
 */
export async function actAs(page: Page, userId: string): Promise<void> {
  await page.addInitScript((id) => {
    window.localStorage.setItem('dev-user-id', id);
  }, userId);
}
