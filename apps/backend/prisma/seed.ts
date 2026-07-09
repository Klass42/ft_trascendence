/**
 * Deterministic demo data for the LMS. Re-runnable: every row uses upsert by
 * stable id, so the seed never creates duplicates. Run with `make db-seed`.
 *
 * IDs are HARDCODED so `VITE_DEV_USER_ID` is a shareable constant (see
 * docs/planning/desarrollo_jorge.md). org-klass-0001 aligns with the frontend
 * mock in apps/frontend/src/lib/api/auth-context.tsx.
 */
import { PrismaClient, GlobalRole, CourseStatus, CourseRole } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

const DEMO_PASSWORD = 'demo1234';

const IDS = {
  org: 'org-klass-0001',
  admin: 'user-admin-0001',
  teacher: 'user-teacher-0001',
  student: 'user-student-0001',
  course: 'course-demo-0001',
  section: 'section-demo-0001',
  lesson: 'lesson-demo-0001',
  enrollment: 'enrollment-demo-0001',
} as const;

async function main(): Promise<void> {
  const passwordHash = await argon2.hash(DEMO_PASSWORD);
  const now = new Date();

  const org = await prisma.organization.upsert({
    where: { id: IDS.org },
    update: { name: 'Klass Demo' },
    create: { id: IDS.org, name: 'Klass Demo', slug: 'klass-demo' },
  });

  const mkUser = (id: string, email: string, name: string, role: GlobalRole) =>
    prisma.user.upsert({
      where: { id },
      update: { passwordHash, emailVerifiedAt: now },
      create: {
        id, email, name, role, passwordHash,
        organizationId: org.id, emailVerifiedAt: now,
      },
    });

  await mkUser(IDS.admin, 'admin@demo', 'Ada Admin', GlobalRole.ADMIN);
  const teacher = await mkUser(IDS.teacher, 'teacher@demo', 'Theo Teacher', GlobalRole.TEACHER);
  const student = await mkUser(IDS.student, 'student@demo', 'Sam Student', GlobalRole.STUDENT);

  const course = await prisma.course.upsert({
    where: { id: IDS.course },
    update: { ownerId: teacher.id, status: CourseStatus.PUBLISHED },
    create: {
      id: IDS.course,
      organizationId: org.id,
      ownerId: teacher.id,
      title: 'Welcome to Klass',
      description: 'A short onboarding course.',
      accessCode: 'KLASS123',
      status: CourseStatus.PUBLISHED,
    },
  });

  const section = await prisma.section.upsert({
    where: { id: IDS.section },
    update: { title: 'Getting Started' },
    create: { id: IDS.section, courseId: course.id, title: 'Getting Started', order: 0 },
  });

  await prisma.lesson.upsert({
    where: { id: IDS.lesson },
    update: { title: 'Welcome' },
    create: {
      id: IDS.lesson, sectionId: section.id,
      title: 'Welcome', order: 0,
      contentMd: '# Welcome\n\nGlad to have you in the Klass demo course.',
    },
  });

  await prisma.enrollment.upsert({
    where: { id: IDS.enrollment },
    update: {},
    create: {
      id: IDS.enrollment,
      courseId: course.id, userId: student.id,
      role: CourseRole.STUDENT, progress: 0,
    },
  });

  console.log('\n✅ Seed complete. Stable IDs:');
  console.log(`   org          ${IDS.org}`);
  console.log(`   admin        ${IDS.admin}  (admin@demo)`);
  console.log(`   teacher      ${IDS.teacher}  (teacher@demo)`);
  console.log(`   student      ${IDS.student}  (student@demo)`);
  console.log(`   course       ${IDS.course}  (accessCode KLASS123)`);
  console.log(`\n   Frontend dev: set VITE_DEV_USER_ID=${IDS.student}`);
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
