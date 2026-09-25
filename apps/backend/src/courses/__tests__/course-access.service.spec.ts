import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { CourseAccessService } from '../course-access.service';
import type { AuthUser } from '@/common/auth';
import type { PrismaService } from '@/prisma/prisma.service';

const ORG = 'org-1';
const STUDENT: AuthUser = {
  userId: 'student-1', email: 'student@example.test', name: 'Student', avatarUrl: null,
  organizationId: ORG, role: 'STUDENT', emailNotificationsEnabled: true, preferredLanguage: 'es',
};

function serviceFor(options: {
  subject?: any;
  staffUserIds?: string[];
  memberUserIds?: string[];
}) {
  const subject = options.subject;
  const prisma = {
    subject: {
      findFirst: jest.fn(async ({ where }: any) => {
        if (!subject || subject.id !== where.id || subject.organizationId !== where.organizationId) {
          return null;
        }
        return subject;
      }),
    },
    subjectStaff: {
      findUnique: jest.fn(async ({ where }: any) =>
        options.staffUserIds?.includes(where.subjectId_userId.userId)
          ? { role: 'TEACHER' }
          : null,
      ),
    },
    courseMembership: {
      findUnique: jest.fn(async ({ where }: any) =>
        options.memberUserIds?.includes(where.courseId_userId.userId) ? { id: 'mem' } : null,
      ),
    },
    course: { findFirst: jest.fn() },
  } as unknown as PrismaService;
  return new CourseAccessService(prisma);
}

describe('CourseAccessService', () => {
  const published = {
    id: 'course-web-101',
    organizationId: ORG,
    courseId: 'cohort-1',
    status: 'PUBLISHED',
    title: 'Web',
    course: { id: 'cohort-1', organizationId: ORG },
  };

  it('allows a course member to read a published subject', async () => {
    const service = serviceFor({ subject: published, memberUserIds: [STUDENT.userId] });
    await expect(service.assertSubjectReadable(published.id, STUDENT)).resolves.toMatchObject({
      isStaff: false,
      isMember: true,
    });
  });

  it('rejects a student who is not a member of a published subject', async () => {
    const service = serviceFor({ subject: published, memberUserIds: [] });
    await expect(service.assertSubjectReadable(published.id, STUDENT)).rejects.toThrow(ForbiddenException);
  });

  it('does not expose a draft subject to a course member', async () => {
    const service = serviceFor({
      subject: { ...published, status: 'DRAFT' },
      memberUserIds: [STUDENT.userId],
    });
    await expect(service.assertSubjectReadable(published.id, STUDENT)).rejects.toThrow(NotFoundException);
  });

  it('allows staff to read and edit a draft subject', async () => {
    const teacher = { ...STUDENT, userId: 'teacher-1', role: 'TEACHER' as const };
    const draft = { ...published, status: 'DRAFT' };
    const service = serviceFor({ subject: draft, staffUserIds: [teacher.userId] });
    await expect(service.assertSubjectReadable(draft.id, teacher)).resolves.toMatchObject({ isStaff: true });
    await expect(service.assertSubjectStaff(draft.id, teacher)).resolves.toMatchObject({ isStaff: true });
  });

  it('does not grant a global teacher staff access to another subject', async () => {
    const teacher = { ...STUDENT, userId: 'teacher-1', role: 'TEACHER' as const };
    const service = serviceFor({ subject: published, staffUserIds: [] });
    await expect(service.assertSubjectStaff(published.id, teacher)).rejects.toThrow(ForbiddenException);
    await expect(service.assertSubjectReadable(published.id, teacher)).rejects.toThrow(ForbiddenException);
  });

  it('treats subject assistants as staff', async () => {
    const assistant = { ...STUDENT, userId: 'assistant-1', role: 'TEACHER' as const };
    const service = serviceFor({ subject: published, staffUserIds: [assistant.userId] });
    await expect(service.assertSubjectStaff(published.id, assistant)).resolves.toMatchObject({ isStaff: true });
  });

  it('allows an organization admin to manage any subject in their tenant', async () => {
    const admin = { ...STUDENT, userId: 'admin-1', role: 'ADMIN' as const };
    const service = serviceFor({ subject: published });
    await expect(service.assertSubjectStaff(published.id, admin)).resolves.toMatchObject({ isStaff: true });
  });

  it('hides subjects from a different organization even from an admin', async () => {
    const admin = { ...STUDENT, userId: 'admin-1', role: 'ADMIN' as const };
    const service = serviceFor({ subject: { ...published, organizationId: 'other-org' } });
    await expect(service.assertSubjectStaff(published.id, admin)).rejects.toThrow(NotFoundException);
  });
});
