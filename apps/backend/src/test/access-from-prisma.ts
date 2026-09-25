import { CourseAccessService } from '../courses/course-access.service';

/**
 * Test adapter: older specs fake `course` + `enrollment`. The access service
 * now reads subject, staff, membership and the user. This fills those calls
 * from the legacy fake so the specs keep their membership stories.
 */
export function accessFromPrisma(prisma: {
  course?: { findUnique?: (args: any) => Promise<any> };
  enrollment?: { findUnique?: (args: any) => Promise<any> };
  user?: { findUnique?: (args: any) => Promise<any> };
}): CourseAccessService {
  const wrapped: any = {
    ...prisma,
    user: {
      findUnique: async (args: any) => {
        const found = prisma.user?.findUnique ? await prisma.user.findUnique(args) : null;
        const id = args.where.id as string;
        const base = {
          id,
          email: `${id}@example.test`,
          name: id,
          avatarUrl: null,
          organizationId: 'org-klass-0001',
          role: /admin/i.test(id) ? 'ADMIN' : /student|lucia|sam/i.test(id) ? 'STUDENT' : 'TEACHER',
          platformRole: 'NONE',
          emailNotificationsEnabled: true,
          preferredLanguage: 'es',
        };
        if (!found) return base;
        return {
          ...base,
          ...found,
          organizationId: found.organizationId ?? base.organizationId,
          role: found.role ?? base.role,
        };
      },
    },
    subject: {
      findFirst: async ({ where }: any) => {
        const course = prisma.course?.findUnique
          ? await prisma.course.findUnique({ where: { id: where.id } })
          : null;
        if (!course) return null;
        if (where.organizationId && course.organizationId !== where.organizationId) return null;
        return {
          ...course,
          courseId: course.courseId ?? course.id,
          status: course.status ?? 'PUBLISHED',
          course: { ...course, organizationId: course.organizationId },
        };
      },
    },
    subjectStaff: {
      findUnique: async ({ where }: any) => {
        if (!prisma.enrollment?.findUnique) return null;
        const enrollment = await prisma.enrollment.findUnique({
          where: {
            courseId_userId: {
              courseId: where.subjectId_userId.subjectId,
              userId: where.subjectId_userId.userId,
            },
          },
        });
        if (!enrollment || enrollment.role === 'STUDENT') return null;
        return { role: enrollment.role };
      },
      findFirst: async () => null,
    },
    courseMembership: {
      findUnique: async ({ where }: any) => {
        if (!prisma.enrollment?.findUnique) return null;
        const enrollment = await prisma.enrollment.findUnique({
          where: { courseId_userId: where.courseId_userId },
        });
        return enrollment?.role === 'STUDENT' ? { id: 'membership' } : null;
      },
    },
  };
  return new CourseAccessService(wrapped);
}
