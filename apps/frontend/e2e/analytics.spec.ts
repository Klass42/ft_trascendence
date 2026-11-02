import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { actAs, STUDENT, TEACHER } from './dev-user';

const BASE_URL = 'http://localhost:3000';
const COURSE_ID = 'course-web-101';

test('analytics KPIs update live after an attempt is submitted and graded', async ({
  page,
  request,
}) => {
  await actAs(page, TEACHER);
  const headers = (userId: string) => ({
    'x-dev-user': userId,
    'Content-Type': 'application/json',
  });
  let activityId: string | null = null;
  let mainFrameNavigations = 0;
  page.on('framenavigated', (frame) => {
    if (frame === page.mainFrame()) mainFrameNavigations += 1;
  });

  try {
    const created = await request.post(`${BASE_URL}/subjects/${COURSE_ID}/activities`, {
      headers: headers(TEACHER),
      data: { title: `E2E analíticas ${Date.now()}`, type: 'QUIZ' },
    });
    expect(created.ok()).toBeTruthy();
    activityId = ((await created.json()) as { id: string }).id;

    const questionResponse = await request.post(
      `${BASE_URL}/activities/${activityId}/questions`,
      {
        headers: headers(TEACHER),
        data: { kind: 'ESSAY', prompt: 'Explica tu respuesta.', points: 10, content: {} },
      },
    );
    expect(questionResponse.ok()).toBeTruthy();
    const questionId = ((await questionResponse.json()) as { id: string }).id;

    const published = await request.patch(`${BASE_URL}/activities/${activityId}`, {
      headers: headers(TEACHER),
      data: { status: 'PUBLISHED' },
    });
    expect(published.ok()).toBeTruthy();

    const initialResponse = await request.get(
      `${BASE_URL}/subjects/${COURSE_ID}/analytics/overview`,
      { headers: headers(TEACHER) },
    );
    expect(initialResponse.ok()).toBeTruthy();
    const initial = (await initialResponse.json()) as {
      submissions: { total: number; expected: number; graded: number };
    };

    const socketReady = page.waitForEvent('websocket', (socket) =>
      socket.url().includes('/socket.io/'),
    );
    await page.goto('/analytics');
    await socketReady;
    await page.getByRole('combobox', { name: 'Asignatura' }).selectOption(COURSE_ID);
    // The dashboard opens on the last 30 days; the baseline above is unfiltered.
    await page.getByRole('button', { name: 'Quitar filtros' }).click();
    const initialCount = `${initial.submissions.total} de ${initial.submissions.expected} entregas`;
    await expect(page.getByText(initialCount, { exact: true })).toBeVisible();
    const navigationCount = mainFrameNavigations;

    const started = await request.post(
      `${BASE_URL}/activities/${activityId}/attempts`,
      { headers: headers(STUDENT) },
    );
    expect(started.ok()).toBeTruthy();
    const attemptId = ((await started.json()) as { id: string }).id;
    const saved = await request.patch(`${BASE_URL}/attempts/${attemptId}`, {
      headers: headers(STUDENT),
      data: { answers: [{ questionId, response: { text: 'Respuesta enviada' } }] },
    });
    expect(saved.ok()).toBeTruthy();
    const submitted = await request.post(`${BASE_URL}/attempts/${attemptId}/submit`, {
      headers: headers(STUDENT),
    });
    expect(submitted.ok()).toBeTruthy();

    const submittedCount = `${initial.submissions.total + 1} de ${initial.submissions.expected} entregas`;
    await expect(page.getByText(submittedCount, { exact: true })).toBeVisible({ timeout: 8000 });

    const graded = await request.patch(`${BASE_URL}/attempts/${attemptId}/grade`, {
      headers: headers(TEACHER),
      data: { answers: [{ questionId, awarded: 8 }], feedback: 'Buen trabajo.' },
    });
    expect(graded.ok()).toBeTruthy();
    await expect(page.getByText(`${initial.submissions.graded + 1} calificadas`, { exact: true }))
      .toBeVisible({ timeout: 8000 });
    expect(mainFrameNavigations).toBe(navigationCount);
    await expect(page).toHaveURL(/\/analytics$/);
  } finally {
    if (activityId) {
      await request.patch(`${BASE_URL}/activities/${activityId}`, {
        headers: headers(TEACHER),
        data: { status: 'ARCHIVED' },
      });
    }
  }
});

test('analytics filters drive KPIs and charts, and the PDF and CSV exports honour them', async ({
  page,
}) => {
  test.setTimeout(45_000);
  await actAs(page, TEACHER);
  await page.goto('/analytics');
  await page.getByRole('combobox', { name: 'Asignatura' }).selectOption(COURSE_ID);

  // The three charts are there; the range no longer claims to filter only one.
  await expect(page.getByRole('heading', { name: 'Entregas en el tiempo' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Distribución de notas' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Estado de entregas' })).toBeVisible();
  await expect(page.getByRole('group', { name: /^Estado de entregas sobre/ })).toBeVisible();
  await expect(page.getByText(/El rango filtra solo la gráfica/)).toHaveCount(0);

  // Changing the type refetches the KPIs, the histogram and the series with it.
  const overview = page.waitForResponse((r) =>
    r.url().includes('/analytics/overview') && r.url().includes('type=SPEAKING'));
  const distribution = page.waitForResponse((r) =>
    r.url().includes('/analytics/grade-distribution') && r.url().includes('type=SPEAKING'));
  const series = page.waitForResponse((r) =>
    r.url().includes('/analytics/submissions-over-time') && r.url().includes('type=SPEAKING'));
  await page.getByLabel('Tipo de actividad').selectOption('SPEAKING');
  for (const response of await Promise.all([overview, distribution, series])) {
    expect(response.ok()).toBeTruthy();
    expect(response.url()).toMatch(/from=\d{4}-\d{2}-\d{2}&to=\d{4}-\d{2}-\d{2}/);
  }

  // An over-long range is stopped in the UI before anything is requested.
  await page.getByLabel('Desde', { exact: true }).fill('2024-01-01');
  await page.getByLabel('Hasta', { exact: true }).fill('2026-12-31');
  await expect(page.getByText('El rango de fechas no puede superar 366 días.')).toBeVisible();
  await page.getByLabel('Desde', { exact: true }).fill('2026-01-01');
  await expect(page.getByRole('heading', { name: 'Estado de entregas' })).toBeVisible();

  const csvDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exportar CSV' }).click();
  const csv = await readFile((await (await csvDownload).path()) as string, 'utf8');
  expect(csv).toContain('Filtros,Tipo de actividad,Expresión oral');
  expect(csv).toContain('Filtros,Rango,2026-01-01 / 2026-12-31');

  // A real PDF file, not window.print().
  await expect(page.getByRole('button', { name: 'Descargar PDF' })).toBeEnabled();
  const pdfDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Descargar PDF' }).click();
  const download = await pdfDownload;
  expect(download.suggestedFilename()).toMatch(/^analiticas-.*\.pdf$/);
  const pdf = await readFile((await download.path()) as string);
  expect(pdf.subarray(0, 5).toString('latin1')).toBe('%PDF-');
  expect(pdf.length).toBeGreaterThan(5_000);
});
