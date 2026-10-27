/**
 * Reproducible data sets for local demos and manual QA.
 *
 * Set SEED_SCENARIO to standard, small, large, e2e, or platform. Every scenario
 * replaces application data, then creates the configured platform superadmin.
 */
import {
  ActivityType,
  AttemptStatus,
  CohortStatus,
  FriendStatus,
  PublicationStatus,
  SubjectStaffRole,
  GlobalRole,
  NotificationType,
  PlatformRole,
  Prisma,
  PrismaClient,
  QuestionKind,
} from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();
const DEMO_PASSWORD = 'demo1234';
const DAY = 24 * 60 * 60 * 1000;

type Scenario = 'standard' | 'small' | 'large' | 'e2e' | 'platform';

interface InstitutionOptions {
  id: string;
  slug: string;
  name: string;
  students: number;
  teachers: number;
  courses: number;
}

function userId(slug: string, role: string, index: number): string {
  return slug + '-' + role + '-' + String(index).padStart(3, '0');
}

function scenarioFromEnvironment(): Scenario {
  const positionalIndex = process.argv.indexOf('--scenario');
  const argument = process.argv.find((value) => value.startsWith('--scenario='))?.slice('--scenario='.length)
    ?? (positionalIndex >= 0 ? process.argv[positionalIndex + 1] : undefined);
  const scenario = (process.env.SEED_SCENARIO ?? argument ?? 'standard').toLowerCase();
  if (scenario === 'standard' || scenario === 'small' || scenario === 'large' || scenario === 'e2e' || scenario === 'platform') {
    return scenario;
  }
  throw new Error('Unknown seed scenario: ' + scenario);
}

function quizQuestions(activityId: string) {
  return [
    {
      id: activityId + '-question-01', activityId, kind: QuestionKind.MULTIPLE_CHOICE,
      prompt: '¿Cuál es la opción correcta?', points: 5, order: 0,
      content: { options: ['Opción correcta', 'Distractor'], correct: [0] },
    },
    {
      id: activityId + '-question-02', activityId, kind: QuestionKind.TRUE_FALSE,
      prompt: 'El contenido está disponible para el alumnado matriculado.', points: 5, order: 1,
      content: { answer: true },
    },
  ];
}

function essayFileQuestions(activityId: string) {
  return [
    {
      id: activityId + '-question-01', activityId, kind: QuestionKind.ESSAY,
      prompt: 'Desarrolla el tema con tus palabras.', points: 10, order: 0,
      content: {},
    },
    {
      id: activityId + '-question-02', activityId, kind: QuestionKind.FILE_UPLOAD,
      prompt: 'Adjunta un fichero de evidencia.', points: 0, order: 1,
      content: { maxFiles: 3 },
    },
  ];
}

function mixedExamBlocks() {
  return [
    {
      kind: QuestionKind.MULTIPLE_CHOICE, prompt: '¿Qué protocolo sirve la web?',
      points: 1, order: 0,
      content: { options: ['HTTP', 'SMTP', 'FTP'], correct: [0] },
    },
    {
      kind: QuestionKind.MULTIPLE_CHOICE, prompt: '¿Cuál es un lenguaje de estilos?',
      points: 1, order: 1,
      content: { options: ['CSS', 'SQL', 'Bash'], correct: [0] },
    },
    {
      kind: QuestionKind.MATCHING, prompt: 'Empareja cada término con su definición.',
      points: 1, order: 2,
      content: {
        left: ['HTML', 'CSS'],
        right: ['Estructura', 'Presentación'],
        pairs: [[0, 0], [1, 1]],
      },
    },
    {
      kind: QuestionKind.ESSAY, prompt: 'Explica brevemente cómo se relaciona HTML y CSS.',
      points: 2, order: 3, content: {},
    },
  ];
}

function requiredEnvironment(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(name + ' must be set before running the seed.');
  return value;
}

async function clearApplicationData(): Promise<void> {
  // Prisma, not raw SQL, remains the sole writer of application data.
  await prisma.$transaction(async (tx) => {
    await tx.answer.deleteMany();
    await tx.attempt.deleteMany();
    await tx.question.deleteMany();
    await tx.activityFile.deleteMany();
    await tx.taskTemplate.deleteMany();
    await tx.activity.deleteMany();
    await tx.subjectResource.deleteMany();
    await tx.learningResource.deleteMany();
    await tx.submissionFile.deleteMany();
    await tx.submission.deleteMany();
    await tx.assignmentFile.deleteMany();
    await tx.assignment.deleteMany();
    await tx.lessonCompletion.deleteMany();
    await tx.lessonAttachment.deleteMany();
    await tx.lesson.deleteMany();
    await tx.section.deleteMany();
    await tx.forumPost.deleteMany();
    await tx.forumThread.deleteMany();
    await tx.subjectStaff.deleteMany();
    await tx.courseMembership.deleteMany();
    await tx.notification.deleteMany();
    await tx.friendship.deleteMany();
    await tx.file.deleteMany();
    await tx.subject.deleteMany();
    await tx.course.deleteMany();
    await tx.organizationInvitation.deleteMany();
    await tx.auditLog.deleteMany();
    await tx.session.deleteMany();
    await tx.user.deleteMany();
    await tx.organization.deleteMany();
  });
}

