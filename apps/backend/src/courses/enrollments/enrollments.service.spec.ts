import { NotFoundException } from '@nestjs/common';
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

describe('EnrollmentsService.uncompleteLesson', () => {
  const lesson = (organizationId: string) => ({
    id: 'l1',
    section: { subjectId: 's1', subject: { organizationId } },
  });
  const build = (found: unknown) => {
    const deleteMany = jest.fn().mockResolvedValue({ count: 1 });
    const prisma = {
      lesson: {
        findUnique: jest.fn().mockResolvedValue(found),
        count: jest.fn().mockResolvedValue(4),
      },
      lessonCompletion: { deleteMany, count: jest.fn().mockResolvedValue(1) },
    } as unknown as PrismaService;
    return { service: new EnrollmentsService(prisma), deleteMany };
  };

  it('deletes only the caller completion, scoped by organization, and returns the new progress', async () => {
    const { service, deleteMany } = build(lesson(ORG));
    const out = await service.uncompleteLesson('l1', ORG, STUDENT.userId);

    expect(deleteMany).toHaveBeenCalledWith({
      where: {
        lessonId: 'l1',
        userId: STUDENT.userId,
        lesson: { section: { subject: { organizationId: ORG } } },
      },
    });
    expect(out).toEqual({ completed: false, progress: 25 });
  });

  it('answers not found for a lesson of another organization', async () => {
    const { service, deleteMany } = build(lesson('org-other'));
    await expect(service.uncompleteLesson('l1', ORG, STUDENT.userId)).rejects.toBeInstanceOf(NotFoundException);
    expect(deleteMany).not.toHaveBeenCalled();
  });
});

describe('EnrollmentsService.getSubjectLessonProgress', () => {
  const build = (subject: unknown) => {
    const completionFindMany = jest.fn().mockResolvedValue([
      { userId: 'u1', lessonId: 'l1' },
      { userId: 'u1', lessonId: 'l2' },
      { userId: 'u3', lessonId: 'l1' }, // not a cohort member: ignored
    ]);
    const membershipFindMany = jest.fn().mockResolvedValue([{ userId: 'u1' }, { userId: 'u2' }]);
    const prisma = {
      subject: { findFirst: jest.fn().mockResolvedValue(subject) },
      courseMembership: { findMany: membershipFindMany },
      lessonCompletion: { findMany: completionFindMany },
    } as unknown as PrismaService;
    return { service: new EnrollmentsService(prisma), completionFindMany, membershipFindMany };
  };

  it('groups completions per student of the cohort and scopes every query by organization', async () => {
    const { service, completionFindMany, membershipFindMany } = build({ id: 's1', courseId: 'c1', organizationId: ORG });
    const out = await service.getSubjectLessonProgress('s1', ORG);

    expect(out).toEqual([
      { userId: 'u1', completedLessonIds: ['l1', 'l2'] },
      { userId: 'u2', completedLessonIds: [] },
    ]);
    // Students only: staff enrolled in the cohort are not learners.
    expect(membershipFindMany.mock.calls[0][0].where).toEqual({
      courseId: 'c1',
      course: { organizationId: ORG },
      user: { role: 'STUDENT', subjectStaff: { none: { subjectId: 's1' } } },
    });
    expect(completionFindMany.mock.calls[0][0].where).toEqual({
      userId: { in: ['u1', 'u2'] },
      lesson: { section: { subjectId: 's1', subject: { organizationId: ORG } } },
    });
  });

  it('answers not found when the subject is not in the organization', async () => {
    const { service } = build(null);
    await expect(service.getSubjectLessonProgress('s1', ORG)).rejects.toBeInstanceOf(NotFoundException);
  });
});
