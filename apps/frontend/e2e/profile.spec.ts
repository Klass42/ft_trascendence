import { test, expect } from '@playwright/test';
import { actAs } from './dev-user';

/**
 * A5 — Profile page with real account data.
 *
 * Uses a THROWAWAY user (POST /auth/register in beforeAll) so seeded users'
 * passwords are never mutated. The dev auth layer (x-dev-user via localStorage)
 * impersonates the throwaway user for the UI flows; the password flow switches
 * to the real login page after removing the dev-user-id key.
 */

const BASE_URL = 'http://localhost:3000';
const EMAIL = `e2e-profile-${Date.now()}@demo`;
const OLD_PASSWORD = 'Vieja1234';
const NEW_PASSWORD = 'Nueva1234';

let userId = '';
let refreshToken = '';

test.describe('A5 — Perfil y cuenta reales', () => {
  test.beforeAll(async ({ request }) => {
    const res = await request.post(`${BASE_URL}/auth/register`, {
      data: { email: EMAIL, password: OLD_PASSWORD, name: 'E2E Perfil' },
    });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    userId = body.user.userId;
    refreshToken = body.refreshToken;
  });

  test('editar nombre persiste tras recargar', async ({ page }) => {
    await actAs(page, userId);
    await page.goto('/profile');

    await page.getByLabel('Nombre').fill('Nombre Cambiado');
    await page.getByRole('button', { name: 'Guardar cambios' }).click();
    await expect(page.getByText('Nombre actualizado')).toBeVisible();

    await page.reload();
    await expect(page.getByLabel('Nombre')).toHaveValue('Nombre Cambiado');
    await page.screenshot({ path: 'e2e/screenshots/profile-name.png' });
  });

  test('preferencias persisten tras recargar', async ({ page }) => {
    await actAs(page, userId);
    await page.goto('/profile');

    await page.getByRole('switch', { name: 'Notificaciones por correo electrónico' }).click();
    await expect(page.getByText('Notificaciones desactivadas')).toBeVisible();
    await page.getByLabel('Idioma').selectOption('en');
    await expect(page.getByText('Idioma guardado')).toBeVisible();

    await page.reload();
    await expect(
      page.getByRole('switch', { name: 'Notificaciones por correo electrónico' }),
    ).toHaveAttribute('aria-checked', 'false');
    await expect(page.getByLabel('Idioma')).toHaveValue('en');
    await page.screenshot({ path: 'e2e/screenshots/profile-prefs.png' });
  });

  test('cambiar contraseña revoca sesiones y redirige a login', async ({ page, request }) => {
    await actAs(page, userId);
    await page.goto('/profile');

    await page.getByLabel('Contraseña actual').fill(OLD_PASSWORD);
    await page.getByLabel('Nueva contraseña').fill(NEW_PASSWORD);
    await page.getByLabel('Confirmar contraseña').fill(NEW_PASSWORD);
    await page.getByRole('button', { name: 'Cambiar contraseña' }).click();

    await expect(
      page.getByText('Contraseña actualizada — inicia sesión de nuevo'),
    ).toBeVisible();
    await expect(page).toHaveURL(/\/login/);

    // Sessions revoked: the pre-change refresh token is dead.
    const refresh = await request.post(`${BASE_URL}/auth/refresh`, {
      data: { refreshToken },
    });
    expect(refresh.status()).toBe(401);

    // Real auth: old password fails, new one works (verified via API —
    // UI login with password can't be tested in dev mode because
    // VITE_DEV_USER_ID env var re-authenticates automatically).
    const oldLogin = await request.post(`${BASE_URL}/auth/login`, {
      data: { email: EMAIL, password: OLD_PASSWORD },
    });
    expect(oldLogin.status()).toBe(401);

    const newLogin = await request.post(`${BASE_URL}/auth/login`, {
      data: { email: EMAIL, password: NEW_PASSWORD },
    });
    expect(newLogin.ok()).toBeTruthy();

    await page.screenshot({ path: 'e2e/screenshots/profile-password.png' });
  });
});