async function createPlatformSuperadmin(): Promise<{ email: string; password: string }> {
  const email = requiredEnvironment('PLATFORM_SUPERADMIN_EMAIL').toLowerCase();
  const password = requiredEnvironment('PLATFORM_SUPERADMIN_PASSWORD');
  const name = process.env.PLATFORM_SUPERADMIN_NAME?.trim() || 'Platform Administrator';

  if (password.length < 8 || !/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password)) {
    throw new Error('PLATFORM_SUPERADMIN_PASSWORD must include uppercase, lowercase, and a number.');
  }
  await prisma.user.create({
    data: {
      email,
      name,
      passwordHash: await argon2.hash(password),
      emailVerifiedAt: new Date(),
      role: GlobalRole.STUDENT,
      platformRole: PlatformRole.SUPERADMIN,
    },
  });
  return { email, password };
}

async function createInstitution(options: InstitutionOptions, passwordHash: string): Promise<void> {
  const now = new Date();
  const org = await prisma.organization.create({
    data: { id: options.id, slug: options.slug, name: options.name, primaryColor: '#2563eb' },
  });
  const teacherIds = Array.from({ length: options.teachers }, (_, index) => userId(options.slug, 'teacher', index + 1));
  const studentIds = Array.from({ length: options.students }, (_, index) => userId(options.slug, 'student', index + 1));
  const adminId = userId(options.slug, 'admin', 1);

  await prisma.user.createMany({
    data: [
      {
        id: adminId, organizationId: org.id, email: 'admin@' + options.slug + '.demo',
        name: 'Administración ' + options.name, role: GlobalRole.ADMIN, passwordHash, emailVerifiedAt: now,
      },
      ...teacherIds.map((id, index) => ({
        id, organizationId: org.id, email: 'teacher' + String(index + 1).padStart(3, '0') + '@' + options.slug + '.demo',
        name: 'Profesor/a ' + String(index + 1), role: GlobalRole.TEACHER, passwordHash, emailVerifiedAt: now,
      })),
      ...studentIds.map((id, index) => ({
        id, organizationId: org.id, email: 'student' + String(index + 1).padStart(3, '0') + '@' + options.slug + '.demo',
        name: 'Alumno/a ' + String(index + 1), role: GlobalRole.STUDENT, passwordHash, emailVerifiedAt: now,
      })),
    ],
  });

  const templates = [
    ['Desarrollo Web', 'Programación'],
    ['Inglés Profesional', 'Idiomas'],
    ['Matemáticas Aplicadas', 'Ciencias'],
    ['Diseño de Interfaces', 'Diseño'],
    ['Competencias Digitales', 'Tecnología'],
    ['Comunicación y Proyecto', 'Habilidades'],
  ];
  const subjectIds = Array.from({ length: options.courses }, (_, index) => options.slug + '-subject-' + String(index + 1).padStart(2, '0'));
  // One active cohort, plus archived history when there is more than one subject.
  const cohortCount = options.courses <= 1 ? 1 : Math.min(3, options.courses);
  const cohorts = Array.from({ length: cohortCount }, (_, index) => {
    const startYear = 2025 - index;
    return {
      id: options.slug + '-cohort-' + String(index + 1).padStart(2, '0'),
      organizationId: org.id,
      name: '1º A',
      academicYear: startYear + '-' + (startYear + 1),
      startsOn: new Date(Date.UTC(startYear, 8, 1)),
      endsOn: new Date(Date.UTC(startYear + 1, 5, 30)),
      status: index === 0 ? CohortStatus.ACTIVE : CohortStatus.ARCHIVED,
    };
  });
  await prisma.course.createMany({ data: cohorts });
  await prisma.subject.createMany({
    data: subjectIds.map((id, index) => {
      const template = templates[index % templates.length];
      const cohort = cohorts[index % cohorts.length];
      return {
        id, organizationId: org.id, courseId: cohort.id,
        title: template[0], category: template[1],
        description: 'Itinerario práctico para ' + options.name + '.',
        status: PublicationStatus.PUBLISHED,
      };
    }),
  });

  const sections = subjectIds.flatMap((subjectId) => [
    { id: subjectId + '-section-01', subjectId, title: 'Libro 1 · Fundamentos', order: 0 },
    { id: subjectId + '-section-02', subjectId, title: 'Libro 2 · Aplicación', order: 1 },
  ]);
  await prisma.section.createMany({ data: sections });
  const lessons = sections.flatMap((section) => [0, 1].map((order) => ({
    id: section.id + '-lesson-' + String(order + 1).padStart(2, '0'),
    sectionId: section.id,
    title: order === 0 ? 'Lectura y conceptos clave' : 'Taller guiado',
    contentMd: '# ' + section.title + '\n\nMaterial de demostración para ' + options.name + '.',
    order,
  })));
  await prisma.lesson.createMany({ data: lessons });

  // No new Assignment rows — unified tasks live on Activity (quiz + ESSAY/FILE).
  const quizActivities = subjectIds.map((subjectId) => ({
    id: subjectId + '-activity-01', subjectId, type: ActivityType.QUIZ,
    title: 'Autoevaluación de la unidad', description: 'Cuestionario de práctica con corrección automática.',
    dueAt: new Date(now.getTime() + 5 * DAY), maxScore: 10, attemptsAllowed: 2,
    countsTowardFinal: true,
    config: { showSolutions: true, shuffleQuestions: false, shuffleOptions: false },
    status: PublicationStatus.PUBLISHED,
  }));
  const essayActivities = subjectIds.map((subjectId, subjectIndex) => ({
    id: subjectId + '-activity-02', subjectId, type: ActivityType.QUIZ,
    title: 'Tarea · Ensayo y fichero',
    description: 'Desarrolla la respuesta y adjunta un fichero de evidencia.',
    openAt: new Date(now.getTime() - DAY),
    dueAt: new Date(now.getTime() + (subjectIndex + 4) * DAY),
    maxScore: 10, attemptsAllowed: 1, countsTowardFinal: true,
    config: { showSolutions: false },
    status: PublicationStatus.PUBLISHED,
  }));
  await prisma.activity.createMany({ data: [...quizActivities, ...essayActivities] });
  await prisma.question.createMany({
    data: [
      ...quizActivities.flatMap((activity) => quizQuestions(activity.id)),
      ...essayActivities.flatMap((activity) => essayFileQuestions(activity.id)),
    ],
  });
  await prisma.taskTemplate.create({
    data: {
      id: options.id + '-template-mixto',
      organizationId: org.id,
      createdById: teacherIds[0],
      title: 'Examen mixto',
      description: 'Dos opción múltiple, emparejar y un desarrollo.',
      blocks: mixedExamBlocks(),
    },
  });

  const staffRows = teacherIds.map((userId, index) => ({
    subjectId: subjectIds[index % subjectIds.length],
    userId,
    role: SubjectStaffRole.TEACHER,
  }));
  const staffKeys = new Set<string>();
  await prisma.subjectStaff.createMany({
    data: staffRows.filter((row) => {
      const key = row.subjectId + ':' + row.userId;
      if (staffKeys.has(key)) return false;
      staffKeys.add(key);
      return true;
    }),
  });

  const activeCohort = cohorts[0];
  const archivedCohort = cohorts.length > 1 ? cohorts[1] : undefined;
  const membershipCandidates = studentIds.flatMap((userId, index) => {
    const primary = { courseId: activeCohort.id, userId };
    const history = archivedCohort && index % 4 === 0
      ? [{ courseId: archivedCohort.id, userId }]
      : [];
    return [primary, ...history];
  });
  const membershipKeys = new Set<string>();
  await prisma.courseMembership.createMany({
    data: membershipCandidates.filter((membership) => {
      const key = membership.courseId + ':' + membership.userId;
      if (membershipKeys.has(key)) return false;
      membershipKeys.add(key);
      return true;
    }),
  });

  await prisma.lessonCompletion.createMany({
    data: studentIds.slice(0, Math.min(30, studentIds.length)).flatMap((userId, index) => {
      const subjectId = subjectIds[index % subjectIds.length];
      return lessons.filter((lesson) => lesson.sectionId.startsWith(subjectId + '-')).slice(0, 2)
        .map((lesson) => ({ lessonId: lesson.id, userId }));
    }),
  });
  const threads = subjectIds.map((subjectId, index) => ({
    id: subjectId + '-thread-01', subjectId, authorId: teacherIds[index % teacherIds.length],
    title: 'Bienvenida y dudas de la unidad', pinned: true,
  }));
  await prisma.forumThread.createMany({ data: threads });
  await prisma.forumPost.createMany({
    data: threads.flatMap((thread, index) => [
      { id: thread.id + '-post-01', threadId: thread.id, authorId: thread.authorId, body: 'Dejad aquí las dudas que os surjan durante la unidad.' },
      { id: thread.id + '-post-02', threadId: thread.id, authorId: studentIds[index % studentIds.length], body: 'Gracias, revisaré el material antes de la entrega.' },
    ]),
  });
  await prisma.notification.createMany({
    data: studentIds.map((userId, index) => ({
      userId, type: index % 2 === 0 ? NotificationType.NEW_ASSIGNMENT : NotificationType.DEADLINE_REMINDER,
      title: index % 2 === 0 ? 'Nueva tarea disponible' : 'Recordatorio de entrega',
      body: 'Consulta el curso para ver el material y las fechas de la actividad.',
      link: '/courses/' + cohorts[index % cohorts.length].id + '/subjects/' + subjectIds[index % subjectIds.length], read: index % 3 === 0,
    })),
  });
}

