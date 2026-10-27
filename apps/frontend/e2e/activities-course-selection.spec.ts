import { expect, test } from '@playwright/test';
import { actAs, STUDENT } from './dev-user';

test('restores the chosen subject and selects the subject from an activity link', async ({ page }) => {
  await actAs(page, STUDENT);
  await page.goto('/activities');

  const subjectSelect = page.getByRole('combobox', { name: 'Asignatura' });
  await expect(subjectSelect).toBeVisible();
  await expect(subjectSelect.locator('option[value="subject-web-100"]'))
    .toHaveText('Introducción al Desarrollo Web (2024-2025) · 1º A');

  await subjectSelect.selectOption('subject-web-100');
  await page.reload();
  await expect(subjectSelect).toHaveValue('subject-web-100');

  await page.goto('/activities?activityId=activity-web-101-quiz');
  await expect(subjectSelect).toHaveValue('course-web-101');
  await expect(page.getByRole('button', { name: /Autoevaluación de la unidad/ }))
    .toBeVisible();
});

test('shows an explicit empty state for a linked task that no longer exists', async ({ page }) => {
  await actAs(page, STUDENT);
  await page.goto('/activities?activityId=activity-that-does-not-exist');

  await expect(page.getByText('Esta tarea ya no existe')).toBeVisible({ timeout: 8000 });
  await expect(page.getByRole('link', { name: 'Volver a las tareas' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Empezar tarea' })).toHaveCount(0);

  await page.goto('/activities/activity-that-does-not-exist');
  await expect(page.getByText('Esta tarea ya no existe')).toBeVisible({ timeout: 8000 });
});
