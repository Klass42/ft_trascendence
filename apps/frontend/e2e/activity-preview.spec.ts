import { expect, test } from '@playwright/test';
import { actAs, TEACHER } from './dev-user';

const API = 'http://localhost:3000';
const COURSE_ID = 'course-web-101';

test('el profesor comprueba una tarea en vista previa sin crear entregas', async ({
  page,
  request,
}) => {
  await actAs(page, TEACHER);
  const title = `E2E vista previa ${Date.now()}`;
  let activityId: string | null = null;

  try {
    await page.goto('/activities');
    const course = page.getByRole('combobox', { name: 'Curso' });
    await expect(course).toBeVisible({ timeout: 8000 });
    await course.selectOption(COURSE_ID);

    await page.getByRole('button', { name: '+ Nueva tarea' }).click();
    const createDialog = page.getByRole('dialog', { name: 'Nueva tarea' });
    await createDialog.getByLabel('Título').fill(title);
    await createDialog.getByRole('button', { name: 'Crear tarea' }).click();
    await expect(page.getByRole('heading', { level: 2, name: title })).toBeVisible({ timeout: 8000 });

    activityId = new URL(page.url()).searchParams.get('activityId');
    expect(activityId).toBeTruthy();

    await page.getByRole('button', { name: '+ Añadir pregunta' }).click();
    await page.getByLabel('Enunciado').fill('¿Cuánto es 2 + 2?');
    await page.getByLabel('Texto de la opción 1').fill('3');
    await page.getByLabel('Texto de la opción 2').fill('4');
    await page.getByLabel('Opción 2 es correcta').check();
    await page.getByRole('button', { name: 'Añadir pregunta', exact: true }).click();

    await page.getByRole('button', { name: 'Vista previa' }).click();
    const preview = page.getByRole('dialog', { name: `Vista previa: ${title}` });
    await expect(preview.getByText('Nada de lo que respondas se guarda.')).toBeVisible();
    await preview.getByLabel('4').check();
    await preview.getByRole('button', { name: 'Comprobar respuestas' }).click();
    await expect(preview.getByText('Correcta', { exact: true })).toBeVisible();
    await expect(preview.getByText('Solución: 4')).toBeVisible();

    await preview.getByRole('button', { name: 'Cerrar' }).click();
    await expect(page.getByText('Sin entregas todavía')).toBeVisible({ timeout: 8000 });
    const attempts = await request.get(`${API}/activities/${activityId}/attempts`, {
      headers: { 'x-dev-user': TEACHER },
    });
    expect(attempts.ok()).toBeTruthy();
    expect(await attempts.json()).toEqual([]);
  } finally {
    if (activityId) {
      await request.delete(`${API}/activities/${activityId}`, {
        headers: { 'x-dev-user': TEACHER },
      });
    }
  }
});