async function seedStandard(passwordHash: string): Promise<void> {
  const now = new Date();
  const org = await prisma.organization.create({
    data: { id: 'org-klass-0001', name: 'Klass Academy', slug: 'klass', primaryColor: '#2563eb' },
  });
  const users = [
    ['user-lucia-001', 'dev@example.com', 'Lucía Molina', GlobalRole.STUDENT],
    ['user-diego-001', 'diego@example.com', 'Diego Torres', GlobalRole.TEACHER],
    ['user-admin-001', 'admin@example.com', 'Admin Klass', GlobalRole.ADMIN],
    ['user-admin-0001', 'admin@demo', 'Ada Admin', GlobalRole.ADMIN],
    ['user-teacher-0001', 'teacher@demo', 'Theo Teacher', GlobalRole.TEACHER],
    ['user-student-0001', 'student@demo', 'Sam Student', GlobalRole.STUDENT],
  ] as const;
  await prisma.user.createMany({
    data: users.map(([id, email, name, role]) => ({
      id, email, name, role, passwordHash, emailVerifiedAt: now, organizationId: org.id,
    })),
  });
  await prisma.course.createMany({
    data: [
      {
        id: 'course-klass-2025', organizationId: org.id, name: '1º A', academicYear: '2025-2026',
        startsOn: new Date('2026-09-01T00:00:00.000Z'), endsOn: new Date('2027-06-30T00:00:00.000Z'),
        status: CohortStatus.ACTIVE,
      },
      {
        id: 'course-klass-2024', organizationId: org.id, name: '1º A', academicYear: '2024-2025',
        startsOn: new Date('2024-09-01T00:00:00.000Z'), endsOn: new Date('2025-06-30T00:00:00.000Z'),
        status: CohortStatus.ARCHIVED,
      },
    ],
  });
  await prisma.subject.createMany({
    data: [
      {
        id: 'course-web-101', organizationId: org.id, courseId: 'course-klass-2025',
        title: 'Introducción al Desarrollo Web', description: 'HTML, CSS, JavaScript y fundamentos de la web.',
        category: 'Programación', status: PublicationStatus.PUBLISHED,
      },
      {
        id: 'subject-web-100', organizationId: org.id, courseId: 'course-klass-2024',
        title: 'Introducción al Desarrollo Web (2024-2025)',
        description: 'Edición anterior del mismo itinerario.',
        category: 'Programación', status: PublicationStatus.PUBLISHED,
      },
    ],
  });
  await prisma.courseMembership.createMany({
    data: [
      { courseId: 'course-klass-2025', userId: 'user-lucia-001' },
      { courseId: 'course-klass-2024', userId: 'user-lucia-001' },
      { courseId: 'course-klass-2025', userId: 'user-student-0001' },
      { courseId: 'course-klass-2024', userId: 'user-student-0001' },
    ],
  });
  await prisma.subjectStaff.createMany({
    data: [
      { subjectId: 'course-web-101', userId: 'user-diego-001', role: SubjectStaffRole.TEACHER },
      { subjectId: 'course-web-101', userId: 'user-teacher-0001', role: SubjectStaffRole.TEACHER },
    ],
  });
  await prisma.friendship.create({
    data: {
      requesterId: 'user-lucia-001',
      addresseeId: 'user-diego-001',
      status: FriendStatus.ACCEPTED,
    },
  });
  await prisma.section.createMany({
    data: [
      { id: 'section-web-101-1', subjectId: 'course-web-101', title: 'Libro 1 · Fundamentos', order: 0 },
      { id: 'section-web-101-2', subjectId: 'course-web-101', title: 'Libro 2 · Proyecto', order: 1 },
      { id: 'section-web-100-1', subjectId: 'subject-web-100', title: 'Libro 1 · Fundamentos (2024)', order: 0 },
    ],
  });
  await prisma.lesson.createMany({
    data: [
      { id: 'lesson-web-101-1', sectionId: 'section-web-101-1', title: '¿Cómo funciona la web?', contentMd: '# La Web\nCliente, servidor y HTTP.', order: 0 },
      { id: 'lesson-web-101-2', sectionId: 'section-web-101-1', title: 'HTML semántico', contentMd: '# HTML\nEstructura y contenido accesible.', order: 1 },
      { id: 'lesson-web-101-3', sectionId: 'section-web-101-2', title: 'CSS responsive', contentMd: '# CSS\nDiseño adaptable.', order: 0 },
    ],
  });
  await prisma.activity.createMany({
    data: [
      {
        id: 'activity-web-101-quiz', subjectId: 'course-web-101', type: ActivityType.QUIZ,
        title: 'Autoevaluación de la unidad', description: 'Cuestionario de práctica con corrección automática.',
        dueAt: new Date(now.getTime() + 7 * DAY), maxScore: 10, attemptsAllowed: 2,
        countsTowardFinal: true,
        config: { showSolutions: true, shuffleQuestions: false, shuffleOptions: false },
        status: PublicationStatus.PUBLISHED,
      },
      {
        id: 'activity-web-101-essay', subjectId: 'course-web-101', type: ActivityType.QUIZ,
        title: 'Tarea · Ensayo y fichero',
        description: 'Desarrolla la respuesta y adjunta un fichero de evidencia.',
        dueAt: new Date(now.getTime() + 14 * DAY), maxScore: 10, attemptsAllowed: 1,
        countsTowardFinal: true,
        config: { showSolutions: false },
        status: PublicationStatus.PUBLISHED,
      },
    ],
  });
  await prisma.question.createMany({
    data: [
      ...quizQuestions('activity-web-101-quiz'),
      ...essayFileQuestions('activity-web-101-essay'),
    ],
  });
  await prisma.taskTemplate.create({
    data: {
      id: 'template-klass-mixto',
      organizationId: org.id,
      createdById: 'user-diego-001',
      title: 'Examen mixto',
      description: 'Dos opción múltiple, emparejar y un desarrollo.',
      blocks: mixedExamBlocks(),
    },
  });
  await prisma.lessonCompletion.create({ data: { lessonId: 'lesson-web-101-1', userId: 'user-lucia-001' } });
  await prisma.forumThread.create({
    data: { id: 'thread-web-101-1', subjectId: 'course-web-101', authorId: 'user-diego-001', title: 'Presentaciones', pinned: true },
  });
  await prisma.forumPost.createMany({
    data: [
      { id: 'post-web-101-1', threadId: 'thread-web-101-1', authorId: 'user-diego-001', body: 'Bienvenidos al curso.' },
      { id: 'post-web-101-2', threadId: 'thread-web-101-1', authorId: 'user-lucia-001', body: '¡Hola a todos!' },
    ],
  });
  await prisma.notification.create({
    data: {
      userId: 'user-lucia-001', type: NotificationType.GRADE_PUBLISHED, title: 'Nota publicada',
      body: 'Tu primera entrega ya tiene nota.', link: '/activities?activityId=activity-web-101-quiz',
    },
  });
  await seedStandardAcademicActivity(now);
}

