import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

function captureConsoleErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  return errors;
}

test.describe('E2E deployment smoke — Compose over HTTPS', () => {
  test('E2E-DEPLOY-02/03: health is healthy through TLS and HTTP redirects', async ({ request }) => {
    const health = await request.get('/health');
    expect(health.ok()).toBeTruthy();
    expect(await health.json()).toMatchObject({ status: 'ok', database: 'up' });

    const redirect = await request.get('http://localhost:4180/health', { maxRedirects: 0 });
    expect(redirect.status()).toBe(302);
    expect(redirect.headers().location).toBe('https://localhost:4443/health');
  });

  test('E2E-PUBLIC-02: legal pages are linked from login and contain real content', async ({ page }) => {
    const errors = captureConsoleErrors(page);
    await page.goto('/login');
    const privacy = page.getByRole('link', { name: 'Política de privacidad' });
    await expect(privacy).toBeVisible();
    await expect(page.getByRole('link', { name: 'Términos de servicio' })).toBeVisible();

    await privacy.click();
    await expect(page).toHaveURL(/\/privacy$/);
    await expect(page.getByRole('heading', { name: 'Política de privacidad' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Datos que tratamos' })).toBeVisible();

    await page.goto('/terms');
    await expect(page.getByRole('heading', { name: 'Términos de servicio' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Contenido y conducta' })).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('E2E-AUTH-05: the standard seeded user logs in through Caddy', async ({ page }) => {
    const errors = captureConsoleErrors(page);
    await page.goto('/login');
    await page.getByLabel('Código de organización').fill('klass');
    await page.getByLabel('Correo electrónico').fill('student@demo');
    await page.getByLabel('Contraseña', { exact: true }).fill('demo1234');
    await page.getByRole('button', { name: 'Iniciar sesión' }).click();

    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole('heading', { name: /Hola de nuevo, Sam/ })).toBeVisible();
    expect(errors).toEqual([]);
  });
});
