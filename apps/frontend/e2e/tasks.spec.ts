import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { actAs, STUDENT, TEACHER } from './dev-user';

/**
 * Unified Tareas surface (`/activities`). Covers spec
 * `2026-09-19-task-templates-design.md` §11 E2E: mixed exam, templates,
 * countsTowardFinal, window + answer-key strip, cross-org 404.
 */

const API = 'http://localhost:3000';
const COURSE_ID = 'course-web-101';
const SEEDED_TEMPLATE = 'template-klass-mixto';
const SEEDED_ACTIVITY = 'activity-web-101-quiz';

const PLATFORM_EMAIL =
  process.env.PLATFORM_SUPERADMIN_EMAIL ?? 'admin@platform.local';
const PLATFORM_PASSWORD =
  process.env.PLATFORM_SUPERADMIN_PASSWORD ?? 'ChangeMe123';

function jsonHeaders(userId: string) {
  return { 'x-dev-user': userId, 'Content-Type': 'application/json' };
}

interface QuestionDTO {
  id: string;
  kind: string;
  prompt: string;
  points: number;
  content: Record<string, unknown>;
}

interface ActivityDTO {
  id: string;
  title: string;
  maxScore: number;
  countsTowardFinal: boolean;
  questions?: QuestionDTO[];
}

interface AttemptDTO {
  id: string;
  status: string;
  score: number | null;
  answers?: Array<{ questionId: string; awarded: number | null; response: Record<string, unknown> }>;
}

interface MyGradesDTO {
  items: Array<{
    activityId: string;
    title: string;
    score: number | null;
    status: string | null;
    countsTowardFinal: boolean;
    maxScore: number;
  }>;
  final: number | null;
}

async function createPublishedMixed(
  request: APIRequestContext,
  opts: {
    title: string;
    courseId?: string;
    countsTowardFinal?: boolean;
    closeAt?: string;
  },
): Promise<{ activity: ActivityDTO; questions: QuestionDTO[] }> {
  const courseId = opts.courseId ?? COURSE_ID;
  const created = await request.post(`${API}/subjects/${courseId}/activities`, {
    headers: jsonHeaders(TEACHER),
    data: {
      title: opts.title,
      type: 'QUIZ',
      countsTowardFinal: opts.countsTowardFinal ?? true,
      ...(opts.closeAt ? { closeAt: opts.closeAt } : {}),
    },
  });
  expect(created.ok(), await created.text()).toBeTruthy();
  const activity = (await created.json()) as ActivityDTO;

  const specs = [
    {
      kind: 'MULTIPLE_CHOICE',
      prompt: '¿Cuánto es 2 + 2?',
      points: 1,
      content: { options: ['3', '4'], correct: [1] },
    },
    {
      kind: 'MATCHING',
      prompt: 'Empareja cada término con su definición.',
      points: 1,
      content: {
        left: ['HTML', 'CSS'],
        right: ['Estructura', 'Presentación'],
        pairs: [
          [0, 0],
          [1, 1],
        ],
      },
    },
    {
      kind: 'ESSAY',
      prompt: 'Explica brevemente cómo se relaciona HTML y CSS.',
      points: 2,
      content: {},
    },
  ];
  const questions: QuestionDTO[] = [];
  for (const spec of specs) {
    const res = await request.post(`${API}/activities/${activity.id}/questions`, {
      headers: jsonHeaders(TEACHER),
      data: spec,
    });
    expect(res.ok(), await res.text()).toBeTruthy();
    questions.push((await res.json()) as QuestionDTO);
  }

  const published = await request.patch(`${API}/activities/${activity.id}`, {
    headers: jsonHeaders(TEACHER),
    data: { status: 'PUBLISHED' },
  });
  expect(published.ok(), await published.text()).toBeTruthy();
  return { activity: { ...activity, questions }, questions };
}

