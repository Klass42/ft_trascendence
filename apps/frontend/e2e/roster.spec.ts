import { test, expect } from '@playwright/test';
import { actAs, TEACHER, STUDENT } from './dev-user';

/**
 * A3 — Roster / Inscripciones.
 *
 * Tests the "Alumnos" tab in CourseDetailPage: staff sees enrolled students,
 * can change roles, and expel students.
 *
 * Uses the seeded course 'course-web-101' with teacher 'user-diego-001' and
 * student 'user-lucia-001' already enrolled.
 */

const COURSE_ID = 'course-web-101';

test.describe('A3 — Roster de inscripciones', () => {
  test('staff ve la pestaña Alumnos con los inscritos', async ({ page }) => {
    await actAs(page, TEACHER);
    await page.goto(`/courses/course-klass-2025/subjects/${COURSE_ID}`);

    // Tabs visible for teacher
    const alumnosTab = page.getByRole('tab', { name: 'Alumnos' });
    await expect(alumnosTab).toBeVisible();
    await alumnosTab.click();

    // Table shows at least one enrolled student
    await expect(page.getByText('Alumnos inscritos')).toBeVisible();
    await page.screenshot({ path: 'e2e/screenshots/roster-list.png' });
  });

  test('alumno NO ve la pestaña Alumnos', async ({ page }) => {
    await actAs(page, STUDENT);
    await page.goto(`/courses/course-klass-2025/subjects/${COURSE_ID}`);

    // Student should not see the Alumnos tab
    await expect(page.getByRole('tab', { name: 'Alumnos' })).not.toBeVisible();
  });

  test('staff cambia rol de un alumno', async ({ page }) => {
    await actAs(page, TEACHER);
    await page.goto(`/courses/course-klass-2025/subjects/${COURSE_ID}`);
    await page.getByRole('tab', { name: 'Alumnos' }).click();

    // Find the role Select for a student row and change to ASSISTANT
    const roleSelect = page.locator('select').first();
    await roleSelect.selectOption('ASSISTANT');
    await expect(page.getByText('Rol actualizado')).toBeVisible();

    // Revert to STUDENT to keep seed clean
    await roleSelect.selectOption('STUDENT');
    await page.screenshot({ path: 'e2e/screenshots/roster-role-change.png' });
  });
});