const WEB_SUBJECT = 'course-web-101';
const QUIZ_ID = 'activity-web-101-quiz';
const ESSAY_ID = 'activity-web-101-essay';
const NEXT_QUIZ_ID = 'activity-web-101-quiz-http';

interface SeedQuestion {
  id: string;
  kind: QuestionKind;
  points: number;
  content: Prisma.InputJsonValue;
}

/**
 * Same all-or-nothing rule as the runtime graders (activities/grading/graders.ts)
 * for the two objective kinds the demo uses. It is repeated here instead of
 * imported because the runtime image only ships `dist/` and `prisma/`, and the
 * seed runs with tsx straight from `prisma/`.
 */
function autoGrade(question: SeedQuestion, response: Prisma.InputJsonObject): { correct: boolean; awarded: number } {
  const content = question.content as Record<string, unknown>;
  let correct: boolean;
  if (question.kind === QuestionKind.MULTIPLE_CHOICE) {
    const expected = new Set(content.correct as number[]);
    const selected = new Set(response.selected as number[]);
    correct = expected.size === selected.size && [...expected].every((index) => selected.has(index));
  } else if (question.kind === QuestionKind.TRUE_FALSE) {
    correct = response.value === content.answer;
  } else {
    throw new Error('autoGrade only supports MULTIPLE_CHOICE and TRUE_FALSE, got ' + question.kind);
  }
  return { correct, awarded: correct ? question.points : 0 };
}

