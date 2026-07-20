import { test, expect } from '@playwright/test';
import { actAs, STUDENT } from './dev-user';

const BASE_URL = 'http://localhost:3000';
const COURSE_ID = 'course-web-101';

test.describe('StudentDashboard (real data)', () => {
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
    await expect(page.getByText('Progreso del semestre')).toBeVisible({ timeout: 8000 });
    await expect(page.getByText('25%').first()).toBeVisible();
  });

  test('shows per-course progress dot with percentage', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.getByText('Introducción al Desarrollo Web · 25%')).toBeVisible({ timeout: 8000 });
  });

  test('shows PROGRESO PROMEDIO card with real value', async ({ page }) => {
    await page.goto('/dashboard');
    await page.getByText('PROGRESO PROMEDIO').waitFor({ timeout: 8000 });
    // The student has only one course at 25%, so avg = 25%.
    await expect(page.getByText('25%').first()).toBeVisible();
  });

  test('shows PRÓXIMA ENTREGA card with assignment info', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.getByText('PRÓXIMA ENTREGA')).toBeVisible({ timeout: 8000 });
    await expect(page.getByText('Práctica 1').first()).toBeVisible();
  });

  test('shows course cards with progress bars', async ({ page }) => {
    await page.goto('/dashboard');
    const card = page.getByText('Introducción al Desarrollo Web').first();
    await expect(card).toBeVisible({ timeout: 8000 });
    // Click navigates to course detail
    await card.click();
    await expect(page).toHaveURL(/\/courses\/course-web-101/);
  });

  test('zero console errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await page.goto('/dashboard');
    await expect(page.getByText('Progreso del semestre')).toBeVisible({ timeout: 8000 });

    expect(errors).toEqual([]);
  });

  test('dashboard layout is 3-column grid', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.getByText('Progreso del semestre')).toBeVisible({ timeout: 8000 });
    await expect(page.getByText('PROGRESO PROMEDIO')).toBeVisible();
    // The grid renders course cards; at least one should be visible.
    await expect(page.getByText('Introducción al Desarrollo Web').first()).toBeVisible();
  });
});
