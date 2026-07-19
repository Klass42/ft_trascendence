import { test, expect } from '@playwright/test';

/**
 * A4-teacher — TeacherDashboard with real data (no mock).
 *
 * Runs as the seeded teacher (VITE_DEV_USER_ID=user-diego-001). Setup (via API):
 * the teacher creates a fresh open assignment and the student submits it, so an
 * ungraded submission exists. We then assert the dashboard renders real figures
 * and that "Por calificar" leads to the gradebook. Teardown deletes the
 * assignment (cascades the submission) to keep the seed clean.
 */

const BASE_URL = 'http://localhost:3000';
const COURSE_ID = 'course-web-101';
const TEACHER = 'user-diego-001';
const STUDENT = 'user-lucia-001';

test.describe('A4-teacher — TeacherDashboard (real data)', () => {
  const title = `E2E panel ${Date.now()}`;
  let assignmentId = '';

  test.beforeAll(async ({ request }) => {
    const created = await request.post(
      `${BASE_URL}/courses/${COURSE_ID}/assignments`,
      {
        headers: { 'x-dev-user': TEACHER, 'Content-Type': 'application/json' },
        data: { title },
      },
    );
    assignmentId = (await created.json()).id;

    await request.post(`${BASE_URL}/assignments/${assignmentId}/submissions`, {
      headers: { 'x-dev-user': STUDENT, 'Content-Type': 'application/json' },
      data: { text: 'Entrega para el panel', status: 'SUBMITTED' },
    });
  });

  test.afterAll(async ({ request }) => {
    if (assignmentId) {
      await request.delete(`${BASE_URL}/assignments/${assignmentId}`, {
        headers: { 'x-dev-user': TEACHER },
      });
    }
  });

  test('shows real figures and "Por calificar" opens the gradebook', async ({
    page,
  }) => {
    await page.goto('/dashboard');

    // Header + stat cards (real, not the old "142" mock).
    await expect(page.getByText('Profesor')).toBeVisible();
    await expect(page.getByText('Cursos activos')).toBeVisible({ timeout: 8000 });
    await expect(page.getByText('Alumnos totales')).toBeVisible();
    await expect(page.getByText('142')).toHaveCount(0);

    // The pending list shows the just-created submission.
    await expect(page.getByText('Entregas por calificar')).toBeVisible();
    await expect(page.getByText(title).first()).toBeVisible({ timeout: 8000 });

    // Clicking "Por calificar" opens the gradebook.
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
