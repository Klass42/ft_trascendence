import { test, expect } from '@playwright/test';
import { actAs, ADMIN, TEACHER, STUDENT } from './dev-user';

const BASE_URL = 'http://localhost:3000';
const ORG = 'org-klass-0001';
const COHORT = 'course-klass-2025';
const q = `organizationId=${ORG}`;
const adminJson = { 'x-dev-user': ADMIN, 'Content-Type': 'application/json' };

test.describe('Course authoring (TEACHER)', () => {
  test.beforeEach(async ({ page }) => {
    await actAs(page, TEACHER);
  });

  test('teacher does not see + Crear curso (only organization admins do)', async ({ page }) => {
    await page.goto('/courses');
    await expect(page.getByRole('button', { name: '+ Crear curso' })).toHaveCount(0);
  });

  test('student does not see + Crear curso button', async ({ page }) => {
    await actAs(page, STUDENT);
    await page.goto('/courses');
    await expect(page.getByRole('button', { name: '+ Crear curso' })).toHaveCount(0);
  });

  test('teacher can edit content but not the subject record', async ({ page }) => {
    await page.goto('/courses/course-klass-2025/subjects/course-web-101');
    await expect(page.getByRole('button', { name: 'Modo edición' })).toBeVisible({ timeout: 8000 });
    await expect(page.getByRole('button', { name: 'Editar' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Eliminar' })).toHaveCount(0);
  });

  test('student does not see edit/publish/delete buttons', async ({ page }) => {
    await actAs(page, STUDENT);
    await page.goto('/courses/course-klass-2025/subjects/course-web-101');

    await expect(page.getByRole('button', { name: 'Editar' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Modo edición' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Eliminar' })).toHaveCount(0);
  });

  test('zero console errors on courses page', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await page.goto('/courses');
    await expect(page.locator('h1')).toBeVisible({ timeout: 8000 });
    expect(errors).toEqual([]);
  });
});

// Courses (cohorts) and their subjects are created, edited, published and
// deleted by organization admins only.
test.describe('Course authoring (ADMIN)', () => {
  const createdCourses: string[] = [];
  const createdSubjects: string[] = [];

  test.beforeEach(async ({ page }) => {
    await actAs(page, ADMIN);
  });

  test.afterAll(async ({ request }) => {
    for (const id of createdSubjects) {
      await request.delete(`${BASE_URL}/subjects/${id}?${q}`, { headers: { 'x-dev-user': ADMIN } });
    }
    for (const id of createdCourses) {
      await request.delete(`${BASE_URL}/courses/${id}?${q}`, { headers: { 'x-dev-user': ADMIN } });
    }
  });

  async function createSubject(
    request: import('@playwright/test').APIRequestContext,
    title: string,
    status: 'DRAFT' | 'PUBLISHED' = 'DRAFT',
  ): Promise<string> {
    const res = await request.post(`${BASE_URL}/courses/${COHORT}/subjects?${q}`, {
      headers: adminJson,
      data: { title, description: 'E2E', status },
    });
    expect(res.ok(), await res.text()).toBeTruthy();
    const { id } = await res.json();
    createdSubjects.push(id);
    return id;
  }

  async function subjectStatus(request: import('@playwright/test').APIRequestContext, id: string) {
    const res = await request.get(`${BASE_URL}/subjects/${id}?${q}`, { headers: { 'x-dev-user': ADMIN } });
    return (await res.json()).status as string;
  }

  test('creates a course with a name', async ({ page }) => {
    const name = `E2E Curso ${Date.now()}`;
    await page.goto('/courses');
    await page.getByRole('button', { name: '+ Crear curso' }).click({ timeout: 8000 });

    const modal = page.getByRole('dialog');
    await expect(modal).toBeVisible();

    // Client validation: the name is required.
    await modal.getByRole('button', { name: 'Crear curso' }).click();
    await expect(modal.getByText('El nombre es obligatorio')).toBeVisible();

    await modal.getByLabel('Nombre').fill(name);
    await modal.getByRole('button', { name: 'Crear curso' }).click();

    await expect(page.getByText('Curso creado correctamente')).toBeVisible({ timeout: 8000 });
    await expect(page).toHaveURL(/\/courses\/[^/]+$/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(name);

    const id = new URL(page.url()).pathname.split('/').pop() ?? '';
    if (id) createdCourses.push(id);
  });

  test('edits course title', async ({ page, request }) => {
    const id = await createSubject(request, `Editable ${Date.now()}`);
    await page.goto(`/courses/${COHORT}/subjects/${id}`);
    await page.getByRole('button', { name: 'Editar', exact: true }).click({ timeout: 8000 });

    const modal = page.getByRole('dialog');
    await expect(modal).toBeVisible();
    await modal.getByLabel('Título').fill('Curso Editado');
    await modal.getByRole('button', { name: 'Guardar cambios' }).click();

    await expect(page.getByText('Curso actualizado')).toBeVisible({ timeout: 8000 });
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Curso Editado');
  });

  test('publishes a draft course and saves it back as a draft', async ({ page, request }) => {
    const id = await createSubject(request, `Draft ${Date.now()}`);
    await page.goto(`/courses/${COHORT}/subjects/${id}`);
    await expect(page.getByText('Borrador', { exact: true })).toBeVisible({ timeout: 8000 });

    await page.getByRole('button', { name: 'Publicar' }).click();
    await expect(page.getByText('Curso publicado')).toBeVisible({ timeout: 8000 });
    // The page reflects the new status without a reload.
    await expect(page.getByRole('button', { name: 'Guardar borrador' })).toBeVisible();
    await expect(page.getByText('Borrador', { exact: true })).toHaveCount(0);
    expect(await subjectStatus(request, id)).toBe('PUBLISHED');

    await page.getByRole('button', { name: 'Guardar borrador' }).click();
    await expect(page.getByText('Curso guardado como borrador')).toBeVisible({ timeout: 8000 });
    await expect(page.getByRole('button', { name: 'Publicar' })).toBeVisible();
    expect(await subjectStatus(request, id)).toBe('DRAFT');
  });

  test('deletes a course', async ({ page, request }) => {
    const id = await createSubject(request, `ToDelete ${Date.now()}`);
    await page.goto(`/courses/${COHORT}/subjects/${id}`);
    await page.getByRole('button', { name: 'Eliminar', exact: true }).click({ timeout: 8000 });

    const confirm = page.getByRole('dialog');
    await expect(confirm).toBeVisible();
    await confirm.getByRole('button', { name: 'Eliminar' }).click();

    await expect(page.getByText('Curso eliminado')).toBeVisible({ timeout: 8000 });
    await expect(page).toHaveURL(new RegExp(`/courses/${COHORT}$`));
    const gone = await request.get(`${BASE_URL}/subjects/${id}?${q}`, { headers: { 'x-dev-user': ADMIN } });
    expect(gone.status()).toBe(404);
  });
});
