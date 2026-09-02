/**
 * Reproducible data sets for local demos and manual QA.
 *
 * Set SEED_SCENARIO to standard, small, large, or platform. Every scenario
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
  SubmissionStatus,
} from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();
const DEMO_PASSWORD = 'demo1234';
const DAY = 24 * 60 * 60 * 1000;

type Scenario = 'standard' | 'small' | 'large' | 'platform';

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
  if (scenario === 'standard' || scenario === 'small' || scenario === 'large' || scenario === 'platform') {
    return scenario;
  }
  throw new Error('Unknown seed scenario: ' + scenario);
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
    await tx.activity.deleteMany();
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

  const assignments = courseIds.flatMap((courseId, courseIndex) => [0, 1].map((index) => ({
    id: courseId + '-assignment-' + String(index + 1).padStart(2, '0'),
    courseId,
    title: index === 0 ? 'Tarea · Entrega inicial' : 'Tarea · Proyecto aplicado',
    description: 'Entrega de demostración con instrucciones y rúbrica.',
    openAt: new Date(now.getTime() - DAY),
    dueAt: new Date(now.getTime() + (courseIndex + index + 3) * DAY),
    maxScore: 100,
  })));
  await prisma.assignment.createMany({ data: assignments });

  const activities = courseIds.map((courseId) => ({
    id: courseId + '-activity-01', courseId, type: ActivityType.QUIZ,
    title: 'Autoevaluación de la unidad', description: 'Cuestionario de práctica con corrección automática.',
    dueAt: new Date(now.getTime() + 5 * DAY), maxScore: 10, attemptsAllowed: 2,
    config: { showSolutions: true, shuffleQuestions: false, shuffleOptions: false },
    status: CourseStatus.PUBLISHED,
  }));
  await prisma.activity.createMany({ data: activities });
  await prisma.question.createMany({
    data: activities.flatMap((activity) => [
      {
        id: activity.id + '-question-01', activityId: activity.id, kind: QuestionKind.MULTIPLE_CHOICE,
        prompt: '¿Cuál es la opción correcta?', points: 5, order: 0,
        content: { options: [{ id: 'a', text: 'Opción correcta', correct: true }, { id: 'b', text: 'Distractor', correct: false }] },
      },
      {
        id: activity.id + '-question-02', activityId: activity.id, kind: QuestionKind.TRUE_FALSE,
        prompt: 'El contenido está disponible para el alumnado matriculado.', points: 5, order: 1,
        content: { correct: true },
      },
    ]),
  });

  const enrollments = [
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
  await prisma.enrollment.createMany({ data: enrollments });

  const submissions = assignments.flatMap((assignment, assignmentIndex) => {
    const courseIndex = courseIds.indexOf(assignment.courseId);
    return studentIds.filter((_, index) => index % courseIds.length === courseIndex).slice(0, 12).map((userId, index) => ({
      id: assignment.id + '-submission-' + String(index + 1).padStart(2, '0'),
      assignmentId: assignment.id, userId, text: 'Entrega de demostración preparada para la evaluación.',
      status: index % 3 === 0 ? SubmissionStatus.GRADED : SubmissionStatus.SUBMITTED,
      score: index % 3 === 0 ? 70 + (index % 4) * 5 : null,
      feedback: index % 3 === 0 ? 'Buen trabajo. Revisa el último apartado.' : null,
      gradedById: index % 3 === 0 ? teacherIds[assignmentIndex % teacherIds.length] : null,
      gradedAt: index % 3 === 0 ? now : null,
    }));
  });
  await prisma.submission.createMany({ data: submissions });

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
  await prisma.assignment.createMany({
    data: [
      { id: 'assignment-web-101-1', courseId: 'course-web-101', title: 'Práctica 1 · Tu primera página HTML', description: 'Crea una página con encabezado, párrafo e imagen.', dueAt: new Date(now.getTime() + 7 * DAY), maxScore: 100 },
      { id: 'assignment-web-101-2', courseId: 'course-web-101', title: 'Práctica 2 · Landing responsive', description: 'Construye una landing adaptable.', dueAt: new Date(now.getTime() + 14 * DAY), maxScore: 100 },
    ],
  });
  await prisma.submission.create({
    data: {
      id: 'submission-web-101-1', assignmentId: 'assignment-web-101-1', userId: 'user-lucia-001',
      text: 'Entrega de ejemplo.', status: SubmissionStatus.GRADED, score: 85,
      feedback: 'Muy buen comienzo.', gradedById: 'user-diego-001', gradedAt: now,
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
      body: 'Tu primera entrega ya tiene nota.', link: '/assignments/assignment-web-101-1',
    },
  });
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
