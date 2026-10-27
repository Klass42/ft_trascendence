import { test, expect } from '@playwright/test';
import { actAs, TEACHER as ACT_TEACHER } from './dev-user';

/**
 * TeacherDashboard with real data (no mock). Setup via the activity/attempt
 * API so we never hit the 410 assignment mutation endpoints.
 */

const BASE_URL = 'http://localhost:3000';
const COURSE_ID = 'course-web-101';
const TEACHER = 'user-diego-001';
const STUDENT = 'user-lucia-001';

test.describe('A4-teacher — TeacherDashboard (real data)', () => {
  const title = `E2E panel ${Date.now()}`;
  let activityId = '';

  test.beforeEach(async ({ page }) => {
    await actAs(page, ACT_TEACHER);
  });

  test.beforeAll(async ({ request }) => {
    const created = await request.post(
      `${BASE_URL}/subjects/${COURSE_ID}/activities`,
      {
        headers: { 'x-dev-user': TEACHER, 'Content-Type': 'application/json' },
        data: { title, type: 'QUIZ' },
      },
    );
    const activity = (await created.json()) as { id: string };
    activityId = activity.id;

    const question = await request.post(
      `${BASE_URL}/activities/${activityId}/questions`,
      {
        headers: { 'x-dev-user': TEACHER, 'Content-Type': 'application/json' },
        data: {
          kind: 'ESSAY',
          prompt: 'Desarrolla.',
          points: 10,
          content: {},
        },
      },
    );
    const q = (await question.json()) as { id: string };

    await request.patch(`${BASE_URL}/activities/${activityId}`, {
      headers: { 'x-dev-user': TEACHER, 'Content-Type': 'application/json' },
      data: { status: 'PUBLISHED' },
    });

    const started = await request.post(
      `${BASE_URL}/activities/${activityId}/attempts`,
      { headers: { 'x-dev-user': STUDENT } },
    );
    const attempt = (await started.json()) as { id: string };
    await request.patch(`${BASE_URL}/attempts/${attempt.id}`, {
      headers: { 'x-dev-user': STUDENT, 'Content-Type': 'application/json' },
      data: {
        answers: [{ questionId: q.id, response: { text: 'Entrega para el panel' } }],
      },
    });
    await request.post(`${BASE_URL}/attempts/${attempt.id}/submit`, {
      headers: { 'x-dev-user': STUDENT },
    });
  });

  test.afterAll(async ({ request }) => {
    if (activityId) {
      await request.patch(`${BASE_URL}/activities/${activityId}`, {
        headers: { 'x-dev-user': TEACHER, 'Content-Type': 'application/json' },
        data: { status: 'ARCHIVED' },
      });
    }
  });

  test('shows real figures and "Por calificar" opens the gradebook', async ({
    page,
  }) => {
    await page.goto('/dashboard');

    await expect(page.getByText('Profesor')).toBeVisible();
    await expect(page.getByText('Asignaturas activas')).toBeVisible({ timeout: 8000 });
    await expect(page.getByText('Alumnos totales')).toBeVisible();
    await expect(page.getByText('142')).toHaveCount(0);

    await expect(page.getByText('Entregas por calificar')).toBeVisible();
    await expect(page.getByText(title).first()).toBeVisible({ timeout: 8000 });

    await page
      .getByRole('button')
      .filter({ hasText: 'Por calificar' })
      .first()
      .click();
    await expect(page).toHaveURL(/\/grades/);
    await expect(
      page.getByRole('heading', { name: 'Calificaciones' }),
    ).toBeVisible({ timeout: 8000 });
  });
});
