import { test, expect } from '@playwright/test';
import { actAs, TEACHER as ACT_TEACHER } from './dev-user';

/**
 * Task authoring (teacher) + window enforcement (student).
 *
 * The unified surface is `/activities` (copy «Tareas»). Assignment mutation
 * endpoints return 410; this spec talks only to activities/attempts.
 */

const BASE_URL = 'http://localhost:3000';
const COURSE_ID = 'course-web-101';
const STUDENT = 'user-lucia-001';
const TEACHER = 'user-diego-001';

const PAST_CLOSE = '2000-01-01T10:00';

test.describe('Tareas — authoring & window', () => {
  test.beforeEach(async ({ page }) => {
    await actAs(page, ACT_TEACHER);
  });

  test('teacher creates → closed badge → edits → student blocked → delete', async ({
    page,
  }) => {
    const title = `E2E ventana ${Date.now()}`;
    const edited = `${title} (editada)`;

    await page.goto('/activities');
    const course = page.getByRole('combobox', { name: 'Asignatura' });
    await expect(course).toBeVisible({ timeout: 8000 });
    await course.selectOption(COURSE_ID);

    await page.getByRole('button', { name: '+ Nueva tarea' }).click();
    await page.getByLabel('Título').fill(title);
    await page.getByLabel('Cierre').fill(PAST_CLOSE);
    await page.getByRole('button', { name: 'Crear tarea' }).click();

    await expect(
      page.getByRole('heading', { level: 2, name: title }),
    ).toBeVisible({ timeout: 8000 });

    await page.getByRole('button', { name: '+ Añadir pregunta' }).click();
    await page.getByLabel('Tipo de pregunta').selectOption('ESSAY');
    await page.getByLabel('Enunciado').fill('Desarrolla el tema.');
    await page.getByRole('button', { name: 'Añadir pregunta', exact: true }).click();
    await expect(page.getByText('Desarrollar')).toBeVisible({ timeout: 8000 });

    await page.getByRole('button', { name: 'Publicar' }).click();
    await expect(page.getByText('Cerrada').first()).toBeVisible();

    await page.getByRole('button', { name: 'Editar tarea' }).click();
    await page.getByLabel('Título').fill(edited);
    await page.getByRole('button', { name: 'Guardar cambios' }).click();
    await expect(
      page.getByRole('heading', { level: 2, name: edited }),
    ).toBeVisible({ timeout: 8000 });

    const activities = await page.evaluate(
      async ({ base, course, teacher }) => {
        const res = await fetch(`${base}/subjects/${course}/activities`, {
          headers: { 'x-dev-user': teacher },
        });
        return (await res.json()) as Array<{ id: string; title: string }>;
      },
      { base: BASE_URL, course: COURSE_ID, teacher: TEACHER },
    );
    const created = activities.find((a) => a.title === edited);
    expect(created).toBeTruthy();
    const activityId = created!.id;

    const status = await page.evaluate(
      async ({ base, id, student }) => {
        const res = await fetch(`${base}/activities/${id}/attempts`, {
          method: 'POST',
          headers: {
            'x-dev-user': student,
            'Content-Type': 'application/json',
          },
        });
        return res.status;
      },
      { base: BASE_URL, id: activityId, student: STUDENT },
    );
    expect(status).toBe(400);

    await page.getByRole('button', { name: 'Borrar tarea' }).click();
    await page
      .getByRole('button', { name: 'Borrar', exact: true })
      .last()
      .click();
    await expect(
      page.getByRole('heading', { level: 2, name: edited }),
    ).toHaveCount(0, { timeout: 8000 });
  });
});
