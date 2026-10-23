import { expect, test } from '@playwright/test';

test.describe('email verification', () => {
  test('shows a clear message for an invalid or expired token', async ({ page }) => {
    await page.route('**/api/auth/verify-email**', async (route) => {
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({
          statusCode: 400,
          message: 'El enlace de verificación no es válido o ha caducado.',
          error: 'Bad Request',
        }),
      });
    });

    await page.goto('/verify-email?token=invalid-token');

    await expect(page.getByRole('heading', { name: 'No se pudo verificar el correo' })).toBeVisible();
    await expect(page.getByRole('alert')).toHaveText(
      'El enlace de verificación no es válido o ha caducado.',
    );
    await expect(page.getByRole('link', { name: 'Volver al inicio de sesión' })).toHaveAttribute(
      'href',
      '/login',
    );
  });
});
