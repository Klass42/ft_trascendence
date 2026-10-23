import { ForbiddenException } from '@nestjs/common';
import { AttemptStatus, PublicationStatus } from '@prisma/client';
import { accessFromPrisma } from '../test/access-from-prisma';
import type { PrismaService } from '../prisma/prisma.service';
import { AnalyticsService } from './analytics.service';

describe('AnalyticsService', () => {
  const SUBJECT_ID = 'subject-web-101';
  const COURSE_ID = 'cohort-web-101';
  const ORG_ID = 'org-klass-0001';
  const TEACHER = 'user-diego-001';
  const STUDENT = 'user-lucia-001';
  const OTHER_STUDENT = 'user-sam-001';
  const activities = [
    { id: 'activity-1', maxScore: 100, status: PublicationStatus.PUBLISHED },
    { id: 'activity-2', maxScore: 10, status: PublicationStatus.PUBLISHED },
    { id: 'draft-1', maxScore: 100, status: PublicationStatus.DRAFT },
  ];
  const attempts = [
    {
      activityId: 'activity-1', userId: STUDENT, status: AttemptStatus.GRADED,
      score: 80, submittedAt: new Date('2025-06-01T09:00:00.000Z'),
    },
    {
      activityId: 'activity-1', userId: STUDENT, status: AttemptStatus.GRADED,
      score: 90, submittedAt: new Date('2025-06-02T09:00:00.000Z'),
    },
    {
      activityId: 'activity-2', userId: OTHER_STUDENT, status: AttemptStatus.GRADED,
      score: 5, submittedAt: new Date('2025-06-03T09:00:00.000Z'),
    },
    {
      activityId: 'activity-2', userId: STUDENT, status: AttemptStatus.SUBMITTED,
      score: null, submittedAt: new Date('2025-06-03T10:00:00.000Z'),
    },
  ];

  function build(title = 'Web 101') {
    const groupBy = jest.fn(async ({ by, where }: any) => {
      const selected = attempts.filter((attempt) =>
        where.activityId.in.includes(attempt.activityId),
      );
      if (by.includes('submittedAt')) {
        const counts = new Map<number, { submittedAt: Date; count: number }>();
        for (const attempt of selected) {
          const submittedAt = attempt.submittedAt;
          if (
            !submittedAt ||
            submittedAt < where.submittedAt.gte ||
            submittedAt > where.submittedAt.lte ||
            !where.status.in.includes(attempt.status)
          ) continue;
          const time = submittedAt.getTime();
          const current = counts.get(time);
          counts.set(time, { submittedAt, count: (current?.count ?? 0) + 1 });
        }
        return [...counts.values()].map(({ submittedAt, count }) => ({
          submittedAt,
          _count: { _all: count },
        }));
      }
      if (by.includes('status')) {
        return [AttemptStatus.SUBMITTED, AttemptStatus.GRADED]
          .map((status) => ({
            status,
            _count: {
              _all: selected.filter((attempt) => attempt.status === status).length,
            },
          }))
          .filter((group) => group._count._all > 0);
      }

      const bestByStudentActivity = new Map<string, number>();
      for (const attempt of selected) {
        if (attempt.status !== AttemptStatus.GRADED || attempt.score == null) continue;
        const key = `${attempt.activityId}:${attempt.userId}`;
        bestByStudentActivity.set(key, Math.max(bestByStudentActivity.get(key) ?? -Infinity, attempt.score));
      }
      return [...bestByStudentActivity].map(([key, score]) => {
        const [activityId, userId] = key.split(':');
        return { activityId, userId, _max: { score } };
      });
    });
    const prisma: any = {
      course: {
        findUnique: async ({ where }: any) => where.id === SUBJECT_ID
          ? {
              id: SUBJECT_ID,
              title,
              organizationId: ORG_ID,
              courseId: COURSE_ID,
              status: PublicationStatus.PUBLISHED,
            }
          : null,
      },
      enrollment: {
        findUnique: async ({ where }: any) => {
          const userId = where.courseId_userId.userId;
          if (userId === TEACHER) return { role: 'TEACHER' };
          if (userId === STUDENT || userId === OTHER_STUDENT) return { role: 'STUDENT' };
          return null;
        },
        count: async () => 2,
      },
      activity: {
        findMany: async ({ where }: any) => activities.filter((activity) =>
          activity.status === where.status && where.subjectId === SUBJECT_ID,
        ),
      },
      attempt: { groupBy },
      courseMembership: { count: async () => 2 },
      lesson: { count: async () => 4 },
      lessonCompletion: { count: async () => 3 },
      forumThread: { count: async () => 1 },
      forumPost: { count: async () => 2 },
    };
    return {
      prisma: prisma as PrismaService,
      access: accessFromPrisma(prisma),
      groupBy,
    };
  }

  it('computes KPIs from published activities and the best normalized attempt per student', async () => {
    const { prisma, access, groupBy } = build();
    const service = new AnalyticsService(prisma, access);

    const overview = await service.getOverview(SUBJECT_ID, TEACHER);

    expect(overview.course.title).toBe('Web 101');
    expect(overview.students).toBe(2);
    expect(overview.assignments).toBe(2);
    expect(overview.lessons).toBe(4);
    expect(overview.submissions).toEqual({
      total: 4,
      expected: 4,
      graded: 3,
      pending: 1,
      rate: 1,
    });
    // The gradebook keeps the best attempt: 90/100 and 5/10 average to 70%.
    expect(overview.averageGrade).toBe(70);
    expect(overview.lessonsCompletion).toEqual({ completed: 3, expected: 8, rate: 3 / 8 });
    expect(overview.forum).toEqual({ threads: 1, posts: 2 });
    expect(groupBy).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        activity: { subjectId: SUBJECT_ID, subject: { organizationId: ORG_ID } },
      }),
    }));
  });

  it('returns the normalized grade distribution', async () => {
    const { prisma, access } = build();
    const distribution = await new AnalyticsService(prisma, access)
      .getGradeDistribution(SUBJECT_ID, TEACHER);

    expect(distribution.total).toBe(2);
    expect(distribution.buckets).toHaveLength(10);
    expect(distribution.buckets[8]).toMatchObject({ label: '80-90', count: 0 });
    expect(distribution.buckets[9]).toMatchObject({ label: '90-100', count: 1 });
    expect(distribution.buckets[5]).toMatchObject({ label: '50-60', count: 1 });
  });

  it('fills zero days and includes only submitted attempts in the requested range', async () => {
    const { prisma, access, groupBy } = build();
    const result = await new AnalyticsService(prisma, access).getSubmissionsOverTime(
      SUBJECT_ID,
      TEACHER,
      '2025-06-02',
      '2025-06-04',
    );

    expect(result.total).toBe(3);
    expect(result.series).toEqual([
      { date: '2025-06-02', count: 1 },
      { date: '2025-06-03', count: 2 },
      { date: '2025-06-04', count: 0 },
    ]);
    expect(groupBy).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        submittedAt: {
          not: null,
          gte: new Date('2025-06-02T00:00:00.000Z'),
          lte: new Date('2025-06-04T23:59:59.999Z'),
        },
        status: { in: [AttemptStatus.SUBMITTED, AttemptStatus.GRADED] },
      }),
    }));
  });

  it('uses the selected range for CSV export and escapes formula cells', async () => {
    const { prisma, access } = build('=2+3');
    const result = await new AnalyticsService(prisma, access).getExportCsv(
      SUBJECT_ID,
      TEACHER,
      '2025-06-03',
      '2025-06-03',
    );

    expect(result.csv).toContain("Resumen,Curso,'=2+3");
    expect(result.csv).toContain('Entregas por día,2025-06-03,2');
    expect(result.csv).not.toContain('Entregas por día,2025-06-01');
  });

  it('blocks students and users without subject membership', async () => {
    const { prisma, access } = build();
    const service = new AnalyticsService(prisma, access);

    await expect(service.getOverview(SUBJECT_ID, STUDENT))
      .rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.getOverview(SUBJECT_ID, 'user-nadie-999'))
      .rejects.toBeInstanceOf(ForbiddenException);
  });
});
