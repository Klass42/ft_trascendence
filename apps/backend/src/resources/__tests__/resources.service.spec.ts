import { ResourcesService } from '../resources.service';
import type { AuthUser } from '@/common/auth';
import type { PrismaService } from '@/prisma/prisma.service';

const ORG = 'org-1';
const STUDENT: AuthUser = {
  userId: 'student-1', email: 'student@example.test', name: 'Student', avatarUrl: null,
  organizationId: ORG, role: 'STUDENT', emailNotificationsEnabled: true, preferredLanguage: 'es',
};

function serviceFor(
  resources: { createdById: string; status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'; courses: { courseId: string }[] }[],
  enrollments: { courseId: string; role: 'STUDENT' | 'TEACHER' | 'ASSISTANT' }[],
) {
  const prisma = {
    learningResource: { findMany: jest.fn().mockResolvedValue(resources) },
    enrollment: { findMany: jest.fn().mockResolvedValue(enrollments) },
  } as unknown as PrismaService;
  return new ResourcesService(prisma);
}

describe('ResourcesService file access', () => {
  const publishedResource = {
    createdById: 'teacher-1', status: 'PUBLISHED' as const, courses: [{ courseId: 'course-1' }],
  };

  it('allows an enrolled learner to obtain a URL only for a published linked resource', async () => {
    const service = serviceFor([publishedResource], [{ courseId: 'course-1', role: 'STUDENT' }]);
    await expect(service.canAccessFile('file-1', STUDENT)).resolves.toBe(true);
  });

  it('does not allow an enrolled learner to obtain a URL for a draft resource', async () => {
    const service = serviceFor([{ ...publishedResource, status: 'DRAFT' }], [{ courseId: 'course-1', role: 'STUDENT' }]);
    await expect(service.canAccessFile('file-1', STUDENT)).resolves.toBe(false);
  });

  it('does not authorize a learner who is not enrolled in any linked course', async () => {
    const service = serviceFor([publishedResource], []);
    await expect(service.canAccessFile('file-1', STUDENT)).resolves.toBe(false);
  });

  it('allows linked course staff to inspect an unpublished resource', async () => {
    const teacher = { ...STUDENT, userId: 'teacher-2', role: 'TEACHER' as const };
    const service = serviceFor([{ ...publishedResource, status: 'DRAFT' }], [{ courseId: 'course-1', role: 'TEACHER' }]);
    await expect(service.canAccessFile('file-1', teacher)).resolves.toBe(true);
  });
});
