import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { CourseRole, SubmissionStatus } from '@prisma/client';
import { AnalyticsService } from './analytics.service';
import type { PrismaService } from '../prisma/prisma.service';

/**
 * Happy-path test of the analytics aggregates over a tiny in-memory Prisma fake
 * (no database). Scenario: a course with 2 students × 2 assignments (so 4
 * expected submissions), 3 handed in, 2 graded — one 80/100 (80%), one 5/10
 * (50%). Also covers the staff-only gate.
 */
describe('AnalyticsService', () => {
  const COURSE_ID = 'course-web-101';
  const ORG_ID = 'org-klass-0001';
  const TEACHER = 'user-diego-001';
  const STUDENT = 'user-lucia-001';
  const STRANGER = 'user-nadie-999';

  const ASSIGNMENTS = [
    { id: 'a1', maxScore: 100 },
    { id: 'a2', maxScore: 10 },
  ];

  function buildPrismaFake(): PrismaService {
    const gradedSubs = [
      { assignmentId: 'a1', score: 80, status: SubmissionStatus.GRADED },
      { assignmentId: 'a2', score: 5, status: SubmissionStatus.GRADED },
    ];

    return {
      course: {
        findUnique: async ({ where }: any) =>
          where.id === COURSE_ID
            ? { id: COURSE_ID, title: 'Web 101', organizationId: ORG_ID }
            : null,
      },
      enrollment: {
        findUnique: async ({ where }: any) => {
          const { courseId, userId } = where.courseId_userId;
          if (courseId !== COURSE_ID) return null;
          if (userId === TEACHER)
            return { courseId, userId, role: CourseRole.TEACHER };
          if (userId === STUDENT)
            return { courseId, userId, role: CourseRole.STUDENT };
          return null; // STRANGER has no enrollment
        },
        count: async ({ where }: any) =>
          where.role === CourseRole.STUDENT ? 2 : 3,
      },
      assignment: {
        findMany: async () => ASSIGNMENTS.map((a) => ({ ...a })),
      },
      lesson: { count: async () => 4 },
      lessonCompletion: { count: async () => 3 },
      forumThread: { count: async () => 1 },
      forumPost: { count: async () => 2 },
      submission: {
        groupBy: async () => [
          { status: SubmissionStatus.GRADED, _count: { _all: 2 } },
          { status: SubmissionStatus.SUBMITTED, _count: { _all: 1 } },
        ],
        findMany: async ({ where }: any) => {
          if (where.status === SubmissionStatus.GRADED) {
            return gradedSubs.map((s) => ({
              assignmentId: s.assignmentId,
              score: s.score,
            }));
          }
          return [];
        },
      },
    } as unknown as PrismaService;
  }

  it('computes overview KPIs from aggregates', async () => {
    const service = new AnalyticsService(buildPrismaFake());

    const overview = await service.getOverview(COURSE_ID, TEACHER);

    expect(overview.course.title).toBe('Web 101');
    expect(overview.students).toBe(2);
    expect(overview.assignments).toBe(2);
    expect(overview.lessons).toBe(4);

    // 3 handed in (SUBMITTED + GRADED) of 4 expected (2 students × 2 tasks).
    expect(overview.submissions.total).toBe(3);
    expect(overview.submissions.expected).toBe(4);
    expect(overview.submissions.graded).toBe(2);
    expect(overview.submissions.pending).toBe(1);
    expect(overview.submissions.rate).toBeCloseTo(0.75);

    // Grades normalised to maxScore: 80/100 and 5/10 → mean 65%.
    expect(overview.averageGrade).toBe(65);

    // 3 completions of 2 students × 4 lessons = 8 expected.
    expect(overview.lessonsCompletion.rate).toBeCloseTo(3 / 8);
    expect(overview.forum).toEqual({ threads: 1, posts: 2 });
  });

  it('buckets graded scores into a normalised histogram', async () => {
    const service = new AnalyticsService(buildPrismaFake());

    const dist = await service.getGradeDistribution(COURSE_ID, TEACHER);

    expect(dist.total).toBe(2);
    expect(dist.buckets).toHaveLength(10);
    // 80% → 80-90 band (index 8); 50% → 50-60 band (index 5).
    expect(dist.buckets[8]).toMatchObject({ label: '80-90', count: 1 });
    expect(dist.buckets[5]).toMatchObject({ label: '50-60', count: 1 });
    expect(dist.buckets.reduce((sum, b) => sum + b.count, 0)).toBe(2);
  });

  it('hides the course from non-members (404) and blocks students (403)', async () => {
    const service = new AnalyticsService(buildPrismaFake());

    await expect(service.getOverview(COURSE_ID, STRANGER)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(service.getOverview(COURSE_ID, STUDENT)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
});
