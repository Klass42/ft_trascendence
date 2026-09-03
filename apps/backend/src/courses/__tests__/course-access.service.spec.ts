import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { CourseAccessService } from '../course-access.service';
import type { AuthUser } from '@/common/auth';
import type { PrismaService } from '@/prisma/prisma.service';

const ORG = 'org-1';
const STUDENT: AuthUser = {
  userId: 'student-1', email: 'student@example.test', name: 'Student', avatarUrl: null,
  organizationId: ORG, role: 'STUDENT', emailNotificationsEnabled: true, preferredLanguage: 'es',
};

function serviceFor(
  course: any,
  memberships: Record<string, { role: 'STUDENT' | 'TEACHER' | 'ASSISTANT' }[]>,
) {
  const prisma = {
    course: {
      findUnique: jest.fn(async ({ include }: any) => course && ({
        ...course,
        enrollments: memberships[include.enrollments.where.userId] ?? [],
      })),
    },
  } as unknown as PrismaService;
  return new CourseAccessService(prisma);
}

describe('CourseAccessService', () => {
  const published = { id: 'course-1', organizationId: ORG, ownerId: 'owner-1', status: 'PUBLISHED' };

  it('allows enrolled students to read published courses', async () => {
    const service = serviceFor(published, { [STUDENT.userId]: [{ role: 'STUDENT' }] });
    await expect(service.assertReadable(published.id, STUDENT)).resolves.toMatchObject(published);
  });

  it('rejects a student who is not enrolled in a published course', async () => {
    const service = serviceFor(published, {});
    await expect(service.assertReadable(published.id, STUDENT)).rejects.toThrow(ForbiddenException);
  });

  it('does not expose a draft course to an enrolled student', async () => {
    const service = serviceFor({ ...published, status: 'DRAFT' }, {
      [STUDENT.userId]: [{ role: 'STUDENT' }],
    });
    await expect(service.assertReadable(published.id, STUDENT)).rejects.toThrow(NotFoundException);
  });

  it('allows staff to read and edit draft courses', async () => {
    const teacher = { ...STUDENT, userId: 'teacher-1', role: 'TEACHER' as const };
    const draft = { ...published, status: 'DRAFT' };
    const service = serviceFor(draft, { [teacher.userId]: [{ role: 'TEACHER' }] });

    await expect(service.assertReadable(draft.id, teacher)).resolves.toMatchObject(draft);
    await expect(service.assertStaff(draft.id, teacher)).resolves.toMatchObject(draft);
  });

  it('does not grant a global teacher staff access to another course', async () => {
    const teacher = { ...STUDENT, userId: 'teacher-1', role: 'TEACHER' as const };
    const service = serviceFor(published, {});
    await expect(service.assertStaff(published.id, teacher)).rejects.toThrow(ForbiddenException);
  });

  it('treats course assistants as staff', async () => {
    const assistant = { ...STUDENT, userId: 'assistant-1', role: 'TEACHER' as const };
    const service = serviceFor(published, { [assistant.userId]: [{ role: 'ASSISTANT' }] });
    await expect(service.assertStaff(published.id, assistant)).resolves.toMatchObject(published);
  });

  it('allows an organization admin to manage any course in their tenant', async () => {
    const admin = { ...STUDENT, userId: 'admin-1', role: 'ADMIN' as const };
    const service = serviceFor(published, {});
    await expect(service.assertStaff(published.id, admin)).resolves.toMatchObject(published);
  });

  it('hides courses from a different organization even from an admin', async () => {
    const admin = { ...STUDENT, userId: 'admin-1', role: 'ADMIN' as const };
    const service = serviceFor({ ...published, organizationId: 'other-org' }, {});
    await expect(service.assertStaff(published.id, admin)).rejects.toThrow(NotFoundException);
  });
});
