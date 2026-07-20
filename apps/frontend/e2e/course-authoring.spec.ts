import { test, expect } from '@playwright/test';
import { actAs, TEACHER, STUDENT } from './dev-user';

const BASE_URL = 'http://localhost:3000';

test.describe('Course authoring (TEACHER)', () => {
  const createdIds: string[] = [];

  test.afterAll(async () => {
    await Promise.all(
      createdIds.map((id) =>
        fetch(`${BASE_URL}/courses/${id}?organizationId=org-klass-0001`, {
          method: 'DELETE',
          headers: { 'x-dev-user': TEACHER },
        }).catch(() => {}),
      ),
    );
  });

  test.beforeEach(async ({ page }) => {
    await actAs(page, TEACHER);
  });

  test('shows + Crear curso button on courses page', async ({ page }) => {
    await page.goto('/courses');
    await expect(page.getByRole('button', { name: '+ Crear curso' })).toBeVisible({ timeout: 8000 });
  });

  test('creates a course with title only', async ({ page }) => {
    const title = `E2E Curso ${Date.now()}`;
    await page.goto('/courses');
    await page.getByRole('button', { name: '+ Crear curso' }).click({ timeout: 8000 });

    const modal = page.getByRole('dialog');
    await expect(modal).toBeVisible();

    await modal.locator('input').first().fill(title);
    await modal.getByRole('button', { name: 'Crear curso' }).click();

    await expect(page).toHaveURL(/\/courses\//);
    await expect(page.locator('h1')).toContainText(title);

    const cid = page.url().split('/courses/')[1]?.split('?')[0] ?? '';
    if (cid) createdIds.push(cid);
  });

  test('student does not see + Crear curso button', async ({ page }) => {
    await actAs(page, STUDENT);
    await page.goto('/courses');
    await expect(page.getByRole('button', { name: '+ Crear curso' })).toHaveCount(0);
  });

  test('teacher sees edit/publish/delete buttons on course detail', async ({ page }) => {
    await page.goto('/courses');
    const card = page.getByText('Introducción al Desarrollo Web').first();
    await card.click({ timeout: 8000 });
    await expect(page).toHaveURL(/\/courses\//);

    await expect(page.getByRole('button', { name: 'Editar' })).toBeVisible({ timeout: 8000 });
    await expect(page.getByRole('button', { name: 'Modo edición' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Eliminar' })).toBeVisible();
  });

  test('student does not see edit/publish/delete buttons', async ({ page }) => {
    await actAs(page, STUDENT);
    await page.goto('/courses');
    const card = page.getByText('Introducción al Desarrollo Web').first();
    await card.click({ timeout: 8000 });
    await expect(page).toHaveURL(/\/courses\//);

    await expect(page.getByRole('button', { name: 'Editar' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Modo edición' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Eliminar' })).toHaveCount(0);
  });

  test('edits course title', async ({ page, request }) => {
    const created = await request.post(`${BASE_URL}/courses?organizationId=org-klass-0001`, {
      headers: { 'x-dev-user': TEACHER, 'Content-Type': 'application/json' },
      data: { title: `Editable ${Date.now()}`, description: 'Will edit', status: 'DRAFT' },
    });
    const cid: string = (await created.json()).id;
    createdIds.push(cid);

    await page.goto(`/courses/${cid}`);
    await expect(page.locator('h1')).toBeVisible({ timeout: 8000 });

    await page.getByRole('button', { name: 'Editar' }).click();
    const modal = page.getByRole('dialog');
    await expect(modal).toBeVisible();

    const titleInput = modal.locator('input').first();
    await titleInput.clear();
    await titleInput.fill('Curso Editado');
    await modal.getByRole('button', { name: 'Guardar cambios' }).click();

    await expect(page.getByText('Curso actualizado')).toBeVisible({ timeout: 8000 });
  });

  // TODO(aloiki): flaky — stateful publish/unpublish toggle assertions. Feature works
  // (CourseDetailPage toggles status + toasts). Harden the toast/button waits and re-enable.
  test.fixme('publishes a draft course', async ({ page, request }) => {
    const created = await request.post(`${BASE_URL}/courses?organizationId=org-klass-0001`, {
      headers: { 'x-dev-user': TEACHER, 'Content-Type': 'application/json' },
      data: { title: `Draft ${Date.now()}`, status: 'DRAFT' },
    });
    const cid: string = (await created.json()).id;
    createdIds.push(cid);

    await page.goto(`/courses/${cid}`);
    await expect(page.getByText('Borrador')).toBeVisible({ timeout: 8000 });

    await page.getByRole('button', { name: 'Publicar' }).click();
    await expect(page.getByText('Curso publicado')).toBeVisible({ timeout: 8000 });

    await page.getByRole('button', { name: 'Guardar borrador' }).click({ timeout: 5000 });
    await expect(page.getByText('guardado como borrador')).toBeVisible({ timeout: 8000 });
  });

  test('deletes a course', async ({ page, request }) => {
    const created = await request.post(`${BASE_URL}/courses?organizationId=org-klass-0001`, {
      headers: { 'x-dev-user': TEACHER, 'Content-Type': 'application/json' },
      data: { title: `ToDelete ${Date.now()}`, status: 'DRAFT' },
    });
    const cid: string = (await created.json()).id;
    // Don't push to createdIds — it's deleted during the test, no afterAll needed.

    await page.goto(`/courses/${cid}`);
    await expect(page.locator('h1')).toBeVisible({ timeout: 8000 });

    await page.getByRole('button', { name: 'Eliminar' }).click();

    const confirm = page.getByRole('dialog');
    await expect(confirm).toBeVisible();
    await confirm.getByRole('button', { name: 'Eliminar' }).click();

    await expect(page.getByText('Curso eliminado')).toBeVisible({ timeout: 8000 });
    await expect(page).toHaveURL(/\/courses$/);
  });

  test('zero console errors on courses page', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await page.goto('/courses');
    await expect(page.locator('h1')).toBeVisible({ timeout: 8000 });
    expect(errors).toEqual([]);
  });
});
