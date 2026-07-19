import { test, expect } from '@playwright/test';

/**
 * A7 — Assignment authoring (teacher) + window enforcement (student).
 *
 * Runs as the seeded teacher (VITE_DEV_USER_ID=user-diego-001). The teacher
 * creates an assignment with a submission window already CLOSED and a resource
 * attachment, edits it, then we assert — at the API level, acting as the seeded
 * student — that a submission outside the window is rejected. Finally we delete
 * the assignment to keep the seed clean.
 */

const BASE_URL = 'http://localhost:3000';
const COURSE_ID = 'course-web-101';
const STUDENT = 'user-lucia-001';
const TEACHER = 'user-diego-001';

// A datetime-local string in the past → the assignment is born "Cerrada".
const PAST_CLOSE = '2000-01-01T10:00';

test.describe('A7 — Assignment authoring & window', () => {
  test('teacher creates (with resource) → closed badge → edits → student blocked → delete', async ({
    page,
  }) => {
    const title = `E2E ventana ${Date.now()}`;
    const edited = `${title} (editada)`;

    await page.goto('/assignments');
    // Scope to the seeded course.
    await page.getByLabel('Curso').selectOption(COURSE_ID);

    // ── Create ────────────────────────────────────────────────────────────
    await page.getByRole('button', { name: '+ Nueva tarea' }).click();
    await page.getByLabel('Título').fill(title);
    await page.getByLabel('Descripción').fill('Tarea de prueba E2E.');
    await page.getByLabel('Cierre').fill(PAST_CLOSE);

    // Attach a teacher resource through the shared FileUpload.
    await page.locator('input[type="file"]').setInputFiles({
      name: 'recurso.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('contenido del recurso'),
    });
    await expect(page.getByText('Subido')).toBeVisible({ timeout: 10000 });

    await page.getByRole('button', { name: 'Crear tarea' }).click();

    // The new assignment is selected and shows the "Cerrada" badge + resource.
    await expect(
      page.getByRole('heading', { level: 2, name: title }),
    ).toBeVisible({ timeout: 8000 });
    await expect(page.getByText('Cerrada').first()).toBeVisible();
    await expect(page.getByText('Recursos del profesor')).toBeVisible();
    await expect(page.getByText('recurso.txt')).toBeVisible();

    // ── Edit ──────────────────────────────────────────────────────────────
    await page.getByRole('button', { name: 'Editar' }).click();
    const modalTitle = page.getByLabel('Título');
    await modalTitle.fill(edited);
    await page.getByRole('button', { name: 'Guardar cambios' }).click();
    await expect(
      page.getByRole('heading', { level: 2, name: edited }),
    ).toBeVisible({ timeout: 8000 });

    // Resolve the assignment id for the API-level checks below.
    const assignments = await page.evaluate(
      async ({ base, course, teacher }) => {
        const res = await fetch(`${base}/courses/${course}/assignments`, {
          headers: { 'x-dev-user': teacher },
        });
        return (await res.json()) as Array<{ id: string; title: string }>;
      },
      { base: BASE_URL, course: COURSE_ID, teacher: TEACHER },
    );
    const created = assignments.find((a) => a.title === edited);
    expect(created).toBeTruthy();
    const assignmentId = created!.id;

    // ── Window enforcement (student, via API) ─────────────────────────────
    const status = await page.evaluate(
      async ({ base, id, student }) => {
        const res = await fetch(`${base}/assignments/${id}/submissions`, {
          method: 'POST',
          headers: {
            'x-dev-user': student,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ text: 'fuera de plazo', status: 'SUBMITTED' }),
        });
        return res.status;
      },
      { base: BASE_URL, id: assignmentId, student: STUDENT },
    );
    expect(status).toBe(400); // "La tarea está cerrada"

    // ── Delete (cleanup) ──────────────────────────────────────────────────
    await page.getByRole('button', { name: 'Borrar' }).click();
    await page
      .getByRole('button', { name: 'Borrar', exact: true })
      .last()
      .click();
    await expect(
      page.getByRole('heading', { level: 2, name: edited }),
    ).toHaveCount(0, { timeout: 8000 });
  });
});
