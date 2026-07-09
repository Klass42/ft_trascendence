import { CourseRole, SubmissionStatus, NotificationType } from '@prisma/client';
import { SubmissionsService } from './submissions.service';
import { AssignmentsService } from '../assignments.service';
import type { PrismaService } from '../../prisma/prisma.service';
import type { NotificationsService } from '../../notifications/notifications.service';

/**
 * Happy-path test of the submission flow: a student submits an assignment,
 * the row is upserted as SUBMITTED, and the course teacher (not the student
 * themselves) is notified. Uses a tiny in-memory Prisma fake so it runs with
 * no database.
 */
describe('SubmissionsService', () => {
  const COURSE_ID = 'course-web-101';
  const ORG_ID = 'org-klass-0001';
  const ASSIGNMENT_ID = 'assignment-web-101-1';
  const STUDENT = 'user-lucia-001';
  const TEACHER = 'user-diego-001';

  function buildPrismaFake() {
    const submissions: Array<Record<string, any>> = [];
    let seq = 0;

    return {
      course: {
        findUnique: async ({ where }: any) =>
          where.id === COURSE_ID
            ? { id: COURSE_ID, organizationId: ORG_ID }
            : null,
      },
      assignment: {
        findUnique: async ({ where }: any) =>
          where.id === ASSIGNMENT_ID
            ? {
                id: ASSIGNMENT_ID,
                courseId: COURSE_ID,
                title: 'Práctica 1',
                dueAt: new Date(2999, 0, 1), // far future → not LATE
                course: { id: COURSE_ID, organizationId: ORG_ID },
              }
            : null,
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
          // staff of the course, excluding the author
          where.userId?.not === STUDENT
            ? [{ userId: TEACHER }]
            : [],
      },
      user: {
        findUnique: async ({ where }: any) =>
          where.id === STUDENT ? { name: 'Lucía Molina' } : null,
      },
      file: {
        findMany: async () => [],
      },
      submission: {
        findUnique: async ({ where }: any) => {
          const { assignmentId, userId } = where.assignmentId_userId;
          return (
            submissions.find(
              (s) => s.assignmentId === assignmentId && s.userId === userId,
            ) ?? null
          );
        },
        upsert: async ({ where, create, update }: any) => {
          const { assignmentId, userId } = where.assignmentId_userId;
          const idx = submissions.findIndex(
            (s) => s.assignmentId === assignmentId && s.userId === userId,
          );
          if (idx >= 0) {
            submissions[idx] = {
              ...submissions[idx],
              text: update.text,
              status: update.status,
              files: [],
            };
            return submissions[idx];
          }
          seq += 1;
          const row = {
            id: `sub-${seq}`,
            assignmentId,
            userId,
            text: create.text,
            status: create.status,
            files: [],
          };
          submissions.push(row);
          return row;
        },
      },
    } as unknown as PrismaService;
  }

  it('a student submission is SUBMITTED and notifies the teacher, not the student', async () => {
    const prisma = buildPrismaFake();
    const emitted: Array<{ userId: string; type: NotificationType }> = [];
    const notifications = {
      emit: async (userId: string, type: NotificationType) => {
        emitted.push({ userId, type });
        return { id: 'n-1' };
      },
    } as unknown as NotificationsService;

    const assignments = new AssignmentsService(prisma);
    const service = new SubmissionsService(prisma, assignments, notifications);

    const result = await service.submit(ASSIGNMENT_ID, STUDENT, {
      text: 'Aquí está mi entrega',
      status: SubmissionStatus.SUBMITTED,
    });

    expect(result.status).toBe(SubmissionStatus.SUBMITTED);
    expect(result.userId).toBe(STUDENT);

    // Exactly one notification, to the teacher, of type NEW_ASSIGNMENT.
    expect(emitted).toHaveLength(1);
    expect(emitted[0].userId).toBe(TEACHER);
    expect(emitted[0].type).toBe(NotificationType.NEW_ASSIGNMENT);

    // Re-submitting must not spam the teacher again.
    await service.submit(ASSIGNMENT_ID, STUDENT, {
      text: 'Corrijo un typo',
      status: SubmissionStatus.SUBMITTED,
    });
    expect(emitted).toHaveLength(1);
  });
});