async function studentSubmitMixed(
  request: APIRequestContext,
  activityId: string,
  questions: QuestionDTO[],
): Promise<AttemptDTO> {
  const mcq = questions.find((q) => q.kind === 'MULTIPLE_CHOICE');
  const matching = questions.find((q) => q.kind === 'MATCHING');
  const essay = questions.find((q) => q.kind === 'ESSAY');
  expect(mcq && matching && essay).toBeTruthy();

  const started = await request.post(`${API}/activities/${activityId}/attempts`, {
    headers: { 'x-dev-user': STUDENT },
  });
  expect(started.ok(), await started.text()).toBeTruthy();
  const attempt = (await started.json()) as AttemptDTO;

  const saved = await request.patch(`${API}/attempts/${attempt.id}`, {
    headers: jsonHeaders(STUDENT),
    data: {
      answers: [
        { questionId: mcq!.id, response: { selected: [1] } },
        {
          questionId: matching!.id,
          response: {
            pairs: [
              [0, 0],
              [1, 1],
            ],
          },
        },
        {
          questionId: essay!.id,
          response: { text: 'HTML da la estructura y CSS la presentación.' },
        },
      ],
    },
  });
  expect(saved.ok(), await saved.text()).toBeTruthy();

  const submitted = await request.post(`${API}/attempts/${attempt.id}/submit`, {
    headers: { 'x-dev-user': STUDENT },
  });
  expect(submitted.ok(), await submitted.text()).toBeTruthy();
  return (await submitted.json()) as AttemptDTO;
}

async function gradeEssay(
  request: APIRequestContext,
  attemptId: string,
  essayId: string,
  awarded: number,
  feedback?: string,
): Promise<AttemptDTO> {
  const graded = await request.patch(`${API}/attempts/${attemptId}/grade`, {
    headers: jsonHeaders(TEACHER),
    data: {
      answers: [{ questionId: essayId, awarded }],
      feedback,
    },
  });
  expect(graded.ok(), await graded.text()).toBeTruthy();
  return (await graded.json()) as AttemptDTO;
}

async function archiveActivity(request: APIRequestContext, id: string) {
  await request.patch(`${API}/activities/${id}`, {
    headers: jsonHeaders(TEACHER),
    data: { status: 'ARCHIVED' },
  });
}

async function selectCourse(page: Page, courseId: string) {
  const course = page.getByRole('combobox', { name: 'Asignatura' });
  await expect(course).toBeVisible({ timeout: 8000 });
  await course.selectOption(courseId);
}

async function openCourseActivities(page: Page, courseId: string) {
  await page.goto('/activities');
  await selectCourse(page, courseId);
}

async function openCourseGrades(page: Page, courseId: string) {
  await page.goto('/grades');
  await selectCourse(page, courseId);
}

function assertNoAnswerKeys(questions: QuestionDTO[]) {
  for (const question of questions) {
    expect(question.content, question.kind).not.toHaveProperty('correct');
    expect(question.content, question.kind).not.toHaveProperty('pairs');
    expect(question.content, question.kind).not.toHaveProperty('accepted');
    expect(question.content, question.kind).not.toHaveProperty('correctOrder');
    expect(question.content, question.kind).not.toHaveProperty('answer');
  }
}

