import { test, expect } from '@playwright/test';
import { actAs, TEACHER } from './dev-user';

/**
 * B2a — Activity authoring (teacher). Runs as the seeded teacher. Creates a QUIZ
 * activity in the seed course, adds a multiple-choice question, publishes it, and
 * asserts the state along the way, then deletes it to keep the seed clean. This
 * drives the real activities/ backend end to end through the UI.
 */
const COURSE_ID = 'course-web-101';

test.describe('B2a — activity authoring', () => {
  test.beforeEach(async ({ page }) => {
    await actAs(page, TEACHER);
  });

  test('teacher creates a quiz → adds an MCQ question → publishes → deletes', async ({
    page,
  }) => {
    const title = `E2E quiz ${Date.now()}`;

    await page.goto('/activities');
    const course = page.getByRole('combobox', { name: 'Asignatura' });
    await expect(course).toBeVisible({ timeout: 8000 });
    await course.selectOption(COURSE_ID);

    // ── Create the activity ──────────────────────────────────────────────
    await page.getByRole('button', { name: '+ Nueva tarea' }).click();
    await page.getByLabel('Título').fill(title);
    await page.getByRole('button', { name: 'Crear tarea' }).click();

    // The new activity is selected; its detail shows the title + Borrador badge.
    await expect(page.getByRole('heading', { level: 2, name: title })).toBeVisible({
      timeout: 8000,
    });
    await expect(page.getByText('Borrador').first()).toBeVisible();

    // Can't publish without questions.
    await page.getByRole('button', { name: 'Publicar' }).click();
    await expect(page.getByText(/Añade al menos una pregunta/)).toBeVisible({
      timeout: 8000,
    });

    // ── Add a multiple-choice question ───────────────────────────────────
    await page.getByRole('button', { name: '+ Añadir pregunta' }).click();
    await page.getByLabel('Enunciado').fill('¿Cuánto es 2 + 2?');
    await page.getByLabel('Texto de la opción 1').fill('3');
    await page.getByLabel('Texto de la opción 2').fill('4');
    await page.getByLabel('Opción 2 es correcta').check();
    await page.getByRole('button', { name: 'Añadir pregunta', exact: true }).click();

    // The question appears in the list.
    await expect(page.getByText('¿Cuánto es 2 + 2?')).toBeVisible({ timeout: 8000 });
    await expect(page.getByText('Preguntas (1)')).toBeVisible();

    // ── Publish ──────────────────────────────────────────────────────────
    await page.getByRole('button', { name: 'Publicar' }).click();
    await expect(page.getByText('Publicada').first()).toBeVisible({ timeout: 8000 });

    // ── Delete (cleanup) ─────────────────────────────────────────────────
    await page.getByRole('button', { name: 'Eliminar tarea' }).click();
    await page.getByRole('button', { name: 'Eliminar', exact: true }).last().click();
    await expect(
      page.getByRole('heading', { level: 2, name: title }),
    ).toHaveCount(0, { timeout: 8000 });
  });
});
