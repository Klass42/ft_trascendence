import { ResourcesService } from '../resources.service';
import type { AuthUser } from '@/common/auth';
import type { PrismaService } from '@/prisma/prisma.service';

const ORG = 'org-1';
const STUDENT: AuthUser = {
  userId: 'student-1', email: 'student@example.test', name: 'Student', avatarUrl: null,
  organizationId: ORG, role: 'STUDENT', emailNotificationsEnabled: true, preferredLanguage: 'es',
};

function serviceFor(
  resources: { createdById: string; status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'; subjects: { subjectId: string; subject: { courseId: string; status: string } }[] }[],
  links: { subjectId: string; courseId: string; role: 'STUDENT' | 'TEACHER' | 'ASSISTANT'; userId: string }[],
) {
  const prisma = {
    learningResource: { findMany: jest.fn().mockResolvedValue(resources) },
    subjectStaff: {
      findMany: jest.fn(async ({ where }: { where: { userId: string; subjectId: { in: string[] } } }) =>
        links
          .filter((link) => link.role !== 'STUDENT' && link.userId === where.userId && where.subjectId.in.includes(link.subjectId))
          .map((link) => ({ subjectId: link.subjectId })),
      ),
    },
    courseMembership: {
      findMany: jest.fn(async ({ where }: { where: { userId: string } }) =>
        links
          .filter((link) => link.role === 'STUDENT' && link.userId === where.userId)
          .map((link) => ({ courseId: link.courseId })),
      ),
    },
  } as unknown as PrismaService;
  return new ResourcesService(prisma, {} as never);
}

describe('ResourcesService file access', () => {
  const publishedResource = {
    createdById: 'teacher-1',
    status: 'PUBLISHED' as const,
    subjects: [{ subjectId: 'subject-1', subject: { courseId: 'course-1', status: 'PUBLISHED' } }],
  };

  it('allows an enrolled learner to obtain a URL only for a published linked resource', async () => {
    const service = serviceFor([publishedResource], [{ subjectId: 'subject-1', courseId: 'course-1', role: 'STUDENT', userId: STUDENT.userId }]);
    await expect(service.canAccessFile('file-1', STUDENT)).resolves.toBe(true);
  });

  it('does not allow an enrolled learner to obtain a URL for a draft resource', async () => {
    const service = serviceFor(
      [{ ...publishedResource, status: 'DRAFT' }],
      [{ subjectId: 'subject-1', courseId: 'course-1', role: 'STUDENT', userId: STUDENT.userId }],
    );
    await expect(service.canAccessFile('file-1', STUDENT)).resolves.toBe(false);
  });

  it('does not authorize a learner who is not enrolled in any linked course', async () => {
    const service = serviceFor([publishedResource], []);
    await expect(service.canAccessFile('file-1', STUDENT)).resolves.toBe(false);
  });

  it('allows linked subject staff to inspect an unpublished resource', async () => {
    const teacher = { ...STUDENT, userId: 'teacher-2', role: 'TEACHER' as const };
    const service = serviceFor(
      [{ ...publishedResource, status: 'DRAFT' }],
      [{ subjectId: 'subject-1', courseId: 'course-1', role: 'TEACHER', userId: teacher.userId }],
    );
    await expect(service.canAccessFile('file-1', teacher)).resolves.toBe(true);
  });
});
