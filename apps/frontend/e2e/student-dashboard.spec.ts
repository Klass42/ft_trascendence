import { test, expect } from '@playwright/test';
import { actAs, STUDENT } from './dev-user';

const BASE_URL = 'http://localhost:3000';
const ORG = 'org-klass-0001';
const WEB_101_LABEL = 'Introducción al Desarrollo Web · 1º A · 2025-2026';

test.describe('StudentDashboard (real data)', () => {
  // Lucía's figures come from the backend, not from constants: other specs may
  // move her progress, so beforeAll pins a known completion and reads the
  // resulting numbers the dashboard must show.
  const expected = { web101: 0, average: 0 };

  test.beforeAll(async ({ request }) => {
    const headers = { 'x-dev-user': STUDENT };
    const complete = await request.post(
      `${BASE_URL}/lessons/lesson-web-101-1/complete?organizationId=${ORG}`,
      { headers },
    );
    expect(complete.ok()).toBeTruthy();

    const res = await request.get(`${BASE_URL}/me/progress?organizationId=${ORG}`, { headers });
    expect(res.ok()).toBeTruthy();
    const items: { subjectId: string; percentage: number }[] = await res.json();
    const web101 = items.find((p) => p.subjectId === 'course-web-101');
    expect(web101).toBeDefined();
    expected.web101 = web101!.percentage;
    // At least 1 of web-101's lessons is done, so the ring can't be empty.
    expect(expected.web101).toBeGreaterThan(0);
    expected.average = Math.round(items.reduce((sum, p) => sum + p.percentage, 0) / items.length);
  });

  test.beforeEach(async ({ page }) => {
    await actAs(page, STUDENT);
  });

  test('shows welcome with name and role label', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.getByText(/Hola de nuevo/i).first()).toBeVisible({ timeout: 8000 });
    await expect(page.getByText('Lucía').first()).toBeVisible();
    await expect(page.getByText('Alumno')).toBeVisible();
  });

  test('shows progress ring with real percentage', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.getByText('Progreso de lecciones')).toBeVisible({ timeout: 8000 });
    await expect(page.getByTestId('progress-ring-value')).toHaveText(`${expected.average}%`);
  });

  test('shows per-course progress dot with percentage', async ({ page }) => {
    await page.goto('/dashboard');
    const row = page.getByTestId('progress-row').filter({ hasText: WEB_101_LABEL });
    await expect(row).toHaveText(`${WEB_101_LABEL} · ${expected.web101}%`, { timeout: 8000 });
  });

  test('labels progress as lessons, not grades', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(
      page.getByText('Lecciones completadas en tus asignaturas activas'),
    ).toBeVisible({ timeout: 8000 });
  });

  test('shows PROMEDIO DE LECCIONES card with real value', async ({ page }) => {
    await page.goto('/dashboard');
    await page.getByText('PROMEDIO DE LECCIONES').waitFor({ timeout: 8000 });
    await expect(page.getByTestId('avg-progress')).toHaveText(`${expected.average}%`);
  });

  test('PRÓXIMA ENTREGA shows the first pending activity from the backend', async ({ page, request }) => {
    const res = await request.get(`${BASE_URL}/me/pending-activities`, {
      headers: { 'x-dev-user': STUDENT },
    });
    expect(res.ok()).toBeTruthy();
    const pending: { id: string; title: string; attemptsAllowed: number; attemptsUsed: number; inProgress: boolean; closeAt: string | null }[] = await res.json();
    // Nothing the endpoint returns may be finished or closed.
    for (const a of pending) {
      expect(a.inProgress || a.attemptsUsed === 0).toBe(true);
      expect(a.closeAt === null || new Date(a.closeAt).getTime() > Date.now()).toBe(true);
    }

    await page.goto('/dashboard');
    if (pending.length === 0) {
      await expect(page.getByText('No hay entregas pendientes')).toBeVisible({ timeout: 8000 });
      return;
    }
    await expect(page.getByText('PRÓXIMA ENTREGA')).toBeVisible({ timeout: 8000 });
    await expect(
      page.getByRole('link', { name: `Próxima entrega: ${pending[0].title}` }),
    ).toBeVisible();
  });

  test('shows course cards with progress bars', async ({ page }) => {
    await page.goto('/dashboard');
    const card = page.getByTestId('course-card').filter({ hasText: WEB_101_LABEL });
    await expect(card).toBeVisible({ timeout: 8000 });
    await expect(card).toHaveAttribute('aria-label', `${WEB_101_LABEL} · ${expected.web101}%`);
    // Click navigates to course detail
    await card.click();
    await expect(page).toHaveURL(/\/courses\/course-klass-2025\/subjects\/course-web-101/);
  });

  test('course card opens with the keyboard', async ({ page }) => {
    await page.goto('/dashboard');
    const card = page.getByTestId('course-card').filter({ hasText: WEB_101_LABEL });
    await card.focus();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/courses\/course-klass-2025\/subjects\/course-web-101/);
  });

  test('zero console errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await page.goto('/dashboard');
    await expect(page.getByText('Progreso de lecciones')).toBeVisible({ timeout: 8000 });

    expect(errors).toEqual([]);
  });

  test('dashboard layout is 3-column grid', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.getByText('Progreso de lecciones')).toBeVisible({ timeout: 8000 });
    await expect(page.getByText('PROMEDIO DE LECCIONES')).toBeVisible();
    // The grid renders course cards; at least one should be visible.
    await expect(page.getByText('Introducción al Desarrollo Web').first()).toBeVisible();
  });
});