/**
 * Attempts, grades, notifications and one pending friend request for the
 * standard demo, so analytics, gradebook, "Mis notas" and both dashboards have
 * data without anyone working by hand first. Timestamps are relative to `now`
 * (spread over the last 9 days) so the date-range charts always show a curve.
 * Only touches the active 2025-2026 subject; the archived cohort stays bare.
 * Attempt, Answer, Notification and Friendship carry no organizationId column:
 * every row hangs off the `klass` users and subject created by seedStandard.
 */
async function seedStandardAcademicActivity(now: Date): Promise<void> {
  const at = (daysAgo: number, minutes = 0) => new Date(now.getTime() - daysAgo * DAY + minutes * 60 * 1000);
  const lucia = 'user-lucia-001';
  const sam = 'user-student-0001';
  const diego = 'user-diego-001';
  const theo = 'user-teacher-0001';

  // A second, short task due in 3 days that nobody has started yet.
  const nextQuizQuestions: SeedQuestion[] = [
    {
      id: NEXT_QUIZ_ID + '-question-01', kind: QuestionKind.MULTIPLE_CHOICE, points: 5,
      content: { options: ['HTTP', 'SMTP', 'FTP'], correct: [0] },
    },
    {
      id: NEXT_QUIZ_ID + '-question-02', kind: QuestionKind.TRUE_FALSE, points: 5,
      content: { answer: true },
    },
  ];
  await prisma.activity.create({
    data: {
      id: NEXT_QUIZ_ID, subjectId: WEB_SUBJECT, type: ActivityType.QUIZ,
      title: 'Quiz rápido · HTTP y HTML',
      description: 'Dos preguntas de repaso con corrección automática.',
      openAt: at(1), dueAt: new Date(now.getTime() + 3 * DAY), maxScore: 10, attemptsAllowed: 2,
      countsTowardFinal: true,
      config: { showSolutions: true, shuffleQuestions: false, shuffleOptions: false },
      status: PublicationStatus.PUBLISHED,
    },
  });
  await prisma.question.createMany({
    data: [
      {
        ...nextQuizQuestions[0], activityId: NEXT_QUIZ_ID, order: 0,
        prompt: '¿Qué protocolo usa el navegador para pedir una página web?',
      },
      {
        ...nextQuizQuestions[1], activityId: NEXT_QUIZ_ID, order: 1,
        prompt: 'HTML describe la estructura de una página, no su aspecto.',
      },
    ],
  });

  // ─── Quiz "Autoevaluación de la unidad": two graded attempts for Lucía, one for Sam ───
  const quizQuestions: SeedQuestion[] = [
    { id: QUIZ_ID + '-question-01', kind: QuestionKind.MULTIPLE_CHOICE, points: 5, content: { options: ['Opción correcta', 'Distractor'], correct: [0] } },
    { id: QUIZ_ID + '-question-02', kind: QuestionKind.TRUE_FALSE, points: 5, content: { answer: true } },
  ];
  const quizAttempts = [
    { id: 'attempt-web-101-quiz-lucia-1', userId: lucia, attemptNo: 1, daysAgo: 9, minutes: 12, responses: [{ selected: [1] }, { value: true }] },
    { id: 'attempt-web-101-quiz-lucia-2', userId: lucia, attemptNo: 2, daysAgo: 7, minutes: 8, responses: [{ selected: [0] }, { value: true }] },
    { id: 'attempt-web-101-quiz-sam-1', userId: sam, attemptNo: 1, daysAgo: 5, minutes: 15, responses: [{ selected: [0] }, { value: false }] },
  ];
  const quizScores = new Map<string, number>();
  for (const attempt of quizAttempts) {
    const graded = attempt.responses.map((response, index) => ({
      question: quizQuestions[index], response, ...autoGrade(quizQuestions[index], response),
    }));
    const score = graded.reduce((sum, answer) => sum + answer.awarded, 0);
    quizScores.set(attempt.id, score);
    const submittedAt = at(attempt.daysAgo);
    await prisma.attempt.create({
      data: {
        id: attempt.id, activityId: QUIZ_ID, userId: attempt.userId, attemptNo: attempt.attemptNo,
        status: AttemptStatus.GRADED, startedAt: at(attempt.daysAgo, -attempt.minutes),
        submittedAt, gradedAt: submittedAt, score,
        answers: {
          create: graded.map((answer) => ({
            id: attempt.id + '-answer-' + answer.question.id.slice(-2),
            questionId: answer.question.id, response: answer.response,
            correct: answer.correct, awarded: answer.awarded,
            createdAt: submittedAt,
          })),
        },
      },
    });
  }

  // ─── Task "Ensayo y fichero": graded for Lucía, waiting for the teacher for Sam ───
  // FILE_UPLOAD answers keep fileIds: [] — the seed never creates File rows
  // because there is no blob behind them.
  const essayQuestions = [ESSAY_ID + '-question-01', ESSAY_ID + '-question-02'];
  const luciaEssaySubmitted = at(3);
  const luciaEssayGraded = at(2);
  const luciaEssayId = 'attempt-web-101-essay-lucia-1';
  const luciaEssayAwarded = 8.5;
  await prisma.attempt.create({
    data: {
      id: luciaEssayId, activityId: ESSAY_ID, userId: lucia, attemptNo: 1,
      status: AttemptStatus.GRADED, startedAt: at(3, -40),
      submittedAt: luciaEssaySubmitted, gradedAt: luciaEssayGraded, gradedById: diego,
      score: luciaEssayAwarded,
      feedback: 'Buen trabajo: estructura clara y ejemplos acertados. Para la próxima, cita las fuentes que uses.',
      answers: {
        create: [
          {
            id: luciaEssayId + '-answer-01', questionId: essayQuestions[0],
            response: {
              text: 'La web funciona con un modelo cliente-servidor: el navegador envía una petición HTTP y el servidor responde con HTML, CSS y JavaScript. '
                + 'HTML aporta la estructura y el significado del contenido, CSS controla su presentación y JavaScript añade comportamiento. '
                + 'Separar estas tres capas facilita el mantenimiento y mejora la accesibilidad.',
            },
            awarded: luciaEssayAwarded,
            feedback: 'Explicas bien el reparto de responsabilidades. Falta mencionar HTTPS.',
            createdAt: luciaEssaySubmitted,
          },
          {
            id: luciaEssayId + '-answer-02', questionId: essayQuestions[1],
            response: { fileIds: [] }, awarded: 0, createdAt: luciaEssaySubmitted,
          },
        ],
      },
    },
  });
  const samEssayId = 'attempt-web-101-essay-sam-1';
  const samEssaySubmitted = at(1);
  await prisma.attempt.create({
    data: {
      id: samEssayId, activityId: ESSAY_ID, userId: sam, attemptNo: 1,
      status: AttemptStatus.SUBMITTED, startedAt: at(1, -25), submittedAt: samEssaySubmitted,
      answers: {
        create: [
          {
            id: samEssayId + '-answer-01', questionId: essayQuestions[0],
            response: {
              text: 'Cuando escribo una dirección en el navegador, este pide la página al servidor mediante HTTP. '
                + 'El servidor devuelve un documento HTML y el navegador lo pinta junto con sus estilos.',
            },
            createdAt: samEssaySubmitted,
          },
          { id: samEssayId + '-answer-02', questionId: essayQuestions[1], response: { fileIds: [] }, createdAt: samEssaySubmitted },
        ],
      },
    },
  });

  // Sam's first completed lesson (Lucía already has lesson 1).
  await prisma.lessonCompletion.create({ data: { lessonId: 'lesson-web-101-1', userId: sam } });

  // Pending friend request Diego → Sam.
  await prisma.friendship.create({
    data: { requesterId: diego, addresseeId: sam, status: FriendStatus.PENDING, createdAt: at(0, -90) },
  });

  // Notifications with the same titles/links the real emitters produce.
  const subjectTitle = 'Introducción al Desarrollo Web';
  const quizTitle = 'Autoevaluación de la unidad';
  const essayTitle = 'Tarea · Ensayo y fichero';
  const nextQuizTitle = 'Quiz rápido · HTTP y HTML';
  const published = {
    type: NotificationType.ACTIVITY_PUBLISHED,
    title: 'Nueva tarea publicada: ' + nextQuizTitle + ' en ' + subjectTitle,
    link: '/activities?subjectId=' + WEB_SUBJECT + '&activityId=' + NEXT_QUIZ_ID,
  };
  await prisma.notification.createMany({
    data: [
      {
        userId: sam, type: NotificationType.GRADE_PUBLISHED, title: 'Actividad calificada',
        body: 'Tu intento 1 de «' + quizTitle + '» ha sido calificado: ' + quizScores.get('attempt-web-101-quiz-sam-1') + '/10',
        link: '/activities?activityId=' + QUIZ_ID, read: true, createdAt: at(5),
      },
      { userId: sam, ...published, createdAt: at(1) },
      {
        userId: sam, type: NotificationType.FRIEND_REQUEST, title: 'Tienes una nueva solicitud de amistad',
        body: 'Puedes revisar tus solicitudes desde Amigos.', link: '/friends', createdAt: at(0, -90),
      },
      { userId: lucia, ...published, createdAt: at(1) },
      {
        userId: lucia, type: NotificationType.GRADE_PUBLISHED, title: 'Actividad calificada',
        body: 'Tu intento 1 de «' + essayTitle + '» ha sido calificado: ' + luciaEssayAwarded + '/10',
        link: '/activities?activityId=' + ESSAY_ID, createdAt: luciaEssayGraded,
      },
      ...[theo, diego].map((userId) => ({
        userId, type: NotificationType.SUBMISSION_RECEIVED, title: 'Nueva entrega para corregir',
        body: 'Sam Student ha entregado «' + essayTitle + '»',
        link: '/grades?subjectId=' + WEB_SUBJECT + '&activityId=' + ESSAY_ID + '&attemptId=' + samEssayId,
        createdAt: samEssaySubmitted,
      })),
    ],
  });
}

