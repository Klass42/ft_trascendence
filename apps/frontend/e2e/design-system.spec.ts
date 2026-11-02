import { expect, test } from '@playwright/test';
import { actAs, ADMIN, STUDENT } from './dev-user';

test.describe('Sistema de diseño (/design)', () => {
  test('el administrador ve paleta, tipografía, iconos y componentes sin desbordar a 375px', async ({ page }) => {
    await actAs(page, ADMIN);
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/design');

    await expect(page.getByRole('heading', { level: 1, name: 'Sistema de diseño' })).toBeVisible();
    for (const name of ['Paleta', 'Tipografía', 'Iconos', 'Componentes']) {
      await expect(page.getByRole('heading', { level: 2, name })).toBeVisible();
    }
    // Values are read from the live CSS variables.
    await expect(page.getByText('--color-accent-primary').first()).toBeVisible();
    await expect(page.getByText('#2563eb').first()).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
  });

  test('un alumno no puede abrir /design', async ({ page }) => {
    await actAs(page, STUDENT);
    await page.goto('/design');
    await expect(page).toHaveURL(/\/dashboard/);
  });
});
