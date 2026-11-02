import { expect, test } from '@playwright/test';
import { actAs, STUDENT } from './dev-user';

test.beforeEach(async ({ page }) => {
  await actAs(page, STUDENT);
  await page.route('**/api/notifications*', async (route) => {
    if (route.request().method() !== 'GET') return route.continue();
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        items: [
          {
            id: 'notification-activity-1',
            userId: STUDENT,
            type: 'ACTIVITY_PUBLISHED',
            title: 'Nueva tarea publicada: Cuestionario en Desarrollo Web',
            body: 'Entrega antes del viernes.',
            link: '/activities?subjectId=subject-web-101&activityId=activity-web-101',
            read: false,
            createdAt: new Date().toISOString(),
          },
        ],
        page: 1,
        pageSize: 50,
        total: 1,
        unread: 1,
      }),
    });
  });
});

test('shows the new notification type and follows its deep link', async ({ page }) => {
  await page.goto('/notifications');

  const notification = page.getByRole('button', {
    name: /Tarea publicada: Nueva tarea publicada: Cuestionario en Desarrollo Web/i,
  });
  await expect(notification).toBeVisible();
  await notification.click();
  await expect(page).toHaveURL(/\/activities\?subjectId=subject-web-101&activityId=activity-web-101/);
});

test('renders every C/U/D notification kind with its label and a real link', async ({ page }) => {
  // One row per entity family covered by the README coverage table (#132).
  const kinds = [
    { type: 'FORUM_THREAD', title: 'Un hilo del foro se ha renombrado', label: 'Foro', link: '/forums/thread-1' },
    { type: 'FORUM_REPLY', title: 'Un mensaje del foro se ha eliminado', label: 'Respuesta en el foro', link: '/forums/thread-1' },
    { type: 'RESOURCE_CHANGED', title: 'Carpeta creada: Apuntes', label: 'Biblioteca', link: '/resources' },
    { type: 'USER_CHANGED', title: 'Has cambiado tu contraseña', label: 'Tu cuenta', link: '/profile' },
    { type: 'ORGANIZATION_CHANGED', title: 'Invitación revocada', label: 'Organización', link: '/org' },
    { type: 'FRIEND_REQUEST', title: 'Solicitud de amistad rechazada', label: 'Amistad', link: '/friends' },
  ];
  const items = kinds.map(({ type, title, link }, index) => ({
    id: `coverage-${index}`, userId: STUDENT, type, title, body: null, link, read: false, createdAt: new Date().toISOString(),
  }));
  await page.route('**/api/notifications?*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ items, page: 1, pageSize: 50, total: items.length, unread: items.length }),
    });
  });

  await page.goto('/notifications');
  for (const { label, title } of kinds) {
    await expect(page.getByRole('button', { name: new RegExp(`${label}: ${title}`) })).toBeVisible();
  }

  await page.getByRole('button', { name: /Amistad: Solicitud de amistad rechazada/ }).click();
  await expect(page).toHaveURL(/\/friends$/);
});

test.describe('notification list filters and pagination', () => {
  const row = (n: number, read: boolean) => ({
    id: `notification-${n}`,
    userId: STUDENT,
    type: 'SYSTEM',
    title: `Aviso ${n}`,
    body: null,
    link: null,
    read,
    createdAt: new Date(Date.now() - n * 60_000).toISOString(),
  });

  test.beforeEach(async ({ page }) => {
    // Registered after the file-level mock, so it takes precedence.
    await page.route('**/api/notifications?*', async (route) => {
      const url = new URL(route.request().url());
      const unreadOnly = url.searchParams.get('unreadOnly') === 'true';
      const pageNumber = Number(url.searchParams.get('page') ?? '1');
      const pageSize = Number(url.searchParams.get('pageSize') ?? '20');
      const all = Array.from({ length: 25 }, (_, index) => row(index + 1, index % 5 !== 0));
      const rows = unreadOnly ? all.filter((n) => !n.read) : all;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: rows.slice((pageNumber - 1) * pageSize, pageNumber * pageSize),
          page: pageNumber,
          pageSize,
          total: rows.length,
          unread: all.filter((n) => !n.read).length,
        }),
      });
    });
  });

  test('loads more pages and filters unread notifications', async ({ page }) => {
    await page.goto('/notifications');

    await expect(page.getByRole('button', { name: /Aviso 1$/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Aviso 25$/ })).toHaveCount(0);
    await page.getByRole('button', { name: 'Cargar más' }).click();
    await expect(page.getByRole('button', { name: /Aviso 25$/ })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Cargar más' })).toHaveCount(0);

    await page.getByRole('button', { name: /^No leídas/ }).click();
    await expect(page.getByRole('button', { name: /Aviso 1$/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Aviso 2$/ })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Marcar todas como leídas' })).toBeEnabled();
  });

  test('keeps the bell panel inside a 375px viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 700 });
    await page.goto('/dashboard');
    await page.getByRole('button', { name: 'Notificaciones' }).click();

    const panel = page.getByRole('menu');
    await expect(panel.getByRole('button', { name: 'Marcar todas como leídas' })).toBeVisible();
    const box = await panel.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(375);
  });
});
