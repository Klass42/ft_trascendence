import { test, expect } from '@playwright/test';
import { actAs, STUDENT } from './dev-user';

const COURSE_ID = 'course-web-101';
const LESSON_ID = 'lesson-web-101-1';

// Student experience. Act as the seeded student regardless of VITE_DEV_USER_ID.
test.beforeEach(async ({ page }) => {
  await actAs(page, STUDENT);
});

// ═══════════════════════════════════════════════════════════
// F1: CoursesPage
// ═══════════════════════════════════════════════════════════
test.describe('F1 — CoursesPage', () => {
  test('shows course list from API', async ({ page }) => {
    await page.goto('/courses');
    await page.waitForTimeout(2000);

    await expect(page.locator('h1')).toContainText('Mis cursos');

    const courseCard = page.locator('text=1º A').first();
    await expect(courseCard).toBeVisible({ timeout: 8000 });
  });

  test('clicking a course card navigates to detail', async ({ page }) => {
    await page.goto('/courses');
    await page.waitForTimeout(2000);

    const card = page.locator('text=1º A').first();
    await card.click();

    await expect(page).toHaveURL(/\/courses\//);
  });
});

// ═══════════════════════════════════════════════════════════
// F2: CourseDetailPage — unenrolled (shows enroll UI)
// ═══════════════════════════════════════════════════════════
test.describe('F2 — Subject page', () => {
  test('shows the published subject and its cohort', async ({ page }) => {
    await page.goto(`/courses/course-klass-2025/subjects/${COURSE_ID}`);
    await page.waitForTimeout(2000);

    await expect(page.locator('h1')).toContainText('Introducción al Desarrollo Web');
    await expect(page.locator('text=1º A').first()).toBeVisible();
  });
});

// ═══════════════════════════════════════════════════════════
// F3: LessonPage
// ═══════════════════════════════════════════════════════════
test.describe('F3 — LessonPage', () => {
  test('shows lesson content with markdown', async ({ page }) => {
    await page.goto(`/courses/course-klass-2025/subjects/${COURSE_ID}/lessons/${LESSON_ID}`);
    await page.waitForTimeout(2000);

    await expect(page.locator('h1').first()).toContainText('¿Cómo funciona la web?');

    const content = page.locator('text=Cliente, servidor y HTTP').first();
    await expect(content).toBeVisible({ timeout: 8000 });
  });

  test('has complete lesson button', async ({ page }) => {
    await page.goto(`/courses/course-klass-2025/subjects/${COURSE_ID}/lessons/${LESSON_ID}`);
    await page.waitForTimeout(2000);

    // Either the complete button (uncompleted) or the completed badge (already done)
    const completeBtn = page.locator(
      'button:has-text("Marcar como completada"), div:has-text("Lección completada")',
    );
    await expect(completeBtn.first()).toBeVisible({ timeout: 8000 });
  });
});

// ═══════════════════════════════════════════════════════════
// F4: DashboardPage
// ═══════════════════════════════════════════════════════════
test.describe('F4 — DashboardPage', () => {
  test('shows welcome with user name', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForTimeout(2000);

    await expect(page.locator('text=Lucía').first()).toBeVisible({ timeout: 8000 });
  });

  test('shows course cards on student dashboard', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForTimeout(2000);

    const courseCard = page.locator('text=1º A').first();
    await expect(courseCard).toBeVisible({ timeout: 8000 });
  });
});

// ═══════════════════════════════════════════════════════════
// F5: ProfilePage
// ═══════════════════════════════════════════════════════════
test.describe('F5 — ProfilePage', () => {
  test('profile page renders without crash', async ({ page }) => {
    let errorCount = 0;
    page.on('pageerror', () => { errorCount++; });

    await page.goto('/profile');
    await page.waitForTimeout(3000);

    // The page loaded if we landed on /profile or were redirected
    expect(errorCount).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════
// F6+F7: AppLayout & ProtectedRoute
// ═══════════════════════════════════════════════════════════
test.describe('F6+F7 — AppLayout', () => {
  test('sidebar shows navigation items', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForTimeout(2000);

    // A student sees the shared items plus their role-flagged ones. Tareas and
    // Foros are student:true + teacher:true, so students must see them too — a
    // regression guard for the nav filter fix that previously hid them.
    for (const item of ['Inicio', 'Cursos', 'Tareas', 'Foros', 'Datos']) {
      await expect(page.locator(`text=${item}`).first()).toBeVisible({ timeout: 5000 });
    }
    // Analytics is staff-only — the student must NOT see it.
    await expect(page.locator('text=Analíticas')).toHaveCount(0);
  });

  test('login page is accessible without auth', async ({ page }) => {
    await page.goto('/login');
    await page.waitForTimeout(2000);
    await expect(page).toHaveURL(/\/login/);
  });
});

// ═══════════════════════════════════════════════════════════
// Console: no errors/warnings
// ═══════════════════════════════════════════════════════════
test.describe('Console — zero warnings', () => {
  const ignorePatterns = [/favicon/i, /WebSocket/i, /Third-party/i];

  function trackErrors(page) {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error' || msg.type() === 'warning') {
        const text = msg.text();
        if (!ignorePatterns.some((p) => p.test(text))) {
          errors.push(`${msg.type()}: ${text}`);
        }
      }
    });
    page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));
    return errors;
  }

  test('courses page', async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto('/courses');
    await page.waitForTimeout(2000);
    await expect(page.locator('h1')).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('dashboard page', async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto('/dashboard');
    await page.waitForTimeout(2000);
    expect(errors).toEqual([]);
  });

  test('lesson page', async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto(`/courses/course-klass-2025/subjects/${COURSE_ID}/lessons/${LESSON_ID}`);
    await page.waitForTimeout(2000);
    expect(errors).toEqual([]);
  });
});
