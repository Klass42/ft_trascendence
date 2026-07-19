/**
 * Canonical dev/demo seed for the LMS. Re-runnable: every row uses upsert by a
 * stable id, so re-seeding never duplicates. Run with `pnpm --filter backend
 * exec prisma db seed` (or `make db-seed`) after the schema is pushed.
 *
 * CONSOLIDATED (integration/jorge-auth): merges Jorge's auth-ready seed
 * (argon2-hashed passwords + emailVerifiedAt so email/password login works)
 * with David's fixed fixtures that the frontend MOCK_USER and QA smoke depend
 * on. Every user can log in two ways:
 *   • dev header  → `x-dev-user: <id>` (DevAuthGuard, dev only)
 *   • email/pass  → any seeded email + password `demo1234`
 *
 * FIXED IDS — do not rename without updating the frontend + docs:
 *   org-klass-0001                      … tenant (apps/frontend .../auth-context.tsx)
 *   user-lucia-001   (STUDENT)          … frontend MOCK_USER, dev@example.com
 *   user-diego-001   (TEACHER)          … teaches course-web-101
 *   course-web-101 / assignment-web-101-1 … David's assignment/grading/forum flow
 *   user-student-0001 / user-teacher-0001 / user-admin-0001 … Jorge's demo logins
 *     (VITE_DEV_USER_ID default, see docs/planning/desarrollo_jorge.md)
 */
import {
  PrismaClient,
  GlobalRole,
  CourseRole,
  CourseStatus,
  FriendStatus,
} from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

const DEMO_PASSWORD = 'demo1234';

const ORG_ID = 'org-klass-0001';
const COURSE_ID = 'course-web-101';

async function main(): Promise<void> {
  const passwordHash = await argon2.hash(DEMO_PASSWORD);
  const now = new Date();

  // ── Tenant ──────────────────────────────────────────────────────────────
  const org = await prisma.organization.upsert({
    where: { id: ORG_ID },
    update: { name: 'Klass Academy' },
    create: { id: ORG_ID, name: 'Klass Academy', slug: 'klass' },
  });

  // ── Users ───────────────────────────────────────────────────────────────
  // All get a hashed password + verified email so BOTH login paths work.
  const mkUser = (
    id: string,
    email: string,
    name: string,
    role: GlobalRole,
  ) =>
    prisma.user.upsert({
      where: { id },
      update: { passwordHash, emailVerifiedAt: now },
      create: {
        id,
        email,
        name,
        role,
        passwordHash,
        emailVerifiedAt: now,
        organizationId: org.id,
      },
    });

  // David's canonical fixtures (frontend + QA smoke depend on these ids)
  const lucia = await mkUser('user-lucia-001', 'dev@example.com', 'Lucía Molina', GlobalRole.STUDENT);
  const diego = await mkUser('user-diego-001', 'diego@example.com', 'Diego Torres', GlobalRole.TEACHER);
  await mkUser('user-admin-001', 'admin@example.com', 'Admin Klass', GlobalRole.ADMIN);

  // Jorge's demo logins (email/password + VITE_DEV_USER_ID default)
  await mkUser('user-admin-0001', 'admin@demo', 'Ada Admin', GlobalRole.ADMIN);
  await mkUser('user-teacher-0001', 'teacher@demo', 'Theo Teacher', GlobalRole.TEACHER);
  await mkUser('user-student-0001', 'student@demo', 'Sam Student', GlobalRole.STUDENT);

  // ── Course owned by Diego (teacher) ─────────────────────────────────────
  const course = await prisma.course.upsert({
    where: { id: COURSE_ID },
    update: { ownerId: diego.id, status: CourseStatus.PUBLISHED },
    create: {
      id: COURSE_ID,
      organizationId: org.id,
      ownerId: diego.id,
      title: 'Introducción al Desarrollo Web',
      description: 'HTML, CSS, JavaScript y fundamentos de la web.',
      category: 'Programación',
      status: CourseStatus.PUBLISHED,
      accessCode: 'WEB101',
    },
  });

  // ── Enrollments: Diego teaches, Lucía studies ───────────────────────────
  await prisma.enrollment.upsert({
    where: { courseId_userId: { courseId: course.id, userId: diego.id } },
    update: {},
    create: { courseId: course.id, userId: diego.id, role: CourseRole.TEACHER },
  });
  await prisma.enrollment.upsert({
    where: { courseId_userId: { courseId: course.id, userId: lucia.id } },
    update: {},
    create: { courseId: course.id, userId: lucia.id, role: CourseRole.STUDENT, progress: 25 },
  });

  // ── An accepted friendship so presence (A6b) is demonstrable ────────────
  await prisma.friendship.upsert({
    where: {
      requesterId_addresseeId: { requesterId: lucia.id, addresseeId: diego.id },
    },
    update: { status: FriendStatus.ACCEPTED },
    create: {
      requesterId: lucia.id,
      addresseeId: diego.id,
      status: FriendStatus.ACCEPTED,
    },
  });

  // ── One section + lesson so the course isn't empty ──────────────────────
  const section = await prisma.section.upsert({
    where: { id: 'section-web-101-1' },
    update: { title: 'Fundamentos' },
    create: { id: 'section-web-101-1', courseId: course.id, title: 'Fundamentos', order: 0 },
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

  // ── One assignment so submissions/grading/forums work out of the box ────
  await prisma.assignment.upsert({
    where: { id: 'assignment-web-101-1' },
    update: {},
    create: {
      id: 'assignment-web-101-1',
      courseId: course.id,
      title: 'Práctica 1 — Tu primera página HTML',
      description: 'Crea una página con un encabezado, un párrafo y una imagen.',
      dueAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
      maxScore: 100,
    },
  });

  console.log('\n✅ Seed complete.');
  console.log(`   org             ${ORG_ID}`);
  console.log(`   student (mock)  user-lucia-001   (dev@example.com)`);
  console.log(`   teacher         user-diego-001   (diego@example.com)`);
  console.log(`   demo logins     student@demo / teacher@demo / admin@demo  ·  password: ${DEMO_PASSWORD}`);
  console.log(`   course          ${COURSE_ID}  (accessCode WEB101)`);
  console.log(`   assignment      assignment-web-101-1`);
  console.log(`\n   Frontend dev: VITE_DEV_USER_ID=user-lucia-001 (or any seeded id)`);
}

main()
  .catch(async (err) => {
    console.error('Seed failed:', err);
    await prisma.$disconnect();
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
