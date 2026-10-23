import { test, expect } from '@playwright/test';
import { actAs, ADMIN } from './dev-user';

test.describe('Administración de cohortes', () => {
  test.beforeEach(async ({ page }) => {
    await actAs(page, ADMIN);
  });

  test('admin puede abrir las acciones de una cohorte y editar sus datos', async ({ page }) => {
    await page.goto('/courses');

    const cohort = page.locator('article').filter({ hasText: '1º A' }).first();
    await expect(cohort).toBeVisible();
    await cohort.getByRole('button', { name: /Acciones de/ }).click();
    await page.getByRole('menuitem', { name: 'Editar' }).click();

    const modal = page.getByRole('dialog', { name: 'Editar cohorte' });
    await expect(modal).toBeVisible();
    await expect(modal.getByLabel('Año académico')).toHaveValue(/\d{4}-\d{4}/);
  });

  test('admin ve acciones de gestión en las asignaturas de una cohorte', async ({ page }) => {
    await page.goto('/courses/course-klass-2025');

    const subject = page.locator('article').filter({ hasText: 'Introducción al Desarrollo Web' }).first();
    await expect(subject).toBeVisible();
    await subject.getByRole('button', { name: /Acciones de/ }).click();
    await expect(page.getByRole('menuitem', { name: 'Archivar' })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: 'Borrar' })).toBeVisible();
  });
});
