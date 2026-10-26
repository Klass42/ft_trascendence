import { SubmissionStatus, NotificationType } from '@prisma/client';
import { SubmissionsService } from './submissions.service';
import { AssignmentsService } from '../assignments.service';
import { accessFromPrisma } from '../../test/access-from-prisma';
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
  const ASSIGNMENT_CLOSED = 'assignment-closed';
  const ASSIGNMENT_NOT_OPEN = 'assignment-not-open';
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
        findUnique: async ({ where }: any) => {
          const base = {
            subjectId: COURSE_ID,
            title: 'Práctica 1',
            subject: { id: COURSE_ID, organizationId: ORG_ID, courseId: COURSE_ID },
          };
          if (where.id === ASSIGNMENT_ID) {
            return { ...base, id: ASSIGNMENT_ID, dueAt: new Date(2999, 0, 1) }; // far future → not LATE
          }
          if (where.id === ASSIGNMENT_CLOSED) {
            return {
              ...base,
              id: ASSIGNMENT_CLOSED,
              dueAt: new Date(2000, 0, 2),
              closeAt: new Date(2000, 0, 3), // already past → rejected
            };
          }
          if (where.id === ASSIGNMENT_NOT_OPEN) {
            return {
              ...base,
              id: ASSIGNMENT_NOT_OPEN,
              openAt: new Date(2999, 0, 1), // far future → not open yet
            };
          }
          return null;
        },
      },
      subjectStaff: {
        findMany: async () => [{ userId: TEACHER }],
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
      emitMany: async (loader: any, type: NotificationType) => {
        const userIds = typeof loader === 'function' ? await loader() : loader;
        for (const userId of userIds) emitted.push({ userId, type });
      },
    } as unknown as NotificationsService;

    const assignments = new AssignmentsService(prisma, accessFromPrisma(prisma));
    const service = new SubmissionsService(prisma, assignments, notifications);

    const result = await service.submit(ASSIGNMENT_ID, STUDENT, {
      text: 'Aquí está mi entrega',
      status: SubmissionStatus.SUBMITTED,
    });

    expect(result.status).toBe(SubmissionStatus.SUBMITTED);
    expect(result.userId).toBe(STUDENT);

    // Exactly one notification, to the teacher, of type SUBMISSION_RECEIVED.
    expect(emitted).toHaveLength(1);
    expect(emitted[0].userId).toBe(TEACHER);
    expect(emitted[0].type).toBe(NotificationType.SUBMISSION_RECEIVED);

    // Re-submitting must not spam the teacher again.
    await service.submit(ASSIGNMENT_ID, STUDENT, {
      text: 'Corrijo un typo',
      status: SubmissionStatus.SUBMITTED,
    });
    expect(emitted).toHaveLength(1);
  });

  it('rejects a submission after the assignment has closed', async () => {
    const prisma = buildPrismaFake();
    const notifications = {
      emit: async () => ({ id: 'n-1' }),
    } as unknown as NotificationsService;
    const assignments = new AssignmentsService(prisma, accessFromPrisma(prisma));
    const service = new SubmissionsService(prisma, assignments, notifications);

    await expect(
      service.submit(ASSIGNMENT_CLOSED, STUDENT, {
        text: 'Tarde',
        status: SubmissionStatus.SUBMITTED,
      }),
    ).rejects.toThrow(/cerrada/i);
  });

  it('rejects a submission before the assignment opens', async () => {
    const prisma = buildPrismaFake();
    const notifications = {
      emit: async () => ({ id: 'n-1' }),
    } as unknown as NotificationsService;
    const assignments = new AssignmentsService(prisma, accessFromPrisma(prisma));
    const service = new SubmissionsService(prisma, assignments, notifications);

    await expect(
      service.submit(ASSIGNMENT_NOT_OPEN, STUDENT, {
        text: 'Demasiado pronto',
        status: SubmissionStatus.SUBMITTED,
      }),
    ).rejects.toThrow(/no está abierta/i);
  });

  it('allows saving a DRAFT even outside the window', async () => {
    const prisma = buildPrismaFake();
    const notifications = {
      emit: async () => ({ id: 'n-1' }),
    } as unknown as NotificationsService;
    const assignments = new AssignmentsService(prisma, accessFromPrisma(prisma));
    const service = new SubmissionsService(prisma, assignments, notifications);

    const draft = await service.submit(ASSIGNMENT_NOT_OPEN, STUDENT, {
      text: 'Borrador anticipado',
      status: SubmissionStatus.DRAFT,
    });
    expect(draft.status).toBe(SubmissionStatus.DRAFT);
  });
});
