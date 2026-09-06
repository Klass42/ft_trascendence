import { expect, test } from '@playwright/test';
import type { APIRequestContext } from '@playwright/test';

const password = 'demo1234';
const courseA = 'e2e-a-course-01';
const courseB = 'e2e-b-course-01';
const assignmentA = 'e2e-a-course-01-assignment-01';
const assignmentB = 'e2e-b-course-01-assignment-01';

type Login = { accessToken: string };

async function accessToken(
  request: APIRequestContext,
  organizationSlug: string,
  email: string,
): Promise<string> {
  const response = await request.post('/api/auth/login', {
    data: { organizationSlug, email, password },
  });
  expect(response.ok(), `login failed for ${email}`).toBeTruthy();
  return (await response.json() as Login).accessToken;
}

function bearer(token: string) {
  return { Authorization: `Bearer ${token}` };
}

test.describe('E2E tenant, RBAC, files and submissions — Compose over HTTPS', () => {
  test('E2E-TENANT-01/02 and E2E-RBAC-01: token-derived tenants reject foreign courses and student writes', async ({ request }) => {
    const [studentA, teacherA, studentB] = await Promise.all([
      accessToken(request, 'e2e-a', 'student001@e2e-a.demo'),
      accessToken(request, 'e2e-a', 'teacher001@e2e-a.demo'),
      accessToken(request, 'e2e-b', 'student001@e2e-b.demo'),
    ]);

    const listA = await request.get('/api/courses', { headers: bearer(studentA) });
    expect(listA.ok()).toBeTruthy();
    expect((await listA.json()).map((course: { id: string }) => course.id)).toContain(courseA);
    expect((await request.get(`/api/courses/${courseB}`, { headers: bearer(studentA) })).status()).toBe(404);
    expect((await request.get(`/api/courses/${courseB}/preview`, { headers: bearer(studentA) })).status()).toBe(404);

    const listB = await request.get('/api/courses', { headers: bearer(studentB) });
    expect(listB.ok()).toBeTruthy();
    expect((await listB.json()).map((course: { id: string }) => course.id)).toContain(courseB);
    expect((await request.get(`/api/courses/${courseA}`, { headers: bearer(studentB) })).status()).toBe(404);

    const deniedCreate = await request.post('/api/courses', {
      headers: bearer(studentA),
      data: { title: 'E2E forbidden course', status: 'DRAFT', organizationId: 'org-e2e-b' },
    });
    expect(deniedCreate.status()).toBe(403);

    const permittedRead = await request.get(`/api/courses/${courseA}`, { headers: bearer(teacherA) });
    expect(permittedRead.ok()).toBeTruthy();
  });

  test('E2E-TENANT-01: an uploaded file remains inaccessible outside its organization', async ({ request }) => {
    const [studentA, studentB] = await Promise.all([
      accessToken(request, 'e2e-a', 'student001@e2e-a.demo'),
      accessToken(request, 'e2e-b', 'student001@e2e-b.demo'),
    ]);
    const upload = await request.post('/api/files', {
      headers: bearer(studentB),
      multipart: {
        file: { name: 'e2e-tenant-proof.txt', mimeType: 'text/plain', buffer: Buffer.from('tenant-b only') },
      },
    });
    expect(upload.ok()).toBeTruthy();
    const file = await upload.json() as { id: string };

    const foreignUrl = await request.get(`/api/files/${file.id}/url`, { headers: bearer(studentA) });
    expect(foreignUrl.status()).toBe(403);
    expect((await request.get(`/api/files/${file.id}/url`, { headers: bearer(studentB) })).ok()).toBeTruthy();
  });

  test('E2E-SUBMISSION-01 and E2E-TENANT-03: two students submit concurrently without cross-tenant leakage', async ({ request }) => {
    const [studentA1, studentA2, teacherA, studentB] = await Promise.all([
      accessToken(request, 'e2e-a', 'student001@e2e-a.demo'),
      accessToken(request, 'e2e-a', 'student002@e2e-a.demo'),
      accessToken(request, 'e2e-a', 'teacher001@e2e-a.demo'),
      accessToken(request, 'e2e-b', 'student001@e2e-b.demo'),
    ]);
    const upload = await request.post('/api/files', {
      headers: bearer(studentA1),
      multipart: {
        file: { name: 'e2e-submission.txt', mimeType: 'text/plain', buffer: Buffer.from('submission from student A1') },
      },
    });
    expect(upload.ok()).toBeTruthy();
    const { id: fileId } = await upload.json() as { id: string };

    const [first, second] = await Promise.all([
      request.post(`/api/assignments/${assignmentA}/submissions`, {
        headers: bearer(studentA1), data: { text: 'E2E concurrent submission A1', status: 'SUBMITTED', fileIds: [fileId] },
      }),
      request.post(`/api/assignments/${assignmentA}/submissions`, {
        headers: bearer(studentA2), data: { text: 'E2E concurrent submission A2', status: 'SUBMITTED' },
      }),
    ]);
    expect(first.ok()).toBeTruthy();
    expect(second.ok()).toBeTruthy();

    const mine = await request.get(`/api/assignments/${assignmentA}/submissions/me`, { headers: bearer(studentA1) });
    expect(mine.ok()).toBeTruthy();
    expect((await mine.json()).files).toHaveLength(1);

    const listed = await request.get(`/api/assignments/${assignmentA}/submissions`, { headers: bearer(teacherA) });
    expect(listed.ok()).toBeTruthy();
    expect((await listed.json()).map((submission: { text: string }) => submission.text)).toEqual(
      expect.arrayContaining(['E2E concurrent submission A1', 'E2E concurrent submission A2']),
    );
    expect((await request.post(`/api/assignments/${assignmentA}/submissions`, {
      headers: bearer(studentB), data: { text: 'foreign tenant attempt', status: 'SUBMITTED' },
    })).status()).toBe(404);
    expect((await request.get(`/api/assignments/${assignmentB}/submissions/me`, { headers: bearer(studentA1) })).status()).toBe(404);
  });
});
