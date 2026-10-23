import { expect, test, type Page } from '@playwright/test';

/**
 * Client-side Google sign-in. The spec never follows a consent screen:
 * /api/auth/google is fulfilled locally, and accounts.google.com must not be requested.
 */

function rejectGoogle(page: Page, hits: string[]) {
  page.on('request', (request) => {
    if (/accounts\.google\.com|oauth2\.googleapis\.com|googleapis\.com\/oauth2/.test(request.url())) {
      hits.push(request.url());
    }
  });
}

async function rememberStoredTokens(page: Page) {
  await page.addInitScript(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function setItem(key: string, value: string) {
      if (key === 'accessToken' || key === 'refreshToken') {
        original.call(sessionStorage, `seen-${key}`, value);
      }
      return original.call(this, key, value);
    };
  });
}

test.describe('Google sign-in client', () => {
  test.describe.configure({ timeout: 30_000 });
  test('an empty organization code does not start Google sign-in', async ({ page }) => {
    const googleHits: string[] = [];
    const authHits: string[] = [];
    rejectGoogle(page, googleHits);
    page.on('request', (request) => {
      if (request.url().includes('/auth/google')) authHits.push(request.url());
    });

    await page.goto('/login');
    await page.getByRole('button', { name: 'Continuar con Google' }).click();

    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole('alert')).toHaveText('El código de organización es obligatorio.');
    expect(authHits).toEqual([]);
    expect(googleHits).toEqual([]);
  });

  test('whitespace-only organization code does not navigate', async ({ page }) => {
    const authHits: string[] = [];
    page.on('request', (request) => {
      if (request.url().includes('/auth/google')) authHits.push(request.url());
    });

    await page.goto('/login');
    await page.getByLabel('Código de organización').fill('   ');
    await page.getByRole('button', { name: 'Continuar con Google' }).click();

    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole('alert')).toHaveText('El código de organización es obligatorio.');
    expect(authHits).toEqual([]);
  });

  test('an invalid organization code does not navigate', async ({ page }) => {
    const authHits: string[] = [];
    page.on('request', (request) => {
      if (request.url().includes('/auth/google')) authHits.push(request.url());
    });

    await page.goto('/login');
    await page.getByLabel('Código de organización').fill('bad slug');
    await page.getByRole('button', { name: 'Continuar con Google' }).click();

    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole('alert')).toHaveText(
      'El código de organización no es válido. Usa minúsculas, números y guiones, sin espacios.',
    );
    expect(authHits).toEqual([]);
  });

  test('a valid code navigates to /api/auth/google with the normalized slug', async ({ page }) => {
    const googleHits: string[] = [];
    rejectGoogle(page, googleHits);
    await page.route('**/api/auth/google**', async (route) => {
      await route.fulfill({ status: 204, body: '' });
    });

    await page.goto('/login');
    await page.getByLabel('Código de organización').fill('Klass-42');
    const [request] = await Promise.all([
      page.waitForRequest((candidate) => candidate.url().includes('/api/auth/google')),
      page.getByRole('button', { name: 'Continuar con Google' }).click(),
    ]);

    const url = new URL(request.url());
    expect(url.pathname).toBe('/api/auth/google');
    expect(url.searchParams.get('organizationSlug')).toBe('klass-42');
    expect(page.url()).not.toContain('accounts.google.com');
    expect(googleHits).toEqual([]);
  });

  test('stores hash tokens and replaces the page with /dashboard', async ({ page }) => {
    await rememberStoredTokens(page);
    // Pathname, not a glob: `/src/lib/api/` must still load.
    await page.route(
      (url) => url.pathname === '/api' || url.pathname.startsWith('/api/'),
      (route) => route.abort(),
    );

    await page.goto('/auth/callback#accessToken=acc-token&refreshToken=ref-token');
    await page.waitForURL(/\/dashboard/, { waitUntil: 'commit' });

    await expect
      .poll(() =>
        page.evaluate(() => ({
          accessToken: sessionStorage.getItem('seen-accessToken'),
          refreshToken: sessionStorage.getItem('seen-refreshToken'),
        })),
      )
      .toEqual({ accessToken: 'acc-token', refreshToken: 'ref-token' });
  });

  test('shows the unknown-organization message', async ({ page }) => {
    await page.goto('/auth/callback#error=unknown_organization');
    await expect(page.getByText('No existe una organización con ese código.')).toBeVisible();
    await expect(page).toHaveURL(/\/auth\/callback/);
    await expect(page.getByRole('link', { name: 'Volver al inicio de sesión' })).toHaveAttribute(
      'href',
      '/login',
    );
  });

  test('shows the wrong-organization message', async ({ page }) => {
    await page.goto('/auth/callback#error=wrong_organization');
    await expect(
      page.getByText('Esta cuenta de Google ya está vinculada a otra organización.'),
    ).toBeVisible();
    await expect(page).toHaveURL(/\/auth\/callback/);
  });

  test('shows the generic Google error for oauth_failed and any other error', async ({ page }) => {
    await page.goto('/auth/callback#error=oauth_failed');
    await expect(
      page.getByText('Error al iniciar sesión con Google. Inténtalo de nuevo.'),
    ).toBeVisible();

    await page.goto('/auth/callback#error=nope');
    await expect(
      page.getByText('Error al iniciar sesión con Google. Inténtalo de nuevo.'),
    ).toBeVisible();
  });

  test('shows a missing-token message when the hash has neither tokens nor an error', async ({
    page,
  }) => {
    await page.goto('/auth/callback');
    await expect(page.getByText('No se recibieron tokens de autenticación.')).toBeVisible();

    await page.goto('/auth/callback#accessToken=only-access');
    await expect(page.getByText('No se recibieron tokens de autenticación.')).toBeVisible();

    await page.goto('/auth/callback#foo=bar');
    await expect(page.getByText('No se recibieron tokens de autenticación.')).toBeVisible();
  });
});
