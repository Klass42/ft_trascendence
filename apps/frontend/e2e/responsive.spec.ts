import { expect, test } from '@playwright/test';
import { actAs, ADMIN, STUDENT, TEACHER } from './dev-user';

const responsivePages = [
  { user: STUDENT, paths: ['/activities', '/forums', '/profile', '/notifications', '/grades', '/courses/course-klass-2025'] },
  { user: TEACHER, paths: ['/activities', '/forums', '/analytics', '/resources', '/grades', '/courses/course-klass-2025'] },
  { user: ADMIN, paths: ['/admin/users', '/org/members', '/analytics', '/courses/course-klass-2025'] },
];

test.describe('Diseño responsive y acceso por rol', () => {
  test.setTimeout(120_000);

  for (const group of responsivePages) {
    test(`no desborda a 375px ni 320px (usuario ${group.user})`, async ({ page }) => {
      await actAs(page, group.user);

      for (const width of [375, 320]) {
        await page.setViewportSize({ width, height: 812 });
        for (const path of group.paths) {
          await page.goto(path);
          await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
          await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
        }
      }
    });
  }

  test('404 dentro del layout con pie legal, sin desbordar a 375px', async ({ page }) => {
    await actAs(page, STUDENT);
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/ruta-que-no-existe');
    await expect(page.getByRole('main')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Página no encontrada' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Volver al inicio' })).toHaveAttribute('href', '/dashboard');
    const legal = page.getByRole('navigation', { name: 'Legal' });
    await expect(legal.getByRole('link', { name: 'Privacidad' })).toBeVisible();
    await expect(legal.getByRole('link', { name: 'Términos' })).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
  });

  test('redirige al alumno desde analíticas', async ({ page }) => {
    await actAs(page, STUDENT);
    await page.goto('/analytics');
    await expect(page).toHaveURL(/\/dashboard$/);
  });

  test('redirige al administrador desde tareas y foros', async ({ page }) => {
    await actAs(page, ADMIN);
    for (const path of ['/activities', '/forums', '/forums/thread-no-existente']) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/dashboard$/);
    }
  });

  test('permite analíticas al profesor y al administrador', async ({ page }) => {
    for (const user of [TEACHER, ADMIN]) {
      await actAs(page, user);
      await page.goto('/analytics');
      await expect(page).toHaveURL(/\/analytics$/);
    }
  });
});
