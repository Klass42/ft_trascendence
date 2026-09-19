/**
 * Reproducible data sets for local demos and manual QA.
 *
 * Set SEED_SCENARIO to standard, small, large, e2e, or platform. Every scenario
 * replaces application data, then creates the configured platform superadmin.
 */
import {
  ActivityType,
  CourseRole,
  CourseStatus,
  FriendStatus,
  GlobalRole,
  NotificationType,
  PlatformRole,
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
    await tx.courseResource.deleteMany();
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
    await tx.enrollment.deleteMany();
    await tx.notification.deleteMany();
    await tx.friendship.deleteMany();
    await tx.file.deleteMany();
    await tx.course.deleteMany();
    await tx.organizationInvitation.deleteMany();
    await tx.auditLog.deleteMany();
    await tx.session.deleteMany();
    await tx.user.deleteMany();
    await tx.organization.deleteMany();
  });
}

async function createPlatformSuperadmin(): Promise<string> {
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
  return email;
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
  const courseIds = Array.from({ length: options.courses }, (_, index) => options.slug + '-course-' + String(index + 1).padStart(2, '0'));
  await prisma.course.createMany({
    data: courseIds.map((id, index) => {
      const template = templates[index % templates.length];
      return {
        id, organizationId: org.id, ownerId: teacherIds[index % teacherIds.length],
        title: template[0], category: template[1],
        description: 'Itinerario práctico para ' + options.name + '.',
        accessCode: options.slug.replaceAll('-', '').slice(0, 8).toUpperCase() + String(index + 1).padStart(2, '0'),
        status: CourseStatus.PUBLISHED,
      };
    }),
  });

  const sections = courseIds.flatMap((courseId) => [
    { id: courseId + '-section-01', courseId, title: 'Libro 1 · Fundamentos', order: 0 },
    { id: courseId + '-section-02', courseId, title: 'Libro 2 · Aplicación', order: 1 },
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
  const quizActivities = courseIds.map((courseId) => ({
    id: courseId + '-activity-01', courseId, type: ActivityType.QUIZ,
    title: 'Autoevaluación de la unidad', description: 'Cuestionario de práctica con corrección automática.',
    dueAt: new Date(now.getTime() + 5 * DAY), maxScore: 10, attemptsAllowed: 2,
    countsTowardFinal: true,
    config: { showSolutions: true, shuffleQuestions: false, shuffleOptions: false },
    status: CourseStatus.PUBLISHED,
  }));
  const essayActivities = courseIds.map((courseId, courseIndex) => ({
    id: courseId + '-activity-02', courseId, type: ActivityType.QUIZ,
    title: 'Tarea · Ensayo y fichero',
    description: 'Desarrolla la respuesta y adjunta un fichero de evidencia.',
    openAt: new Date(now.getTime() - DAY),
    dueAt: new Date(now.getTime() + (courseIndex + 4) * DAY),
    maxScore: 10, attemptsAllowed: 1, countsTowardFinal: true,
    config: { showSolutions: false },
    status: CourseStatus.PUBLISHED,
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

  const enrollmentCandidates = [
    ...teacherIds.map((userId, index) => ({
      courseId: courseIds[index % courseIds.length], userId, role: CourseRole.TEACHER, progress: 100,
    })),
    ...studentIds.flatMap((userId, index) => {
      const primary = {
        courseId: courseIds[index % courseIds.length], userId, role: CourseRole.STUDENT, progress: (index * 7) % 101,
      };
      const additional = index % 4 === 0 ? [{
        courseId: courseIds[(index + 1) % courseIds.length], userId, role: CourseRole.STUDENT, progress: (index * 11) % 101,
      }] : [];
      return [primary, ...additional];
    }),
  ];
  // A one-course fixture makes an optional extra enrollment point at the same
  // course as the primary one. Keep the generic generator valid for compact
  // scenarios as well as the richer demo seeds.
  const enrollmentKeys = new Set<string>();
  const enrollments = enrollmentCandidates.filter((enrollment) => {
    const key = enrollment.courseId + ':' + enrollment.userId;
    if (enrollmentKeys.has(key)) return false;
    enrollmentKeys.add(key);
    return true;
  });
  await prisma.enrollment.createMany({ data: enrollments });

  await prisma.lessonCompletion.createMany({
    data: studentIds.slice(0, Math.min(30, studentIds.length)).flatMap((userId, index) => {
      const courseId = courseIds[index % courseIds.length];
      return lessons.filter((lesson) => lesson.sectionId.startsWith(courseId + '-')).slice(0, 2)
        .map((lesson) => ({ lessonId: lesson.id, userId }));
    }),
  });
  const threads = courseIds.map((courseId, index) => ({
    id: courseId + '-thread-01', courseId, authorId: teacherIds[index % teacherIds.length],
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
      link: '/courses/' + courseIds[index % courseIds.length], read: index % 3 === 0,
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
  await prisma.course.create({
    data: {
      id: 'course-web-101', organizationId: org.id, ownerId: 'user-diego-001',
      title: 'Introducción al Desarrollo Web', description: 'HTML, CSS, JavaScript y fundamentos de la web.',
      category: 'Programación', status: CourseStatus.PUBLISHED, accessCode: 'WEB101',
    },
  });
  await prisma.enrollment.createMany({
    data: [
      { courseId: 'course-web-101', userId: 'user-diego-001', role: CourseRole.TEACHER, progress: 100 },
      { courseId: 'course-web-101', userId: 'user-lucia-001', role: CourseRole.STUDENT, progress: 50 },
      { courseId: 'course-web-101', userId: 'user-student-0001', role: CourseRole.STUDENT, progress: 25 },
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
      { id: 'section-web-101-1', courseId: 'course-web-101', title: 'Libro 1 · Fundamentos', order: 0 },
      { id: 'section-web-101-2', courseId: 'course-web-101', title: 'Libro 2 · Proyecto', order: 1 },
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
        id: 'activity-web-101-quiz', courseId: 'course-web-101', type: ActivityType.QUIZ,
        title: 'Autoevaluación de la unidad', description: 'Cuestionario de práctica con corrección automática.',
        dueAt: new Date(now.getTime() + 7 * DAY), maxScore: 10, attemptsAllowed: 2,
        countsTowardFinal: true,
        config: { showSolutions: true, shuffleQuestions: false, shuffleOptions: false },
        status: CourseStatus.PUBLISHED,
      },
      {
        id: 'activity-web-101-essay', courseId: 'course-web-101', type: ActivityType.QUIZ,
        title: 'Tarea · Ensayo y fichero',
        description: 'Desarrolla la respuesta y adjunta un fichero de evidencia.',
        dueAt: new Date(now.getTime() + 14 * DAY), maxScore: 10, attemptsAllowed: 1,
        countsTowardFinal: true,
        config: { showSolutions: false },
        status: CourseStatus.PUBLISHED,
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
    data: { id: 'thread-web-101-1', courseId: 'course-web-101', authorId: 'user-diego-001', title: 'Presentaciones', pinned: true },
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
}

/**
 * Small, deterministic fixture for acceptance tests which need to prove that
 * IDs from one tenant are rejected by another tenant. Keep the explicit IDs:
 * they make a failing HTTP trace immediately understandable. Generic demo
 * seeds intentionally contain richer data and are not a substitute for this.
 */
async function seedE2e(passwordHash: string): Promise<void> {
  await createInstitution({
    id: 'org-e2e-a', slug: 'e2e-a', name: 'E2E Academy A', students: 2, teachers: 1, courses: 1,
  }, passwordHash);
  await createInstitution({
    id: 'org-e2e-b', slug: 'e2e-b', name: 'E2E Academy B', students: 2, teachers: 1, courses: 1,
  }, passwordHash);
}

async function main(): Promise<void> {
  const scenario = scenarioFromEnvironment();
  await clearApplicationData();
  const superadminEmail = await createPlatformSuperadmin();
  if (scenario !== 'platform') {
    const passwordHash = await argon2.hash(DEMO_PASSWORD);
    if (scenario === 'standard') {
      await seedStandard(passwordHash);
    } else if (scenario === 'small') {
      await createInstitution({ id: 'org-demo-small', slug: 'demo-small', name: 'Academia Demo', students: 8, teachers: 3, courses: 3 }, passwordHash);
    } else if (scenario === 'e2e') {
      await seedE2e(passwordHash);
    } else {
      await createInstitution({ id: 'org-demo-large', slug: 'demo-large', name: 'Academia Horizonte', students: 160, teachers: 30, courses: 6 }, passwordHash);
      await createInstitution({ id: 'org-demo-medium', slug: 'demo-medium', name: 'Instituto Atlas', students: 120, teachers: 24, courses: 5 }, passwordHash);
      await createInstitution({ id: 'org-demo-compact', slug: 'demo-compact', name: 'Centro Nexo', students: 100, teachers: 20, courses: 4 }, passwordHash);
    }
  }
  console.log('\n✅ Seed scenario "' + scenario + '" complete.');
  console.log('   platform superadmin  ' + superadminEmail + ' (password: PLATFORM_SUPERADMIN_PASSWORD)');
  if (scenario === 'standard') console.log('   organization          klass\n   demo users            student@demo / teacher@demo / admin@demo  ·  password: demo1234');
  if (scenario === 'small') console.log('   organization          demo-small\n   users                 8 students, 3 teachers, 1 admin  ·  password: demo1234');
  if (scenario === 'large') console.log('   organizations         demo-large, demo-medium, demo-compact\n   users per organization 100+ students, 20+ teachers  ·  password: demo1234');
  if (scenario === 'e2e') console.log('   organizations         e2e-a, e2e-b\n   users per organization 2 students, 1 teacher, 1 admin  ·  password: demo1234');
  if (scenario === 'platform') console.log('   application data      removed (only the platform superadmin remains)');
}

main()
  .catch((error: unknown) => {
    console.error('Seed failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
