import { ForbiddenException } from '@nestjs/common';
import { AttemptStatus, PublicationStatus } from '@prisma/client';
import { accessFromPrisma } from '../test/access-from-prisma';
import type { PrismaService } from '../prisma/prisma.service';
import { AssignmentsService } from '../assignments/assignments.service';
import { GradingService } from '../assignments/grading/grading.service';
import type { NotificationsService } from '../notifications/notifications.service';
import { AnalyticsService } from './analytics.service';

describe('AnalyticsService', () => {
  const SUBJECT_ID = 'subject-web-101';
  const COURSE_ID = 'cohort-web-101';
  const ORG_ID = 'org-klass-0001';
  const TEACHER = 'user-diego-001';
  const ADMIN = 'user-admin-001';
  const STUDENT = 'user-lucia-001';
  const OTHER_STUDENT = 'user-sam-001';
  const activities = [
    { id: 'activity-1', maxScore: 100, status: PublicationStatus.PUBLISHED },
    { id: 'activity-2', maxScore: 10, status: PublicationStatus.PUBLISHED },
    { id: 'archived-1', maxScore: 20, status: PublicationStatus.ARCHIVED },
    { id: 'draft-1', maxScore: 100, status: PublicationStatus.DRAFT },
  ];
  // Cohort members: two students plus a teacher and an admin who also hold a
  // membership row. Only the teacher is SubjectStaff of the subject.
  const users: Record<string, { role: string; name: string }> = {
    [STUDENT]: { role: 'STUDENT', name: 'Lucía' },
    [OTHER_STUDENT]: { role: 'STUDENT', name: 'Sam' },
    [TEACHER]: { role: 'TEACHER', name: 'Diego' },
    [ADMIN]: { role: 'ADMIN', name: 'Admin' },
  };
  const memberships = [STUDENT, OTHER_STUDENT, TEACHER, ADMIN];
  const staffIds = new Set([TEACHER]);
  const attempts = [
    // Lucía: two graded attempts on the same task -> one delivered pair (90%).
    {
      id: 'a1', activityId: 'activity-1', userId: STUDENT, attemptNo: 1,
      status: AttemptStatus.GRADED, score: 80,
      submittedAt: new Date('2025-06-01T09:00:00.000Z'),
    },
    {
      id: 'a2', activityId: 'activity-1', userId: STUDENT, attemptNo: 2,
      status: AttemptStatus.GRADED, score: 90,
      submittedAt: new Date('2025-06-02T09:00:00.000Z'),
    },
    {
      id: 'a3', activityId: 'activity-2', userId: OTHER_STUDENT, attemptNo: 1,
      status: AttemptStatus.GRADED, score: 5,
      submittedAt: new Date('2025-06-03T09:00:00.000Z'),
    },
    // Pending manual correction: delivered, but no grade yet.
    {
      id: 'a4', activityId: 'activity-2', userId: STUDENT, attemptNo: 1,
      status: AttemptStatus.SUBMITTED, score: null,
      submittedAt: new Date('2025-06-03T10:00:00.000Z'),
    },
    // Graded work on an archived task still counts (10/20 = 50%).
    {
      id: 'a5', activityId: 'archived-1', userId: STUDENT, attemptNo: 1,
      status: AttemptStatus.GRADED, score: 10,
      submittedAt: new Date('2025-06-03T11:00:00.000Z'),
    },
    // A staff member's attempt must not count as a student's.
    {
      id: 'a6', activityId: 'activity-1', userId: TEACHER, attemptNo: 1,
      status: AttemptStatus.GRADED, score: 100,
      submittedAt: new Date('2025-06-03T12:00:00.000Z'),
    },
    // Attempts on drafts and unfinished attempts never count.
    {
      id: 'a7', activityId: 'draft-1', userId: OTHER_STUDENT, attemptNo: 1,
      status: AttemptStatus.GRADED, score: 100,
      submittedAt: new Date('2025-06-03T13:00:00.000Z'),
    },
    {
      id: 'a8', activityId: 'activity-1', userId: OTHER_STUDENT, attemptNo: 1,
      status: AttemptStatus.IN_PROGRESS, score: null, submittedAt: null,
    },
  ];

  function build(title = 'Web 101') {
    const groupBy = jest.fn(async ({ where }: any) => {
      const counts = new Map<number, { submittedAt: Date; count: number }>();
      for (const attempt of attempts) {
        const submittedAt = attempt.submittedAt;
        if (
          !where.activityId.in.includes(attempt.activityId) ||
          !where.userId.in.includes(attempt.userId) ||
          !where.status.in.includes(attempt.status) ||
          !submittedAt ||
          submittedAt < where.submittedAt.gte ||
          submittedAt > where.submittedAt.lte
        ) continue;
        const time = submittedAt.getTime();
        counts.set(time, { submittedAt, count: (counts.get(time)?.count ?? 0) + 1 });
      }
      return [...counts.values()].map(({ submittedAt, count }) => ({
        submittedAt,
        _count: { _all: count },
      }));
    });
    const attemptFindMany = jest.fn(async ({ where }: any) =>
      attempts.filter((attempt) =>
        where.activityId.in.includes(attempt.activityId) &&
        where.userId.in.includes(attempt.userId) &&
        where.status.in.includes(attempt.status),
      ),
    );
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
      },
      activity: {
        findMany: async ({ where }: any) => activities.filter((activity) =>
          where.status.in.includes(activity.status) &&
          where.subjectId === SUBJECT_ID &&
          where.subject.organizationId === ORG_ID,
        ),
      },
      attempt: { groupBy, findMany: attemptFindMany },
      // Mirrors subjectStudentsWhere: only STUDENT members, never staff of this subject.
      courseMembership: {
        findMany: async ({ where }: any) => memberships
          .filter((userId) =>
            where.courseId === COURSE_ID &&
            where.course.organizationId === ORG_ID &&
            users[userId].role === where.user.role &&
            !(where.user.subjectStaff.none.subjectId === SUBJECT_ID && staffIds.has(userId)),
          )
          .map((userId) => ({
            userId,
            user: { id: userId, name: users[userId].name, email: null, avatarUrl: null },
          })),
      },
      lesson: { count: async () => 4 },
      lessonCompletion: { count: async () => 3 },
      forumThread: { count: async () => 1 },
      forumPost: { count: async () => 2 },
    };
    return {
      prisma: prisma as PrismaService,
      access: accessFromPrisma(prisma),
      groupBy,
      attemptFindMany,
    };
  }

  it('counts (student, task) pairs: 2 attempts on one task, archived tasks, pending work and staff', async () => {
    const { prisma, access, attemptFindMany } = build();
    const service = new AnalyticsService(prisma, access);

    const overview = await service.getOverview(SUBJECT_ID, TEACHER);

    expect(overview.course.title).toBe('Web 101');
    // Teacher and admin hold a membership but are not students.
    expect(overview.students).toBe(2);
    // Published + archived, never drafts.
    expect(overview.assignments).toBe(3);
    expect(overview.lessons).toBe(4);
    // Delivered pairs: Lucía a1/a2/archived + Sam a2 = 4 of 2 x 3 = 6. Lucía's two
    // attempts on activity-1 count once, and the staff attempt is ignored.
    expect(overview.submissions).toEqual({
      total: 4,
      expected: 6,
      graded: 3,
      pending: 1,
      rate: 4 / 6,
    });
    expect(overview.submissions.rate).toBeLessThanOrEqual(1);
    // Best attempt per pair as a % of maxScore: 90%, 50% (archived), 50%.
    // The pending SUBMITTED attempt is not a grade.
    expect(overview.averageGrade).toBe(63.3);
    expect(overview.lessonsCompletion).toEqual({ completed: 3, expected: 8, rate: 3 / 8 });
    expect(overview.forum).toEqual({ threads: 1, posts: 2 });
    expect(attemptFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        userId: { in: [STUDENT, OTHER_STUDENT] },
        activity: { subjectId: SUBJECT_ID, subject: { organizationId: ORG_ID } },
      }),
    }));
  });

  it('never exceeds 100% even when a student retries every task', async () => {
    const { prisma, access } = build();
    const original = attempts.length;
    for (const activity of activities.filter((a) => a.status !== PublicationStatus.DRAFT)) {
      for (const userId of [STUDENT, OTHER_STUDENT]) {
        for (const attemptNo of [7, 8, 9]) {
          attempts.push({
            id: `extra-${activity.id}-${userId}-${attemptNo}`, activityId: activity.id,
            userId, attemptNo, status: AttemptStatus.GRADED, score: 1,
            submittedAt: new Date('2025-06-01T09:00:00.000Z'),
          });
        }
      }
    }
    try {
      const overview = await new AnalyticsService(prisma, access).getOverview(SUBJECT_ID, TEACHER);
      expect(overview.submissions.total).toBe(6);
      expect(overview.submissions.expected).toBe(6);
      expect(overview.submissions.rate).toBe(1);
    } finally {
      attempts.length = original;
    }
  });

  it('returns the grade distribution of exactly the grades behind the average', async () => {
    const { prisma, access } = build();
    const service = new AnalyticsService(prisma, access);
    const distribution = await service.getGradeDistribution(SUBJECT_ID, TEACHER);
    const overview = await service.getOverview(SUBJECT_ID, TEACHER);

    expect(distribution.total).toBe(3);
    expect(distribution.total).toBe(overview.submissions.graded);
    expect(distribution.buckets.reduce((sum, bucket) => sum + bucket.count, 0)).toBe(3);
    expect(distribution.buckets).toHaveLength(10);
    expect(distribution.buckets[9]).toMatchObject({ label: '90-100', count: 1 });
    expect(distribution.buckets[5]).toMatchObject({ label: '50-60', count: 2 });
  });

  it('matches the gradebook: same students, tasks and per-task grades', async () => {
    const { prisma, access } = build();
    const gradebookPrisma: any = prisma;
    // The gradebook reads every attempt of the tasks; give it the same data.
    gradebookPrisma.attempt.findMany = async () => attempts;
    const grading = new GradingService(
      prisma,
      new AssignmentsService(prisma, access),
      {} as unknown as NotificationsService,
    );
    const analytics = new AnalyticsService(prisma, access);

    const gradebook = await grading.getGradebook(SUBJECT_ID, TEACHER);
    const overview = await analytics.getOverview(SUBJECT_ID, TEACHER);

    const maxById = new Map(gradebook.items.map((item) => [item.id, item.maxScore]));
    const gradebookPercents = gradebook.students.flatMap((student) =>
      student.cells.flatMap((cell) =>
        cell.status === AttemptStatus.GRADED && cell.score != null
          ? [(cell.score / (maxById.get(cell.activityId) as number)) * 100]
          : [],
      ),
    );
    const gradebookDelivered = gradebook.students
      .flatMap((student) => student.cells)
      .filter((cell) => cell.status !== null).length;

    expect(gradebook.students).toHaveLength(overview.students);
    expect(gradebook.items).toHaveLength(overview.assignments);
    expect(gradebookPercents).toHaveLength(overview.submissions.graded);
    expect(gradebookDelivered).toBe(overview.submissions.total);
    const gradebookMean =
      gradebookPercents.reduce((sum, value) => sum + value, 0) / gradebookPercents.length;
    expect(overview.averageGrade).toBeCloseTo(gradebookMean, 1);
  });

  it('fills zero days and includes only submitted attempts in the requested range', async () => {
    const { prisma, access, groupBy } = build();
    const result = await new AnalyticsService(prisma, access).getSubmissionsOverTime(
      SUBJECT_ID,
      TEACHER,
      '2025-06-02',
      '2025-06-04',
    );

    // Staff and draft attempts are excluded from the series too.
    expect(result.total).toBe(4);
    expect(result.series).toEqual([
      { date: '2025-06-02', count: 1 },
      { date: '2025-06-03', count: 3 },
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

    expect(result.csv).toContain("Resumen,Asignatura,'=2+3");
    expect(result.csv).toContain('Entregas por día,2025-06-03,3');
    expect(result.csv).toContain('Resumen,Entregas,4/6');
    expect(result.csv).toContain('Resumen,Notas calificadas,3');
    expect(result.csv).toContain('Resumen,Nota media (%),63.3');
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