function numberedEmail(prefix: string, slug: string, index: number): string {
  return prefix + String(index).padStart(3, '0') + '@' + slug + '.demo';
}

function roleAccounts(prefix: string, slug: string, count: number): string {
  const first = numberedEmail(prefix, slug, 1);
  if (count <= 1) return first;
  return first + ' … ' + numberedEmail(prefix, slug, count);
}

function institutionLogins(slug: string, students: number, teachers: number): string[] {
  return [
    '   organization code    ' + slug,
    '   admin                admin@' + slug + '.demo',
    '   teacher              ' + roleAccounts('teacher', slug, teachers),
    '   student              ' + roleAccounts('student', slug, students),
    '   password             ' + DEMO_PASSWORD,
  ];
}

function printSeedSummary(
  scenario: Scenario,
  superadmin: { email: string; password: string },
  institutions: readonly InstitutionOptions[],
): void {
  const lines = [
    '',
    '✅ Seed scenario "' + scenario + '" complete.',
    '   platform login       /platform/login  (no organization code)',
    '   email                ' + superadmin.email,
    '   password             ' + superadmin.password,
  ];
  if (scenario === 'standard') {
    lines.push(
      '   organization code    klass',
      '   admin                admin@demo',
      '   teacher              teacher@demo',
      '   student              student@demo',
      '   password             ' + DEMO_PASSWORD,
      '   also                 admin@example.com (admin), diego@example.com (teacher), dev@example.com (student)',
    );
  } else if (institutions.length > 0) {
    for (const institution of institutions) {
      lines.push(...institutionLogins(institution.slug, institution.students, institution.teachers));
    }
  } else {
    lines.push('   application data     removed (only the platform superadmin remains)');
  }
  console.log(lines.join('\n'));
}

