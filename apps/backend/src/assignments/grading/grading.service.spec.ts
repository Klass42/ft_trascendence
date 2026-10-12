import {
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { NotificationType, SubmissionStatus } from '@prisma/client';
import { GradingService } from './grading.service';
import { AssignmentsService } from '../assignments.service';
import { accessFromPrisma } from '../../test/access-from-prisma';
import type { PrismaService } from '../../prisma/prisma.service';
import type { NotificationsService } from '../../notifications/notifications.service';

/**
 * Happy-path (plus a couple of guards) for grading: a teacher grades a
 * student's submission, it becomes GRADED with the score/grader stamped, the
 * student is notified, and the gradebook reflects the score. Uses a tiny
 * in-memory Prisma fake so it runs with no database — same shape as the
 * submissions spec.
 */
describe('GradingService', () => {
  const COURSE_ID = 'course-web-101';
  const ORG_ID = 'org-klass-0001';
  const ASSIGNMENT_ID = 'assignment-web-101-1';
  const SUBMISSION_ID = 'sub-1';
  const STUDENT = 'user-lucia-001';
  const TEACHER = 'user-diego-001';
  const MAX_SCORE = 100;

  function buildPrismaFake() {
    const submission: Record<string, any> = {
      id: SUBMISSION_ID,
      assignmentId: ASSIGNMENT_ID,
      userId: STUDENT,
      score: null,
      feedback: null,
      status: SubmissionStatus.SUBMITTED,
      gradedById: null,
      gradedAt: null,
      files: [],
      user: { id: STUDENT, name: 'Lucía Molina', email: 'dev@example.com', avatarUrl: null },
    };

    return {
      submission,
      prisma: {
        course: {
          findUnique: async ({ where }: any) =>
            where.id === COURSE_ID
              ? { id: COURSE_ID, title: 'Web 101', organizationId: ORG_ID }
              : null,
        },
        assignment: {
          findUnique: async ({ where }: any) =>
            where.id === ASSIGNMENT_ID
              ? {
                  id: ASSIGNMENT_ID,
                  subjectId: COURSE_ID,
                  title: 'Práctica 1',
                  maxScore: MAX_SCORE,
                  subject: { id: COURSE_ID, title: 'Web 101', organizationId: ORG_ID, courseId: COURSE_ID },
                }
              : null,
          findMany: async ({ where }: any) =>
            where.subjectId === COURSE_ID || where.courseId === COURSE_ID
              ? [
                  {
                    id: ASSIGNMENT_ID,
                    title: 'Práctica 1',
                    maxScore: MAX_SCORE,
                    dueAt: null,
                  },
                ]
              : [],
        },
        enrollment: {
          findUnique: async ({ where }: any) => {
            const { courseId, userId } = where.courseId_userId;
            if (courseId !== COURSE_ID) return null;
            if (userId === STUDENT)
              return { courseId, userId, role: 'STUDENT' as never };
            if (userId === TEACHER)
              return { courseId, userId, role: 'TEACHER' as never };
            return null;
          },
          findMany: async ({ where }: any) =>
            where.role === 'STUDENT' as never
              ? [
                  {
                    userId: STUDENT,
                    user: {
                      id: STUDENT,
                      name: 'Lucía Molina',
                      email: 'dev@example.com',
                      avatarUrl: null,
                    },
                  },
                ]
              : [],
        },
        submission: {
          findUnique: async ({ where }: any) =>
            where.id === SUBMISSION_ID ? submission : null,
          findMany: async () => [submission],
          update: async ({ data }: any) => {
            Object.assign(submission, data);
            return submission;
          },
        },
      } as unknown as PrismaService,
    };
  }

  function buildService(prisma: PrismaService, emitted: any[]) {
    const notifications = {
      emit: async (userId: string, type: NotificationType, payload: any) => {
        emitted.push({ userId, type, payload });
        return { id: 'n-1' };
      },
    } as unknown as NotificationsService;
    const assignments = new AssignmentsService(prisma, accessFromPrisma(prisma));
    return new GradingService(prisma, assignments, notifications);
  }

  it('a teacher grades a submission → GRADED, stamped, student notified', async () => {
    const { prisma, submission } = buildPrismaFake();
    const emitted: any[] = [];
    const service = buildService(prisma, emitted);

    const result = await service.gradeSubmission(SUBMISSION_ID, TEACHER, {
      score: 85,
      feedback: 'Buen trabajo',
    });

    expect(result.status).toBe(SubmissionStatus.GRADED);
    expect(result.score).toBe(85);
    expect(result.feedback).toBe('Buen trabajo');
    expect(submission.gradedById).toBe(TEACHER);
    expect(submission.gradedAt).toBeInstanceOf(Date);

    expect(emitted).toHaveLength(1);
    expect(emitted[0].userId).toBe(STUDENT);
    expect(emitted[0].type).toBe(NotificationType.GRADE_PUBLISHED);
  });

  it('rejects a score above the assignment maxScore', async () => {
    const { prisma } = buildPrismaFake();
    const service = buildService(prisma, []);

    await expect(
      service.gradeSubmission(SUBMISSION_ID, TEACHER, { score: 101 }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('a student cannot grade (staff-only)', async () => {
    const { prisma } = buildPrismaFake();
    const service = buildService(prisma, []);

    await expect(
      service.gradeSubmission(SUBMISSION_ID, STUDENT, { score: 50 }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('the gradebook reflects graded activity attempts and a final', async () => {
    const ACTIVITY_ID = 'act-1';
    const ATTEMPT_ID = 'att-1';
    const prisma = {
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
          if (userId === STUDENT)
            return { courseId, userId, role: 'STUDENT' as never };
          if (userId === TEACHER)
            return { courseId, userId, role: 'TEACHER' as never };
          return null;
        },
        findMany: async ({ where }: any) =>
          where.role === 'STUDENT' as never
            ? [
                {
                  userId: STUDENT,
                  user: {
                    id: STUDENT,
                    name: 'Lucía Molina',
                    email: 'dev@example.com',
                    avatarUrl: null,
                  },
                },
              ]
            : [],
      },
      courseMembership: {
        findMany: async () => [
          {
            userId: STUDENT,
            user: {
              id: STUDENT,
              name: 'Lucía Molina',
              email: 'dev@example.com',
              avatarUrl: null,
            },
          },
        ],
      },
      activity: {
        findMany: async ({ where }: any) =>
          where.subjectId === COURSE_ID || where.courseId === COURSE_ID
            ? [
                {
                  id: ACTIVITY_ID,
                  title: 'Examen mixto',
                  maxScore: 10,
                  dueAt: null,
                  closeAt: null,
                  countsTowardFinal: true,
                  status: 'PUBLISHED',
                },
              ]
            : [],
      },
      attempt: {
        findMany: async () => [
          {
            id: ATTEMPT_ID,
            activityId: ACTIVITY_ID,
            userId: STUDENT,
            score: 8,
            status: 'GRADED',
            attemptNo: 1,
          },
        ],
      },
    } as unknown as PrismaService;
    const service = buildService(prisma, []);

    const gradebook = await service.getGradebook(COURSE_ID, TEACHER);

    expect(gradebook.items).toHaveLength(1);
    expect(gradebook.students).toHaveLength(1);
    const cell = gradebook.students[0].cells[0];
    expect(cell.activityId).toBe(ACTIVITY_ID);
    expect(cell.score).toBe(8);
    expect(cell.status).toBe('GRADED');
    expect(cell.attemptId).toBe(ATTEMPT_ID);
    expect(gradebook.students[0].final).toBe(0.8);
  });

  // ── A4-teacher: aggregated teacher-dashboard summary ─────────────────────
  describe('getTeachingSummary', () => {
    function buildSummaryFake() {
      const prisma = {
        user: {
          findUnique: async () => ({ organizationId: ORG_ID, role: 'TEACHER' }),
        },
        subject: {
          findMany: async () => [{ id: COURSE_ID, status: 'PUBLISHED', courseId: COURSE_ID }],
        },
        courseMembership: {
          findMany: async () => [{ userId: STUDENT }, { userId: STUDENT }],
        },
        enrollment: {
          findMany: async ({ where }: any) => {
            // Staff-of-the-user lookup (role is `{ in: [...] }`).
            if (where.userId === TEACHER && where.role?.in) {
              return [{ course: { id: COURSE_ID, status: 'PUBLISHED' } }];
            }
            // Students of the taught courses.
            if (where.role === 'STUDENT' as never && where.courseId?.in) {
              return [{ userId: STUDENT }, { userId: STUDENT }]; // dup → deduped
            }
            return [];
          },
        },
        attempt: {
          count: async () => 1,
          findMany: async () => [
            {
              id: 'att-pending',
              status: 'SUBMITTED',
              submittedAt: new Date('2026-07-19T10:00:00Z'),
              user: {
                id: STUDENT,
                name: 'Lucía Molina',
                email: 'dev@example.com',
                avatarUrl: null,
              },
              activity: {
                id: 'act-1',
                title: 'Examen mixto',
                subject: { id: COURSE_ID, title: 'Web 101' },
              },
            },
          ],
        },
      } as unknown as PrismaService;
      return prisma;
    }

    it('aggregates active courses, distinct students and pending attempts', async () => {
      const prisma = buildSummaryFake();
      const service = buildService(prisma, []);

      const summary = await service.getTeachingSummary(TEACHER);

      expect(summary.activeCourses).toBe(1);
      expect(summary.totalStudents).toBe(1); // deduped
      expect(summary.pendingCount).toBe(1);
      expect(summary.pending).toHaveLength(1);
      expect(summary.pending[0]).toMatchObject({
        attemptId: 'att-pending',
        activityTitle: 'Examen mixto',
        courseTitle: 'Web 101',
        status: 'SUBMITTED',
      });
      expect(summary.pending[0].student.id).toBe(STUDENT);
    });

    it('returns zeros for a user who teaches nothing', async () => {
      const prisma = {
        user: { findUnique: async () => null },
        enrollment: { findMany: async () => [] },
        attempt: { count: async () => 0, findMany: async () => [] },
      } as unknown as PrismaService;
      const service = buildService(prisma, []);

      const summary = await service.getTeachingSummary('user-nobody');
      expect(summary).toEqual({
        activeCourses: 0,
        totalStudents: 0,
        pendingCount: 0,
        pending: [],
      });
    });
  });
});