test.describe('Tareas — unified E2E', () => {
  test.describe.configure({ timeout: 90_000 });

  test.beforeEach(async ({ page }) => {
    await actAs(page, TEACHER);
  });

  test('/assignments redirects to /activities and assignment writes are gone', async ({
    page,
    request,
  }) => {
    await page.goto('/dashboard');
    await expect(page.getByRole('link', { name: 'Tareas' })).toBeVisible({ timeout: 8000 });
    await expect(page.getByRole('link', { name: 'Actividades' })).toHaveCount(0);

    await page.getByRole('link', { name: 'Tareas' }).click();
    await expect(page).toHaveURL(/\/activities/);
    await expect(page.getByRole('heading', { name: 'Tareas' })).toBeVisible();

    await page.goto('/assignments');
    await expect(page).toHaveURL(/\/activities/);

    const gone = await request.post(`${API}/subjects/${COURSE_ID}/assignments`, {
      headers: jsonHeaders(TEACHER),
      data: { title: 'no-op' },
    });
    expect(gone.status()).toBe(410);
  });

  test('teacher creates mixed exam; student submits; teacher grades; gradebook final', async ({
    page,
    request,
  }) => {
    const title = `E2E mixto ${Date.now()}`;

    await openCourseActivities(page, COURSE_ID);
    await page.getByRole('button', { name: '+ Nueva tarea' }).click();
    const create = page.getByRole('dialog', { name: 'Nueva tarea' });
    await create.getByLabel('Título').fill(title);
    await expect(
      create.getByRole('switch', { name: 'Cuenta para la nota final' }),
    ).toHaveAttribute('aria-checked', 'true');
    await create.getByRole('button', { name: 'Crear tarea' }).click();

    await expect(page.getByRole('heading', { level: 2, name: title })).toBeVisible({
      timeout: 8000,
    });
    await expect(page.getByText('Borrador').first()).toBeVisible();

    await page.getByRole('button', { name: '+ Añadir pregunta' }).click();
    await page.getByLabel('Enunciado').fill('¿Cuánto es 2 + 2?');
    await page.getByLabel('Texto de la opción 1').fill('3');
    await page.getByLabel('Texto de la opción 2').fill('4');
    await page.getByLabel('Opción 2 es correcta').check();
    await page.getByRole('button', { name: 'Añadir pregunta', exact: true }).click();
    await expect(page.getByText('¿Cuánto es 2 + 2?')).toBeVisible({ timeout: 8000 });

    await page.getByRole('button', { name: '+ Añadir pregunta' }).click();
    await page.getByLabel('Tipo de pregunta').selectOption('MATCHING');
    await page.getByLabel('Enunciado').fill('Empareja cada término con su definición.');
    await page.getByLabel('Término izquierdo 1').fill('HTML');
    await page.getByLabel('Término derecho 1').fill('Estructura');
    await page.getByRole('button', { name: '+ Añadir pareja' }).click();
    await page.getByLabel('Término izquierdo 2').fill('CSS');
    await page.getByLabel('Término derecho 2').fill('Presentación');
    await page.getByRole('button', { name: 'Añadir pregunta', exact: true }).click();
    await expect(page.getByText('Empareja cada término con su definición.')).toBeVisible({
      timeout: 8000,
    });

    await page.getByRole('button', { name: '+ Añadir pregunta' }).click();
    await page.getByLabel('Tipo de pregunta').selectOption('ESSAY');
    await page.getByLabel('Enunciado').fill('Explica brevemente cómo se relaciona HTML y CSS.');
    await page.getByLabel('Puntos').fill('2');
    await page.getByRole('button', { name: 'Añadir pregunta', exact: true }).click();
    await expect(page.getByText('Explica brevemente cómo se relaciona HTML y CSS.')).toBeVisible({
      timeout: 8000,
    });
    await expect(page.getByText('Preguntas (3)')).toBeVisible();

    await page.getByRole('button', { name: 'Publicar' }).click();
    await expect(page.getByText('Publicada').first()).toBeVisible({ timeout: 8000 });

    const activityId = new URL(page.url()).searchParams.get('activityId');
    expect(activityId).toBeTruthy();

    const studentView = await request.get(`${API}/activities/${activityId}`, {
      headers: { 'x-dev-user': STUDENT },
    });
    expect(studentView.ok()).toBeTruthy();
    const asStudent = (await studentView.json()) as ActivityDTO;
    assertNoAnswerKeys(asStudent.questions ?? []);

    await actAs(page, STUDENT);
    await openCourseActivities(page, COURSE_ID);
    await page.getByRole('button', { name: new RegExp(title) }).click();
    await page.getByRole('button', { name: /Empezar tarea|Reanudar intento/ }).click();
    await expect(page.getByText('Pregunta 1 · 1 pt')).toBeVisible({ timeout: 8000 });
    await page.getByRole('checkbox', { name: '4' }).check();
    await page.getByLabel('Relacionar HTML').selectOption({ label: 'Estructura' });
    await page.getByLabel('Relacionar CSS').selectOption({ label: 'Presentación' });
    await page.getByLabel('Respuesta para pregunta 3').fill(
      'HTML da la estructura y CSS la presentación.',
    );
    await page.getByRole('button', { name: 'Enviar tarea' }).click();
    await expect(page.getByRole('dialog').getByText(/sin responder|Has respondido todas/)).toBeVisible();
    await page.getByRole('button', { name: 'Sí, enviar' }).click();
    await expect(page.getByText(/pendiente de corrección/i).first()).toBeVisible({
      timeout: 8000,
    });

    const pending = await request.get(`${API}/activities/${activityId}/attempts/me`, {
      headers: { 'x-dev-user': STUDENT },
    });
    const mine = (await pending.json()) as AttemptDTO[];
    const submitted = mine.find((a) => a.status === 'SUBMITTED');
    expect(submitted).toBeTruthy();
    expect(submitted!.score).toBeNull();
    const awarded = submitted!.answers ?? [];
    const auto = awarded.filter((a) => a.awarded != null);
    const manual = awarded.filter((a) => a.awarded == null);
    expect(auto.length).toBe(2);
    expect(manual.length).toBe(1);

    await actAs(page, TEACHER);
    await openCourseActivities(page, COURSE_ID);
    await page.getByRole('button', { name: new RegExp(title) }).click();
    await expect(page.getByText('Por calificar').first()).toBeVisible({ timeout: 8000 });
    await page.getByRole('button', { name: 'Calificar' }).click();
    const gradeDialog = page.getByRole('dialog', { name: 'Calificar' });
    await expect(gradeDialog).toBeVisible();
    await gradeDialog
      .getByLabel(/Puntos de la pregunta \d/)
      .fill('2');
    // The student's answer is shown next to its own question.
    await expect(gradeDialog.getByText(/Explica brevemente cómo se relaciona HTML y CSS/)).toBeVisible();
    await gradeDialog.getByLabel(/Comentario para el alumno/).last().fill('Buen razonamiento.');
    await gradeDialog.getByLabel(/Feedback/).fill('Clarísimo.');
    await gradeDialog.getByRole('button', { name: 'Guardar nota' }).click();
    await expect(page.getByText('Calificado').first()).toBeVisible({ timeout: 8000 });

    await actAs(page, STUDENT);
    await openCourseGrades(page, COURSE_ID);
    await expect(page.getByRole('heading', { name: 'Mis notas' })).toBeVisible({
      timeout: 8000,
    });
    await expect(page.getByText(title)).toBeVisible();
    await expect(page.getByText(/3\/4|4\/4/).first()).toBeVisible();
    await expect(page.getByText('Nota final')).toBeVisible();
    await expect(page.getByText('%').first()).toBeVisible();

    await actAs(page, TEACHER);
    await openCourseGrades(page, COURSE_ID);
    await expect(page.getByRole('heading', { name: 'Calificaciones' })).toBeVisible({
      timeout: 8000,
    });
    const lucia = page.getByRole('row').filter({ hasText: 'Lucía Molina' });
    await expect(lucia.getByText(/\d+\.\d+%/)).toBeVisible();

    await archiveActivity(request, activityId!);
  });

  test('save as template then instantiate in another course; copy has 0 attempts', async ({
    page,
    request,
  }) => {
    const title = `E2E plantilla ${Date.now()}`;
    const { activity, questions } = await createPublishedMixed(request, { title });
    const submitted = await studentSubmitMixed(request, activity.id, questions);
    expect(submitted.status).toBe('SUBMITTED');
    const essay = questions.find((q) => q.kind === 'ESSAY')!;
    const graded = await gradeEssay(request, submitted.id, essay.id, 2, 'Ok');
    expect(graded.status).toBe('GRADED');

    const other = await request.post(`${API}/courses`, {
      headers: jsonHeaders(TEACHER),
      data: { title: `E2E curso ${Date.now()}`, status: 'PUBLISHED' },
    });
    expect(other.ok(), await other.text()).toBeTruthy();
    const otherCourse = (await other.json()) as { id: string };

    await openCourseActivities(page, COURSE_ID);
    await page.getByRole('button', { name: new RegExp(title) }).click();
    await page.getByRole('button', { name: 'Guardar plantilla' }).click();
    const templateDialog = page.getByRole('dialog', { name: 'Guardar como plantilla' });
    await expect(templateDialog.getByLabel('Nombre de la plantilla')).toHaveValue(title);
    await templateDialog.getByRole('button', { name: 'Guardar', exact: true }).click();
    await expect(page.getByText('Guardada como plantilla.')).toBeVisible({ timeout: 8000 });

    await openCourseActivities(page, otherCourse.id);
    await page.getByRole('button', { name: 'Biblioteca' }).click();
    const library = page.getByRole('dialog', { name: 'Biblioteca de tareas' });
    await expect(library).toBeVisible();
    const templateRow = library.getByRole('row').filter({ hasText: title });
    await templateRow.getByRole('button', { name: 'Usar en esta asignatura' }).click();
    await expect(page.getByRole('heading', { level: 2, name: title })).toBeVisible({
      timeout: 8000,
    });
    await expect(page.getByText('Preguntas (3)')).toBeVisible();
    await expect(page.getByText('Sin entregas todavía')).toBeVisible();

    await page.getByRole('button', { name: 'Biblioteca' }).click();
    const libraryAgain = page.getByRole('dialog', { name: 'Biblioteca de tareas' });
    await libraryAgain.getByRole('tab', { name: 'Anteriores' }).click();
    const previous = libraryAgain.getByRole('row').filter({ hasText: title }).first();
    await previous.getByRole('button', { name: 'Duplicar aquí' }).click();
    await expect(page.getByText('Tarea duplicada en esta asignatura.')).toBeVisible({
      timeout: 8000,
    });

    const copiesRes = await request.get(`${API}/subjects/${otherCourse.id}/activities`, {
      headers: { 'x-dev-user': TEACHER },
    });
    const copies = ((await copiesRes.json()) as ActivityDTO[]).filter((a) => a.title === title);
    expect(copies.length).toBeGreaterThanOrEqual(1);
    for (const copy of copies) {
      const attemptsRes = await request.get(`${API}/activities/${copy.id}/attempts`, {
        headers: { 'x-dev-user': TEACHER },
      });
      expect(attemptsRes.ok()).toBeTruthy();
      expect(await attemptsRes.json()).toEqual([]);
    }

    const originalAttempts = await request.get(`${API}/activities/${activity.id}/attempts`, {
      headers: { 'x-dev-user': TEACHER },
    });
    const original = (await originalAttempts.json()) as AttemptDTO[];
    expect(original.some((a) => a.status === 'GRADED' && a.score != null)).toBeTruthy();

    await archiveActivity(request, activity.id);
    for (const copy of copies) await archiveActivity(request, copy.id);
  });

  test('countsTowardFinal=false: student sees score; course final does not change', async ({
    page,
    request,
  }) => {
    const beforeRes = await request.get(`${API}/subjects/${COURSE_ID}/grades/me`, {
      headers: { 'x-dev-user': STUDENT },
    });
    expect(beforeRes.ok()).toBeTruthy();
    const before = (await beforeRes.json()) as MyGradesDTO;
    const finalBefore = before.final;

    const title = `E2E práctica ${Date.now()}`;
    await openCourseActivities(page, COURSE_ID);
    await page.getByRole('button', { name: '+ Nueva tarea' }).click();
    const create = page.getByRole('dialog', { name: 'Nueva tarea' });
    await create.getByLabel('Título').fill(title);
    await create.getByRole('switch', { name: 'Cuenta para la nota final' }).click();
    await expect(
      create.getByRole('switch', { name: 'Cuenta para la nota final' }),
    ).toHaveAttribute('aria-checked', 'false');
    await create.getByRole('button', { name: 'Crear tarea' }).click();
    await expect(page.getByRole('heading', { level: 2, name: title })).toBeVisible({
      timeout: 8000,
    });

    await page.getByRole('button', { name: '+ Añadir pregunta' }).click();
    await page.getByLabel('Enunciado').fill('¿Capital de España?');
    await page.getByLabel('Texto de la opción 1').fill('Madrid');
    await page.getByLabel('Texto de la opción 2').fill('Lisboa');
    await page.getByLabel('Opción 1 es correcta').check();
    await page.getByRole('button', { name: 'Añadir pregunta', exact: true }).click();
    await expect(page.getByText('¿Capital de España?')).toBeVisible({ timeout: 8000 });
    await page.getByRole('button', { name: 'Publicar' }).click();
    await expect(page.getByText('Publicada').first()).toBeVisible({ timeout: 8000 });
    await expect(page.getByText('Práctica').first()).toBeVisible();

    const activityId = new URL(page.url()).searchParams.get('activityId');
    expect(activityId).toBeTruthy();

    await actAs(page, STUDENT);
    await openCourseActivities(page, COURSE_ID);
    await page.getByRole('button', { name: new RegExp(title) }).click();
    await expect(page.getByText('práctica', { exact: false }).first()).toBeVisible();
    await page.getByRole('button', { name: /Empezar tarea|Reanudar intento/ }).click();
    await page.getByRole('checkbox', { name: 'Madrid' }).check();
    await page.getByRole('button', { name: 'Enviar tarea' }).click();
    await expect(page.getByRole('dialog').getByText(/sin responder|Has respondido todas/)).toBeVisible();
    await page.getByRole('button', { name: 'Sí, enviar' }).click();
    await expect(page.getByText(/Tarea corregida: 1\/1/)).toBeVisible({ timeout: 8000 });

    await openCourseGrades(page, COURSE_ID);
    await expect(page.getByRole('heading', { name: 'Mis notas' })).toBeVisible({
      timeout: 8000,
    });
    await expect(page.getByText(title)).toBeVisible();
    await expect(page.getByText('1/1').first()).toBeVisible();
    await expect(page.getByText('Práctica').first()).toBeVisible();

    const afterRes = await request.get(`${API}/subjects/${COURSE_ID}/grades/me`, {
      headers: { 'x-dev-user': STUDENT },
    });
    const after = (await afterRes.json()) as MyGradesDTO;
    expect(after.final).toEqual(finalBefore);
    const practice = after.items.find((i) => i.activityId === activityId);
    expect(practice).toMatchObject({
      countsTowardFinal: false,
      score: 1,
      status: 'GRADED',
    });

    await archiveActivity(request, activityId!);
  });

  test('outside window: UI blocks, API 400, student never sees answer keys', async ({
    page,
    request,
  }) => {
    const title = `E2E ventana ${Date.now()}`;
    await openCourseActivities(page, COURSE_ID);
    await page.getByRole('button', { name: '+ Nueva tarea' }).click();
    const create = page.getByRole('dialog', { name: 'Nueva tarea' });
    await create.getByLabel('Título').fill(title);
    await create.getByLabel('Cierre').fill('2000-01-01T10:00');
    await create.getByRole('button', { name: 'Crear tarea' }).click();
    await expect(page.getByRole('heading', { level: 2, name: title })).toBeVisible({
      timeout: 8000,
    });

    await page.getByRole('button', { name: '+ Añadir pregunta' }).click();
    await page.getByLabel('Enunciado').fill('¿Opción correcta?');
    await page.getByLabel('Texto de la opción 1').fill('Secreto');
    await page.getByLabel('Texto de la opción 2').fill('Distractor');
    await page.getByLabel('Opción 1 es correcta').check();
    await page.getByRole('button', { name: 'Añadir pregunta', exact: true }).click();
    await expect(page.getByText('¿Opción correcta?')).toBeVisible({ timeout: 8000 });
    await page.getByRole('button', { name: 'Publicar' }).click();
    await expect(page.getByText('Cerrada').first()).toBeVisible({ timeout: 8000 });

    const activityId = new URL(page.url()).searchParams.get('activityId');
    expect(activityId).toBeTruthy();

    const staffView = await request.get(`${API}/activities/${activityId}`, {
      headers: { 'x-dev-user': TEACHER },
    });
    const asStaff = (await staffView.json()) as ActivityDTO;
    expect(asStaff.questions?.[0]?.content).toHaveProperty('correct');

    const studentView = await request.get(`${API}/activities/${activityId}`, {
      headers: { 'x-dev-user': STUDENT },
    });
    expect(studentView.ok()).toBeTruthy();
    const asStudent = (await studentView.json()) as ActivityDTO;
    assertNoAnswerKeys(asStudent.questions ?? []);
    expect(JSON.stringify(asStudent)).not.toContain('"correct"');

    const start = await request.post(`${API}/activities/${activityId}/attempts`, {
      headers: { 'x-dev-user': STUDENT },
    });
    expect(start.status()).toBe(400);

    await actAs(page, STUDENT);
    await openCourseActivities(page, COURSE_ID);
    await page.getByRole('button', { name: new RegExp(title) }).click();
    await expect(page.getByText('El plazo de esta tarea ha terminado.')).toBeVisible({
      timeout: 8000,
    });
    await expect(page.getByRole('button', { name: /Empezar tarea/ })).toHaveCount(0);
    await expect(page.getByText('Secreto')).toHaveCount(0);

    await request.delete(`${API}/activities/${activityId}`, {
      headers: { 'x-dev-user': TEACHER },
    });
  });

  test('org-b teacher gets 404 on org-a template and activity', async ({ request }) => {
    const e2eProbe = await request.get(`${API}/task-templates`, {
      headers: { 'x-dev-user': 'e2e-b-teacher-001' },
    });
    let orgBUser = 'e2e-b-teacher-001';
    let orgATemplate = SEEDED_TEMPLATE;
    let orgAActivity = SEEDED_ACTIVITY;

    if (e2eProbe.status() === 401 || e2eProbe.status() === 404) {
      const login = await request.post(`${API}/auth/platform-login`, {
        data: { email: PLATFORM_EMAIL, password: PLATFORM_PASSWORD },
      });
      expect(login.ok(), `platform-login failed: ${await login.text()}`).toBeTruthy();
      const { accessToken } = (await login.json()) as { accessToken: string };
      const slug = `e2e-b-${Date.now()}`;
      const provisioned = await request.post(`${API}/platform/organizations`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        data: {
          name: 'E2E Org B',
          slug,
          adminEmail: `admin@${slug}.demo`,
          adminName: 'Admin Org B',
        },
      });
      expect(provisioned.ok(), await provisioned.text()).toBeTruthy();
      const { invitationToken } = (await provisioned.json()) as { invitationToken: string };

      const accepted = await request.post(
        `${API}/auth/invitations/${invitationToken}/accept`,
        {
          data: { name: 'Admin Org B', password: 'AdminOrgB1' },
        },
      );
      expect(accepted.ok(), await accepted.text()).toBeTruthy();
      const admin = (await accepted.json()) as { user: { userId: string } };

      const teacherRes = await request.post(`${API}/users`, {
        headers: jsonHeaders(admin.user.userId),
        data: {
          email: `teacher@${slug}.demo`,
          password: 'TeacherB1',
          name: 'Berta OrgB',
          role: 'TEACHER',
        },
      });
      expect(teacherRes.ok(), await teacherRes.text()).toBeTruthy();
      const teacher = (await teacherRes.json()) as { id: string };
      orgBUser = teacher.id;
      orgATemplate = SEEDED_TEMPLATE;
      orgAActivity = SEEDED_ACTIVITY;
    } else {
      orgATemplate = 'org-e2e-a-template-mixto';
      orgAActivity = 'e2e-a-course-01-activity-01';
    }

    const template = await request.get(`${API}/task-templates/${orgATemplate}`, {
      headers: { 'x-dev-user': orgBUser },
    });
    expect(template.status()).toBe(404);

    const activity = await request.get(`${API}/activities/${orgAActivity}`, {
      headers: { 'x-dev-user': orgBUser },
    });
    expect(activity.status()).toBe(404);

    const instantiate = await request.post(`${API}/subjects/${COURSE_ID}/activities`, {
      headers: jsonHeaders(orgBUser),
      data: { title: 'cross-org', templateId: orgATemplate },
    });
    expect(instantiate.status()).toBe(404);
  });
});