async function main(): Promise<void> {
  const scenario = scenarioFromEnvironment();
  await clearApplicationData();
  const superadmin = await createPlatformSuperadmin();
  const institutions: InstitutionOptions[] = [];
  if (scenario !== 'platform') {
    const passwordHash = await argon2.hash(DEMO_PASSWORD);
    if (scenario === 'standard') {
      await seedStandard(passwordHash);
    } else if (scenario === 'small') {
      institutions.push({ id: 'org-demo-small', slug: 'demo-small', name: 'Academia Demo', students: 8, teachers: 3, courses: 3 });
    } else if (scenario === 'e2e') {
      // Two tenants with explicit IDs so an acceptance test can show that an
      // ID from one organization is rejected by the other. Generic demos are
      // not a substitute: their IDs are harder to read in a failing trace.
      institutions.push(
        { id: 'org-e2e-a', slug: 'e2e-a', name: 'E2E Academy A', students: 2, teachers: 1, courses: 1 },
        { id: 'org-e2e-b', slug: 'e2e-b', name: 'E2E Academy B', students: 2, teachers: 1, courses: 1 },
      );
    } else {
      institutions.push(
        { id: 'org-demo-large', slug: 'demo-large', name: 'Academia Horizonte', students: 160, teachers: 30, courses: 6 },
        { id: 'org-demo-medium', slug: 'demo-medium', name: 'Instituto Atlas', students: 120, teachers: 24, courses: 5 },
        { id: 'org-demo-compact', slug: 'demo-compact', name: 'Centro Nexo', students: 100, teachers: 20, courses: 4 },
      );
    }
    for (const institution of institutions) {
      await createInstitution(institution, passwordHash);
    }
  }
  printSeedSummary(scenario, superadmin, institutions);
}

main()
  .catch((error: unknown) => {
    console.error('Seed failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
