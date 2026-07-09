/**
 * Dev seed — minimal, idempotent.
 *
 * TEMPORARY / shared: Jorge (@SrJorgeG) owns the canonical seed as part of the
 * auth contract (hashed passwords, OAuth accounts, richer fixtures). This file
 * exists so David can build & test assignments/forums/notifications BEFORE auth
 * lands. Fixed IDs deliberately match the frontend mock user
 * (apps/frontend/src/lib/api/auth-context.tsx: org-klass-0001 / user-lucia-001)
 * so the UI works end-to-end with VITE_USE_MOCK_AUTH=true.
 *
 * Run:  pnpm --filter backend exec prisma db seed
 *       (after `make db-push` / `make db-migrate` so tables exist)
 *
 * NOTE: passwordHash is left null — real hashed passwords come with Jorge's auth.
 * Login won't work yet; use mock/dev auth (x-dev-user header) meanwhile.
 */
import { PrismaClient, GlobalRole, CourseRole, CourseStatus } from '@prisma/client';

const prisma = new PrismaClient();

const ORG_ID = 'org-klass-0001';
const USER_STUDENT = 'user-lucia-001'; // matches frontend MOCK_USER
const USER_TEACHER = 'user-diego-001';
const USER_ADMIN = 'user-admin-001';
const COURSE_ID = 'course-web-101';

async function main() {
  // ── Tenant ────────────────────────────────────────────────────────────────
  await prisma.organization.upsert({
    where: { id: ORG_ID },
    update: {},
    create: { id: ORG_ID, name: 'Klass Academy', slug: 'klass' },
  });

  // ── Users (passwordHash null until Jorge's auth) ────────────────────────────
  const users = [
    { id: USER_ADMIN, email: 'admin@example.com', name: 'Admin Klass', role: GlobalRole.ADMIN },
    { id: USER_TEACHER, email: 'diego@example.com', name: 'Diego Torres', role: GlobalRole.TEACHER },
    { id: USER_STUDENT, email: 'dev@example.com', name: 'Lucía Molina', role: GlobalRole.STUDENT },
  ];
  for (const u of users) {
    await prisma.user.upsert({
      where: { id: u.id },
      update: {},
      create: { ...u, organizationId: ORG_ID },
    });
  }

  // ── Course owned by the teacher ─────────────────────────────────────────────
  await prisma.course.upsert({
    where: { id: COURSE_ID },
    update: {},
    create: {
      id: COURSE_ID,
      organizationId: ORG_ID,
      ownerId: USER_TEACHER,
      title: 'Introducción al Desarrollo Web',
      description: 'HTML, CSS, JavaScript y fundamentos de la web.',
      category: 'Programación',
      status: CourseStatus.PUBLISHED,
      accessCode: 'WEB101',
    },
  });

  // ── Enrollments: teacher + student ──────────────────────────────────────────
  await prisma.enrollment.upsert({
    where: { courseId_userId: { courseId: COURSE_ID, userId: USER_TEACHER } },
    update: {},
    create: { courseId: COURSE_ID, userId: USER_TEACHER, role: CourseRole.TEACHER },
  });
  await prisma.enrollment.upsert({
    where: { courseId_userId: { courseId: COURSE_ID, userId: USER_STUDENT } },
    update: {},
    create: { courseId: COURSE_ID, userId: USER_STUDENT, role: CourseRole.STUDENT, progress: 25 },
  });

  // ── One section + lesson so the course isn't empty ──────────────────────────
  const section = await prisma.section.upsert({
    where: { id: 'section-web-101-1' },
    update: {},
    create: { id: 'section-web-101-1', courseId: COURSE_ID, title: 'Fundamentos', order: 0 },
  });
  await prisma.lesson.upsert({
    where: { id: 'lesson-web-101-1' },
    update: {},
    create: {
      id: 'lesson-web-101-1',
      sectionId: section.id,
      title: '¿Cómo funciona la web?',
      contentMd: '# La Web\nCliente, servidor y HTTP.',
      order: 0,
    },
  });

  // ── One assignment so David can test submissions/grading immediately ────────
  await prisma.assignment.upsert({
    where: { id: 'assignment-web-101-1' },
    update: {},
    create: {
      id: 'assignment-web-101-1',
      courseId: COURSE_ID,
      title: 'Práctica 1 — Tu primera página HTML',
      description: 'Crea una página con un encabezado, un párrafo y una imagen.',
      dueAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      maxScore: 100,
    },
  });

  console.log('✅ Seed done: org-klass-0001, 3 users, 1 course, 1 assignment.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
