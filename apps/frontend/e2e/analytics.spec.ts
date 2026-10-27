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
    const initialCount = `${initial.submissions.total}/${initial.submissions.expected} entregas`;
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

    const submittedCount = `${initial.submissions.total + 1}/${initial.submissions.expected} entregas`;
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
