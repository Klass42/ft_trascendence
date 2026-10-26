import { expect, test, type APIRequestContext } from '@playwright/test';

const ADMIN = 'user-admin-0001';
const TEACHER = 'user-diego-001';
const UNENROLLED_STUDENT = 'user-lucia-001';
const headers = (userId: string) => ({ 'x-dev-user': userId });
let courseId: string | undefined;
let fileId: string | undefined;

async function expectOk(response: Awaited<ReturnType<APIRequestContext['post']>>) {
  expect(response.ok(), await response.text()).toBeTruthy();
}

test.afterEach(async ({ request }) => {
  if (courseId) await request.delete(`/api/courses/${courseId}`, { headers: headers(ADMIN) });
  if (fileId) await request.delete(`/api/files/${fileId}`, { headers: headers(TEACHER) });
  courseId = undefined;
  fileId = undefined;
});

test('un alumno sin matrícula no abre el adjunto y la URL de acceso exige sesión', async ({ request }) => {
  const suffix = `${Date.now()}`;
  const createdCourse = await request.post('/api/courses', {
    headers: headers(ADMIN),
    data: {
      name: `Acceso a archivos ${suffix}`,
      academicYear: '2026-2027',
      startsOn: '2026-09-01T00:00:00.000Z',
      endsOn: '2027-06-30T00:00:00.000Z',
      status: 'ACTIVE',
    },
  });
  await expectOk(createdCourse);
  const course = await createdCourse.json() as { id: string };
  courseId = course.id;

  const createdSubject = await request.post(`/api/courses/${course.id}/subjects`, {
    headers: headers(ADMIN),
    data: { title: `Contenido privado ${suffix}`, status: 'PUBLISHED' },
  });
  await expectOk(createdSubject);
  const subject = await createdSubject.json() as { id: string };

  await expectOk(await request.post(`/api/subjects/${subject.id}/staff`, {
    headers: headers(ADMIN),
    data: { userId: TEACHER, role: 'TEACHER' },
  }));
  const createdSection = await request.post(`/api/subjects/${subject.id}/sections`, {
    headers: headers(TEACHER),
    data: { title: 'Material privado', order: 0 },
  });
  await expectOk(createdSection);
  const section = await createdSection.json() as { id: string };

  const createdLesson = await request.post(`/api/sections/${section.id}/lessons`, {
    headers: headers(TEACHER),
    data: { title: 'Adjunto privado', order: 0 },
  });
  await expectOk(createdLesson);
  const lesson = await createdLesson.json() as { id: string };

  const uploaded = await request.post('/api/files', {
    headers: headers(TEACHER),
    multipart: {
      file: { name: 'privado.txt', mimeType: 'text/plain', buffer: Buffer.from('contenido del curso') },
    },
  });
  await expectOk(uploaded);
  const file = await uploaded.json() as { id: string };
  fileId = file.id;
  await expectOk(await request.post(`/api/lessons/${lesson.id}/attachments`, {
    headers: { ...headers(TEACHER), 'Content-Type': 'application/json' },
    data: { fileId: file.id },
  }));

  const denied = await request.get(`/api/files/${file.id}/url`, {
    headers: headers(UNENROLLED_STUDENT),
  });
  expect([403, 404]).toContain(denied.status());

  const anonymous = await request.get(`/api/files/${file.id}/url`);
  expect(anonymous.status()).toBe(401);
});
