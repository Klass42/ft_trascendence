import { test, expect, type APIRequestContext, type Page } from '@playwright/test';
import { actAs, ADMIN, TEACHER, STUDENT } from './dev-user';

const BASE_URL = 'http://localhost:3000';
const ORG = 'org-klass-0001';
const COHORT = 'course-klass-2025';
const q = `organizationId=${ORG}`;

const json = (user: string) => ({ 'x-dev-user': user, 'Content-Type': 'application/json' });

/**
 * A fresh subject per test: subjects are admin-only to create, so ADMIN makes
 * it and assigns Diego as its TEACHER. No test depends on another's leftovers.
 */
async function createSubject(
  request: APIRequestContext,
  status: 'DRAFT' | 'PUBLISHED' = 'DRAFT',
): Promise<{ id: string; title: string }> {
  const title = `ContentBuilder ${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const created = await request.post(`${BASE_URL}/courses/${COHORT}/subjects?${q}`, {
    headers: json(ADMIN),
    data: { title, status },
  });
  expect(created.ok(), await created.text()).toBeTruthy();
  const { id } = await created.json();

  const staff = await request.post(`${BASE_URL}/subjects/${id}/staff?${q}`, {
    headers: json(ADMIN),
    data: { userId: TEACHER, role: 'TEACHER' },
  });
  expect(staff.ok(), await staff.text()).toBeTruthy();
  return { id, title };
}

async function addSection(request: APIRequestContext, subjectId: string, title: string, order: number) {
  const res = await request.post(`${BASE_URL}/subjects/${subjectId}/sections?${q}`, {
    headers: json(TEACHER),
    data: { title, order },
  });
  expect(res.ok(), await res.text()).toBeTruthy();
  return (await res.json()).id as string;
}

async function addLesson(request: APIRequestContext, sectionId: string, title: string, order: number) {
  const res = await request.post(`${BASE_URL}/sections/${sectionId}/lessons?${q}`, {
    headers: json(TEACHER),
    data: { title, order },
  });
  expect(res.ok(), await res.text()).toBeTruthy();
  return (await res.json()).id as string;
}

async function sectionsOf(request: APIRequestContext, subjectId: string) {
  const res = await request.get(`${BASE_URL}/subjects/${subjectId}/sections?${q}`, {
    headers: { 'x-dev-user': TEACHER },
  });
  expect(res.ok()).toBeTruthy();
  return (await res.json()) as { id: string; title: string; lessons: { id: string; title: string }[] }[];
}

async function attachmentsOf(request: APIRequestContext, lessonId: string) {
  const res = await request.get(`${BASE_URL}/lessons/${lessonId}?${q}`, {
    headers: { 'x-dev-user': TEACHER },
  });
  expect(res.ok()).toBeTruthy();
  return ((await res.json()).attachments ?? []) as { file: { originalName: string } }[];
}

async function openEditor(page: Page, subjectId: string) {
  await page.goto(`/courses/${COHORT}/subjects/${subjectId}`);
  await page.getByRole('button', { name: 'Modo edición' }).click({ timeout: 8000 });
  await expect(page.getByText('Estructura de la asignatura')).toBeVisible();
}

const sectionCard = (page: Page, title: string) =>
  page.getByTestId('section-editor').filter({
    has: page.getByTestId('section-title').getByText(title, { exact: true }),
  });

const lessonRow = (page: Page, title: string) =>
  page.getByTestId('lesson-row').filter({
    has: page.getByTestId('lesson-title').getByText(title, { exact: true }),
  });

const PDF = { name: 'apuntes.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4\napuntes de clase\n') };

test.describe('Content builder (TEACHER)', () => {
  let subject = { id: '', title: '' };

  test.beforeEach(async ({ page, request }, testInfo) => {
    const status = testInfo.title.includes('[published]') ? 'PUBLISHED' : 'DRAFT';
    subject = await createSubject(request, status);
    await actAs(page, TEACHER);
  });

  test.afterEach(async ({ request }) => {
    if (subject.id) {
      // Cascades sections, lessons and attachment links.
      await request.delete(`${BASE_URL}/subjects/${subject.id}?${q}`, { headers: { 'x-dev-user': ADMIN } });
    }
  });

  test('teacher sees Modo edición button', async ({ page }) => {
    await page.goto(`/courses/${COHORT}/subjects/${subject.id}`);
    await expect(page.getByRole('button', { name: 'Modo edición' })).toBeVisible({ timeout: 8000 });
  });

  test('student does not see Modo edición button [published]', async ({ page }) => {
    await actAs(page, STUDENT);
    await page.goto(`/courses/${COHORT}/subjects/${subject.id}`);
    // The page itself renders for the student; only the edit toggle is missing.
    await expect(page.getByRole('heading', { name: subject.title })).toBeVisible({ timeout: 8000 });
    await expect(page.getByRole('button', { name: 'Modo edición' })).toHaveCount(0);
  });

  test('adds a section', async ({ page, request }) => {
    await openEditor(page, subject.id);

    await page.getByRole('button', { name: '+ Añadir sección' }).click();
    await page.getByLabel('Título de la sección').fill('Sección 1');
    await page.getByRole('button', { name: 'Crear', exact: true }).click();

    await expect(page.getByText('Sección creada')).toBeVisible({ timeout: 8000 });
    await expect(sectionCard(page, 'Sección 1')).toBeVisible();
    expect((await sectionsOf(request, subject.id)).map((s) => s.title)).toEqual(['Sección 1']);
  });

  test('renames a section', async ({ page, request }) => {
    await addSection(request, subject.id, 'Renombrar', 1);
    await openEditor(page, subject.id);

    await sectionCard(page, 'Renombrar').getByRole('button', { name: 'Renombrar', exact: true }).click();
    const renameInput = page.getByLabel('Nuevo título de la sección');
    await expect(renameInput).toBeFocused();
    await renameInput.fill('Renombrada');
    await page.getByRole('button', { name: 'Guardar' }).click();

    await expect(page.getByText('Sección renombrada')).toBeVisible({ timeout: 8000 });
    await expect(sectionCard(page, 'Renombrada')).toBeVisible();
    await expect(sectionCard(page, 'Renombrar')).toHaveCount(0);
    expect((await sectionsOf(request, subject.id)).map((s) => s.title)).toEqual(['Renombrada']);
  });

  test('adds a lesson to a section', async ({ page, request }) => {
    await addSection(request, subject.id, 'Con lección', 1);
    await openEditor(page, subject.id);

    const section = sectionCard(page, 'Con lección');
    await section.getByRole('button', { name: '+ Añadir lección' }).click();
    await section.getByLabel('Título de la lección').fill('Mi lección');
    await section.getByRole('button', { name: 'Crear', exact: true }).click();

    await expect(page.getByText('Lección creada')).toBeVisible({ timeout: 8000 });
    await expect(lessonRow(page, 'Mi lección')).toBeVisible();
    const [saved] = await sectionsOf(request, subject.id);
    expect(saved.lessons.map((l) => l.title)).toEqual(['Mi lección']);
  });

  test('edits a lesson title, content, and video', async ({ page, request }) => {
    const sectionId = await addSection(request, subject.id, 'Edit', 1);
    const lessonId = await addLesson(request, sectionId, 'Mi lección', 1);
    await openEditor(page, subject.id);

    await lessonRow(page, 'Mi lección').getByRole('button', { name: 'Editar' }).click();
    await page.getByLabel('Título', { exact: true }).fill('Lección editada');
    await page.getByLabel('Contenido (Markdown)').fill('# Nuevo contenido');
    await page.getByLabel('URL del video').fill('https://youtube.com/watch?v=dQw4w9WgXcQ');
    await page.getByRole('button', { name: 'Guardar' }).click();

    await expect(page.getByText('Lección actualizada')).toBeVisible({ timeout: 8000 });
    await expect(lessonRow(page, 'Lección editada')).toBeVisible();

    const res = await request.get(`${BASE_URL}/lessons/${lessonId}?${q}`, { headers: { 'x-dev-user': TEACHER } });
    const lesson = await res.json();
    expect(lesson).toMatchObject({
      title: 'Lección editada',
      contentMd: '# Nuevo contenido',
      videoUrl: 'https://youtube.com/watch?v=dQw4w9WgXcQ',
    });
  });

  test('rejects a lesson video that is not an https URL', async ({ page, request }) => {
    const sectionId = await addSection(request, subject.id, 'Video', 1);
    await addLesson(request, sectionId, 'Mi lección', 1);
    await openEditor(page, subject.id);

    await lessonRow(page, 'Mi lección').getByRole('button', { name: 'Editar' }).click();
    await page.getByLabel('URL del video').fill('no-es-url');

    await expect(page.getByText('Introduce una URL válida que empiece por https://')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Guardar' })).toBeDisabled();
  });

  test('deletes a lesson', async ({ page, request }) => {
    const sectionId = await addSection(request, subject.id, 'Lecciones', 1);
    await addLesson(request, sectionId, 'Se queda', 1);
    await addLesson(request, sectionId, 'Para borrar', 2);
    await openEditor(page, subject.id);

    await lessonRow(page, 'Para borrar').getByRole('button', { name: 'Eliminar' }).click();
    const confirm = page.getByRole('dialog');
    await expect(confirm).toBeVisible();
    await confirm.getByRole('button', { name: 'Eliminar' }).click();

    await expect(page.getByText('Lección eliminada')).toBeVisible({ timeout: 8000 });
    await expect(lessonRow(page, 'Para borrar')).toHaveCount(0);
    await expect(lessonRow(page, 'Se queda')).toBeVisible();
    const [saved] = await sectionsOf(request, subject.id);
    expect(saved.lessons.map((l) => l.title)).toEqual(['Se queda']);
  });

  test('deletes a section', async ({ page, request }) => {
    await addSection(request, subject.id, 'Se queda', 1);
    await addSection(request, subject.id, 'Para borrar', 2);
    await openEditor(page, subject.id);

    await sectionCard(page, 'Para borrar').getByRole('button', { name: 'Eliminar' }).click();
    const confirm = page.getByRole('dialog');
    await expect(confirm).toBeVisible();
    await confirm.getByRole('button', { name: 'Eliminar' }).click();

    await expect(page.getByText('Sección eliminada')).toBeVisible({ timeout: 8000 });
    await expect(sectionCard(page, 'Para borrar')).toHaveCount(0);
    await expect(sectionCard(page, 'Se queda')).toBeVisible();
    expect((await sectionsOf(request, subject.id)).map((s) => s.title)).toEqual(['Se queda']);
  });

  test('reorders sections with the up/down buttons', async ({ page, request }) => {
    for (const [i, title] of ['A', 'B', 'C'].entries()) {
      await addSection(request, subject.id, `Sección ${title}`, i + 1);
    }
    await openEditor(page, subject.id);
    const titles = page.getByTestId('section-title');
    await expect(titles).toHaveText(['Sección A', 'Sección B', 'Sección C']);

    // Ends are disabled: the first can't go up, the last can't go down.
    await expect(page.getByRole('button', { name: 'Subir sección Sección A' })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Bajar sección Sección C' })).toBeDisabled();

    await page.getByRole('button', { name: 'Bajar sección Sección A' }).click();
    await expect(page.getByText('Orden de secciones actualizado')).toBeVisible({ timeout: 8000 });
    await expect(titles).toHaveText(['Sección B', 'Sección A', 'Sección C']);

    await page.getByRole('button', { name: 'Subir sección Sección C' }).click();
    await expect(titles).toHaveText(['Sección B', 'Sección C', 'Sección A']);

    expect((await sectionsOf(request, subject.id)).map((s) => s.title))
      .toEqual(['Sección B', 'Sección C', 'Sección A']);

    // Persisted: survives a reload.
    await openEditor(page, subject.id);
    await expect(titles).toHaveText(['Sección B', 'Sección C', 'Sección A']);
  });

  test('reorders lessons inside a section', async ({ page, request }) => {
    const sectionId = await addSection(request, subject.id, 'Unidad', 1);
    for (const [i, title] of ['Uno', 'Dos', 'Tres'].entries()) {
      await addLesson(request, sectionId, title, i + 1);
    }
    await openEditor(page, subject.id);
    const titles = sectionCard(page, 'Unidad').getByTestId('lesson-title');
    await expect(titles).toHaveText(['Uno', 'Dos', 'Tres']);

    await expect(page.getByRole('button', { name: 'Subir lección Uno' })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Bajar lección Tres' })).toBeDisabled();

    await page.getByRole('button', { name: 'Subir lección Tres' }).click();
    await expect(page.getByText('Orden de lecciones actualizado')).toBeVisible({ timeout: 8000 });
    await expect(titles).toHaveText(['Uno', 'Tres', 'Dos']);

    const [saved] = await sectionsOf(request, subject.id);
    expect(saved.lessons.map((l) => l.title)).toEqual(['Uno', 'Tres', 'Dos']);
  });

  test('attaches and detaches a file on a lesson', async ({ page, request }) => {
    const sectionId = await addSection(request, subject.id, 'Material', 1);
    const lessonId = await addLesson(request, sectionId, 'Con adjunto', 1);
    await openEditor(page, subject.id);

    await lessonRow(page, 'Con adjunto').getByRole('button', { name: 'Editar' }).click();
    await expect(page.getByText('Esta lección no tiene adjuntos.')).toBeVisible({ timeout: 8000 });

    await page.locator('input[type="file"]').setInputFiles(PDF);
    await expect(page.getByText('Adjunto "apuntes.pdf" añadido')).toBeVisible({ timeout: 8000 });
    await expect(page.getByTestId('lesson-attachment')).toHaveText(/apuntes\.pdf/);
    expect((await attachmentsOf(request, lessonId)).map((a) => a.file.originalName)).toEqual(['apuntes.pdf']);

    await page.getByRole('button', { name: 'Quitar adjunto apuntes.pdf' }).click();
    const confirm = page.getByRole('dialog');
    await expect(confirm).toContainText('¿Quitar "apuntes.pdf" de esta lección?');
    await confirm.getByRole('button', { name: 'Quitar' }).click();

    await expect(page.getByText('Adjunto eliminado')).toBeVisible({ timeout: 8000 });
    await expect(page.getByTestId('lesson-attachment')).toHaveCount(0);
    await expect(page.getByText('Esta lección no tiene adjuntos.')).toBeVisible();
    expect(await attachmentsOf(request, lessonId)).toEqual([]);
  });

  test('rejects disallowed attachments in the browser and on the server', async ({ page, request }) => {
    const sectionId = await addSection(request, subject.id, 'Material', 1);
    const lessonId = await addLesson(request, sectionId, 'Sin virus', 1);
    await openEditor(page, subject.id);
    await lessonRow(page, 'Sin virus').getByRole('button', { name: 'Editar' }).click();

    // Client: the extension is refused before any upload.
    await page.locator('input[type="file"]').setInputFiles({
      name: 'virus.exe', mimeType: 'application/x-msdownload', buffer: Buffer.from('MZ\x90\x00'),
    });
    await expect(page.getByText(/Tipo de archivo no permitido \(\.exe\)/)).toBeVisible();

    // Server: an executable dressed up as a PDF is refused by content sniffing.
    const spoofed = await request.post(`${BASE_URL}/files`, {
      headers: { 'x-dev-user': TEACHER },
      multipart: {
        organizationId: ORG,
        file: { name: 'notes.pdf', mimeType: 'application/pdf', buffer: Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03]) },
      },
    });
    expect(spoofed.status()).toBe(400);
    expect((await spoofed.json()).message).toBe('El contenido del archivo no coincide con su tipo.');

    expect(await attachmentsOf(request, lessonId)).toEqual([]);
  });

  test('student sees a teacher-added attachment on the lesson page [published]', async ({ page, request }) => {
    const sectionId = await addSection(request, subject.id, 'Unidad 1', 1);
    const lessonId = await addLesson(request, sectionId, 'Lección con material', 1);
    await openEditor(page, subject.id);
    await lessonRow(page, 'Lección con material').getByRole('button', { name: 'Editar' }).click();
    await page.locator('input[type="file"]').setInputFiles(PDF);
    await expect(page.getByText('Adjunto "apuntes.pdf" añadido')).toBeVisible({ timeout: 8000 });

    await actAs(page, STUDENT);
    await page.goto(`/courses/${COHORT}/subjects/${subject.id}/lessons/${lessonId}`);
    await expect(page.getByRole('heading', { name: 'Lección con material' })).toBeVisible({ timeout: 8000 });
    await expect(page.getByRole('heading', { name: 'Adjuntos' })).toBeVisible();

    // Opening it resolves the file's download URL and opens it in a new tab.
    await page.evaluate(() => {
      const w = window as unknown as { __opened: string[] };
      w.__opened = [];
      window.open = ((url?: string | URL) => { w.__opened.push(String(url)); return null; }) as typeof window.open;
    });
    await page.getByRole('button', { name: 'Abrir adjunto apuntes.pdf' }).click();
    await expect.poll(() => page.evaluate(() => (window as unknown as { __opened: string[] }).__opened.length)).toBe(1);
    const [opened] = await page.evaluate(() => (window as unknown as { __opened: string[] }).__opened);
    // Both storage drivers use a short-lived signed backend content URL.
    expect(opened).toMatch(/\/api\/files\/[^/]+\/content\?/);
    const file = await page.request.get(new URL(opened, page.url()).toString());
    expect(file.ok()).toBeTruthy();
    expect((await file.body()).equals(PDF.buffer)).toBeTruthy();
  });

  test('zero console errors on content builder', async ({ page, request }) => {
    const sectionId = await addSection(request, subject.id, 'Consola', 1);
    await addLesson(request, sectionId, 'Sin errores', 1);

    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });

    await openEditor(page, subject.id);
    await lessonRow(page, 'Sin errores').getByRole('button', { name: 'Editar' }).click();
    await expect(page.getByText('Esta lección no tiene adjuntos.')).toBeVisible({ timeout: 8000 });
    expect(errors).toEqual([]);
  });
});
