import {
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { CourseRole, NotificationType, SubmissionStatus } from '@prisma/client';
import { GradingService } from './grading.service';
import { AssignmentsService } from '../assignments.service';
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
                  courseId: COURSE_ID,
                  title: 'Práctica 1',
                  maxScore: MAX_SCORE,
                  course: { id: COURSE_ID, title: 'Web 101', organizationId: ORG_ID },
                }
              : null,
          findMany: async ({ where }: any) =>
            where.courseId === COURSE_ID
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
              return { courseId, userId, role: CourseRole.STUDENT };
            if (userId === TEACHER)
              return { courseId, userId, role: CourseRole.TEACHER };
            return null;
          },
          findMany: async ({ where }: any) =>
            where.role === CourseRole.STUDENT
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
    const assignments = new AssignmentsService(prisma);
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

  it('the gradebook reflects the graded score', async () => {
    const { prisma } = buildPrismaFake();
    const service = buildService(prisma, []);

    await service.gradeSubmission(SUBMISSION_ID, TEACHER, { score: 85 });
    const gradebook = await service.getGradebook(COURSE_ID, TEACHER);

    expect(gradebook.assignments).toHaveLength(1);
    expect(gradebook.students).toHaveLength(1);
    const cell = gradebook.students[0].cells[0];
    expect(cell.assignmentId).toBe(ASSIGNMENT_ID);
    expect(cell.score).toBe(85);
    expect(cell.status).toBe(SubmissionStatus.GRADED);
    expect(cell.submissionId).toBe(SUBMISSION_ID);
  });
});
