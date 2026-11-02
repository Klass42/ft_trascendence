import { expect, test, type APIRequestContext } from '@playwright/test';
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

async function removeExistingFriendship(request: APIRequestContext, otherId: string) {
  const response = await request.get('/friendships');
  if (!response.ok()) return;
  const relationships = await response.json() as FriendshipList;
  const existing = [
    ...relationships.friends,
    ...relationships.receivedRequests,
    ...relationships.sentRequests,
  ].find((relationship) => relationship.id === otherId);
  if (existing) await request.delete(`/friendships/${existing.friendshipId}`);
}

test('student opens a teacher profile and sends a friend request', async ({ browser, page }) => {
  const studentApi = await browser.newContext({
    baseURL: BACKEND,
    extraHTTPHeaders: { 'x-dev-user': STUDENT_DEMO },
  });

  try {
    await removeExistingFriendship(studentApi.request, TEACHER_DEMO);
    await actAs(page, STUDENT_DEMO);
    await page.goto(`/users/${TEACHER_DEMO}`);

    await expect(page.getByRole('heading', { level: 1, name: 'Theo Teacher' })).toBeVisible();
    await expect(page.getByText('Profesor', { exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { level: 2, name: 'Cohortes en común' })).toBeVisible();
    // Students never see the email of other members.
    await expect(page.getByText('teacher@demo')).toHaveCount(0);

    await page.getByRole('button', { name: 'Añadir' }).click();
    await expect(page.getByText('Solicitud enviada a Theo Teacher')).toBeVisible();
    await expect(page.getByText('Solicitud enviada', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Añadir' })).toHaveCount(0);
  } finally {
    await removeExistingFriendship(studentApi.request, TEACHER_DEMO);
    await studentApi.close();
  }
});

test('own id redirects to /profile and unknown ids show not found', async ({ page }) => {
  await actAs(page, STUDENT_DEMO);

  await page.goto(`/users/${STUDENT_DEMO}`);
  await expect(page).toHaveURL(/\/profile$/);

  await page.goto('/users/user-does-not-exist');
  await expect(page.getByRole('heading', { level: 1, name: 'Usuario no encontrado' })).toBeVisible();
});

test('friends search results link to the profile', async ({ page }) => {
  await actAs(page, TEACHER_DEMO);
  await page.goto('/friends');
  await page.getByLabel('Nombre o correo electrónico').fill('Sam');
  await page.getByRole('button', { name: 'Buscar' }).click();
  await page.getByRole('link', { name: 'Sam Student' }).click();
  await expect(page).toHaveURL(new RegExp(`/users/${STUDENT_DEMO}$`));
  await expect(page.getByRole('heading', { level: 1, name: 'Sam Student' })).toBeVisible();
});
