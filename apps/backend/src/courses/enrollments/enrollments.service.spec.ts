import { EnrollmentsService } from './enrollments.service';
import type { AuthUser } from '@/common/auth';
import type { PrismaService } from '../../prisma/prisma.service';

const ORG = 'org-klass-0001';
const STUDENT: AuthUser = {
  userId: 'student-1', email: 's@example.test', name: 'Student',
  avatarUrl: null, organizationId: ORG, role: 'STUDENT',
  emailNotificationsEnabled: true, preferredLanguage: 'es',
};

describe('EnrollmentsService.getMyProgress', () => {
  const build = () => {
    const findMany = jest.fn().mockResolvedValue([{ id: 's1', courseId: 'c1' }]);
    const prisma = {
      subject: { findMany },
      lesson: { count: jest.fn().mockResolvedValue(4) },
      lessonCompletion: { count: jest.fn().mockResolvedValue(1) },
    } as unknown as PrismaService;
    return { service: new EnrollmentsService(prisma), findMany };
  };

  it('limits a student to published subjects of non-archived cohorts they belong to', async () => {
    const { service, findMany } = build();
    const out = await service.getMyProgress(STUDENT);

    expect(findMany.mock.calls[0][0].where).toEqual({
      organizationId: ORG,
      status: 'PUBLISHED',
      course: {
        status: { not: 'ARCHIVED' },
        memberships: { some: { userId: STUDENT.userId } },
      },
    });
    expect(out).toEqual([{ subjectId: 's1', courseId: 'c1', percentage: 25 }]);
  });
});
