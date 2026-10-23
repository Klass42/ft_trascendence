import { expect, test, type APIRequestContext, type BrowserContext } from '@playwright/test';
import { actAs } from './dev-user';

const BACKEND = 'http://localhost:3000';
const STUDENT_DEMO = 'user-student-0001';
const TEACHER_DEMO = 'user-teacher-0001';

interface FriendRef {
  friendshipId: string;
  id: string;
}

interface FriendshipList {
  friends: FriendRef[];
  receivedRequests: FriendRef[];
  sentRequests: FriendRef[];
}

async function removeExistingFriendship(request: APIRequestContext) {
  const response = await request.get('/friendships');
  if (!response.ok()) return;
  const relationships = await response.json() as FriendshipList;
  const existing = [
    ...relationships.friends,
    ...relationships.receivedRequests,
    ...relationships.sentRequests,
  ].find((relationship) => relationship.id === STUDENT_DEMO);
  if (existing) await request.delete(`/friendships/${existing.friendshipId}`);
}

test('teacher sends a request, student accepts it and sees live presence', async ({ browser }) => {
  test.setTimeout(30000);
  let teacherContext: BrowserContext | undefined;
  let studentContext: BrowserContext | undefined;
  const teacherApi = await browser.newContext({
    baseURL: BACKEND,
    extraHTTPHeaders: { 'x-dev-user': TEACHER_DEMO },
  });

  try {
    await removeExistingFriendship(teacherApi.request);
    teacherContext = await browser.newContext();
    studentContext = await browser.newContext();
    const teacher = await teacherContext.newPage();
    const student = await studentContext.newPage();
    await actAs(teacher, TEACHER_DEMO);
    await actAs(student, STUDENT_DEMO);

    await student.goto('/dashboard');
    await teacher.goto('/friends');
    await teacher.getByLabel('Nombre o correo electrónico').fill('Sam');
    await teacher.getByRole('button', { name: 'Buscar' }).click();
    await expect(teacher.getByText('Sam Student')).toBeVisible();
    await teacher.getByRole('button', { name: 'Añadir' }).click();
    await expect(teacher.getByText('Solicitud enviada a Sam Student')).toBeVisible();

    await student.goto('/friends');
    const acceptButton = student.getByRole('button', { name: 'Aceptar solicitud de Theo Teacher' });
    await expect(acceptButton).toBeVisible();
    await acceptButton.click();
    await expect(student.getByText('Ahora eres amigo de Theo Teacher')).toBeVisible();

    await expect(teacher.getByText('Sam Student')).toBeVisible();
    await expect(teacher.getByText('En línea')).toBeVisible({ timeout: 12000 });
  } finally {
    await removeExistingFriendship(teacherApi.request);
    await Promise.all([teacherContext?.close(), studentContext?.close()]);
    await teacherApi.close();
  }
});
