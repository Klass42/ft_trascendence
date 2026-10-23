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
