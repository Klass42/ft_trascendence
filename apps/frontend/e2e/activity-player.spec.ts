import { expect, test } from '@playwright/test';
import { actAs, STUDENT } from './dev-user';

const COURSE_ID = 'course-web-101';

/** Exercises the learner path without leaking authoring controls or answer keys.
 * It intentionally leaves the seeded attempt in progress: a repeat run resumes
 * it, which is the behaviour the product promises. */
test.describe('B2b — activity player', () => {
  test.beforeEach(async ({ page }) => {
    await actAs(page, STUDENT);
  });

  test('student opens a published activity and saves an answer draft', async ({ page }) => {
    await page.goto('/activities');
    const course = page.getByRole('combobox', { name: 'Asignatura' });
    await expect(course).toBeVisible({ timeout: 8000 });
    await course.selectOption(COURSE_ID);

    await expect(page.getByText('Autoevaluación de la unidad').first()).toBeVisible({ timeout: 8000 });
    await expect(page.getByRole('button', { name: '+ Nueva tarea' })).toHaveCount(0);
    await page.getByRole('button', { name: /Autoevaluación de la unidad/ }).first().click();
    await page.getByRole('button', { name: /Empezar tarea|Reanudar intento/ }).click();

    await expect(page.getByText('Pregunta 1 · 5 pts')).toBeVisible({ timeout: 8000 });
    await page.getByRole('checkbox').first().check();
    await page.getByRole('button', { name: 'Guardar borrador' }).click();
    await expect(page.getByText('Guardado')).toBeVisible({ timeout: 8000 });
  });
});
