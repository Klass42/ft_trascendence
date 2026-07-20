import {
  AttemptStatus,
  CourseRole,
  CourseStatus,
  NotificationType,
  QuestionKind,
} from '@prisma/client';
import { AttemptsService } from './attempts.service';
import { ActivitiesService } from '../activities.service';
import type { PrismaService } from '../../prisma/prisma.service';
import type { NotificationsService } from '../../notifications/notifications.service';

/**
 * Attempt lifecycle over a tiny in-memory Prisma fake: window + attempt-cap
 * enforcement on start, auto-grading + notification on submit, the manual path
 * for subjective questions, and the tenancy/validation guards.
 */
describe('AttemptsService', () => {
  const COURSE = 'course-web-101';
  const STUDENT = 'user-lucia-001';
  const TEACHER = 'user-diego-001';

  type Q = {
    id: string;
    kind: QuestionKind;
    content: unknown;
    points: number;
    order: number;
  };

  function build(opts: {
    questions: Q[];
    attemptsAllowed?: number;
    openAt?: Date | null;
    closeAt?: Date | null;
    maxScore?: number;
    config?: Record<string, unknown>;
  }) {
    const activity = {
      id: 'act-1',
      courseId: COURSE,
      title: 'Quiz de prueba',
      type: 'QUIZ',
      status: CourseStatus.PUBLISHED,
      openAt: opts.openAt ?? null,
      closeAt: opts.closeAt ?? null,
      dueAt: null,
      maxScore: opts.maxScore ?? 10,
      attemptsAllowed: opts.attemptsAllowed ?? 1,
      timeLimitSec: null,
      config: opts.config ?? {},
    };
    const attempts: any[] = [];
    const answers: any[] = [];
    const emitted: Array<{ userId: string; type: NotificationType; payload: any }> =
      [];
    let seq = 0;

    const withIncludes = (a: any, include: any) => {
      const row = { ...a };
      if (include?.answers) row.answers = answers.filter((x) => x.attemptId === a.id);
      if (include?.activity) {
        row.activity = { ...activity };
        if (include.activity.include?.questions) {
          row.activity.questions = [...opts.questions].sort(
            (p, q) => p.order - q.order,
          );
        }
      }
      return row;
    };

    const prisma = {
      activity: {
        findUnique: async ({ where, include }: any) => {
          if (where.id !== activity.id) return null;
          const base: any = { ...activity };
          if (include?.course) {
            base.course = { id: COURSE, organizationId: 'org-klass-0001' };
          }
          if (include?.questions) base.questions = opts.questions;
          return base;
        },
      },
      course: {
        findUnique: async ({ where }: any) =>
          where.id === COURSE
            ? { id: COURSE, organizationId: 'org-klass-0001' }
            : null,
      },
      enrollment: {
        findUnique: async ({ where }: any) => {
          const u = where.courseId_userId.userId;
          if (u === STUDENT) return { role: CourseRole.STUDENT };
          if (u === TEACHER) return { role: CourseRole.TEACHER };
          return null;
        },
      },
      attempt: {
        findFirst: async ({ where }: any) =>
          attempts.find(
            (a) =>
              a.activityId === where.activityId &&
              a.userId === where.userId &&
              a.status === where.status,
          ) ?? null,
        count: async ({ where }: any) =>
          attempts.filter(
            (a) => a.activityId === where.activityId && a.userId === where.userId,
          ).length,
        create: async ({ data }: any) => {
          seq += 1;
          const row = {
            id: `att-${seq}`,
            score: null,
            submittedAt: null,
            gradedAt: null,
            gradedById: null,
            ...data,
          };
          attempts.push(row);
          return row;
        },
        findUnique: async ({ where, include }: any) => {
          const a = attempts.find((x) => x.id === where.id);
          return a ? withIncludes(a, include) : null;
        },
        update: async ({ where, data }: any) => {
          const a = attempts.find((x) => x.id === where.id);
          Object.assign(a, data);
          return a;
        },
      },
      answer: {
        upsert: async ({ where, create, update }: any) => {
          const { attemptId, questionId } = where.attemptId_questionId;
          const found = answers.find(
            (x) => x.attemptId === attemptId && x.questionId === questionId,
          );
          if (found) {
            Object.assign(found, update);
            return found;
          }
          seq += 1;
          const row = { id: `ans-${seq}`, attemptId, questionId, ...create };
          answers.push(row);
          return row;
        },
        update: async ({ where, data }: any) => {
          const an = answers.find((x) => x.id === where.id);
          Object.assign(an, data);
          return an;
        },
        create: async ({ data }: any) => {
          seq += 1;
          const row = { id: `ans-${seq}`, ...data };
          answers.push(row);
          return row;
        },
      },
      $transaction: async (ops: Promise<unknown>[]) => Promise.all(ops),
    } as unknown as PrismaService;

    const notifications = {
      emit: async (userId: string, type: NotificationType, payload: any) => {
        emitted.push({ userId, type, payload });
        return { id: `n-${emitted.length}` };
      },
    } as unknown as NotificationsService;

    const service = new AttemptsService(
      prisma,
      new ActivitiesService(prisma),
      notifications,
    );
    return { service, attempts, answers, emitted };
  }

  const mcq = (id: string, correct: number[], order = 0): Q => ({
    id,
    kind: QuestionKind.MULTIPLE_CHOICE,
    content: { options: ['a', 'b', 'c'], correct },
    points: 1,
    order,
  });

  it('auto-grades a fully-objective quiz to GRADED and notifies the student', async () => {
    const { service, emitted } = build({
      questions: [mcq('q1', [0], 0), mcq('q2', [2], 1)],
      maxScore: 10,
    });

    const started = await service.start('act-1', STUDENT);
    await service.saveAnswers(started.id, STUDENT, {
      answers: [
        { questionId: 'q1', response: { selected: [0] } },
        { questionId: 'q2', response: { selected: [2] } },
      ],
    });
    const done = await service.submit(started.id, STUDENT);

    expect(done.status).toBe(AttemptStatus.GRADED);
    expect(done.score).toBe(10); // 2/2 → 100% of maxScore 10
    expect(emitted).toHaveLength(1);
    expect(emitted[0]).toMatchObject({
      userId: STUDENT,
      type: NotificationType.GRADE_PUBLISHED,
    });
  });

  it('awards partial credit and still grades when all questions are objective', async () => {
    const { service } = build({
      questions: [mcq('q1', [0], 0), mcq('q2', [2], 1)],
      maxScore: 10,
    });
    const started = await service.start('act-1', STUDENT);
    await service.saveAnswers(started.id, STUDENT, {
      answers: [
        { questionId: 'q1', response: { selected: [0] } }, // correct
        { questionId: 'q2', response: { selected: [0] } }, // wrong
      ],
    });
    const done = await service.submit(started.id, STUDENT);
    expect(done.status).toBe(AttemptStatus.GRADED);
    expect(done.score).toBe(5);
  });

  it('leaves an attempt SUBMITTED (no notification) when it has a subjective question', async () => {
    const { service, emitted } = build({
      questions: [
        mcq('q1', [0], 0),
        {
          id: 'q2',
          kind: QuestionKind.SHORT_ANSWER,
          content: {}, // empty accepted → manual
          points: 1,
          order: 1,
        },
      ],
    });
    const started = await service.start('act-1', STUDENT);
    await service.saveAnswers(started.id, STUDENT, {
      answers: [{ questionId: 'q1', response: { selected: [0] } }],
    });
    const done = await service.submit(started.id, STUDENT);

    expect(done.status).toBe(AttemptStatus.SUBMITTED);
    expect(done.score).toBeNull();
    expect(emitted).toHaveLength(0);
  });

  it('lets staff manually grade a SUBMITTED attempt → GRADED + notify', async () => {
    const { service, emitted } = build({
      questions: [
        {
          id: 'q1',
          kind: QuestionKind.SHORT_ANSWER,
          content: {},
          points: 1,
          order: 0,
        },
      ],
      maxScore: 20,
    });
    const started = await service.start('act-1', STUDENT);
    await service.submit(started.id, STUDENT);

    const graded = await service.grade(started.id, TEACHER, { score: 18 });
    expect(graded.status).toBe(AttemptStatus.GRADED);
    expect(graded.score).toBe(18);
    expect(emitted).toHaveLength(1);
    expect(emitted[0].userId).toBe(STUDENT);
  });

  it('rejects a manual grade above maxScore', async () => {
    const { service } = build({
      questions: [
        {
          id: 'q1',
          kind: QuestionKind.SHORT_ANSWER,
          content: {},
          points: 1,
          order: 0,
        },
      ],
      maxScore: 20,
    });
    const started = await service.start('act-1', STUDENT);
    await service.submit(started.id, STUDENT);
    await expect(
      service.grade(started.id, TEACHER, { score: 999 }),
    ).rejects.toThrow(/no puede superar/i);
  });

  it('enforces the open/close window on start', async () => {
    const future = new Date(Date.now() + 1e9);
    const past = new Date(Date.now() - 1e9);
    const notOpen = build({ questions: [mcq('q1', [0])], openAt: future });
    await expect(notOpen.service.start('act-1', STUDENT)).rejects.toThrow(
      /no está abierta/i,
    );
    const closed = build({ questions: [mcq('q1', [0])], closeAt: past });
    await expect(closed.service.start('act-1', STUDENT)).rejects.toThrow(
      /cerrada/i,
    );
  });

  it('enforces the attempt cap', async () => {
    const { service } = build({
      questions: [mcq('q1', [0])],
      attemptsAllowed: 1,
    });
    const first = await service.start('act-1', STUDENT);
    await service.submit(first.id, STUDENT);
    await expect(service.start('act-1', STUDENT)).rejects.toThrow(
      /No quedan intentos/i,
    );
  });

  it('rejects saving an answer to a foreign question', async () => {
    const { service } = build({ questions: [mcq('q1', [0])] });
    const started = await service.start('act-1', STUDENT);
    await expect(
      service.saveAnswers(started.id, STUDENT, {
        answers: [{ questionId: 'not-mine', response: { selected: [0] } }],
      }),
    ).rejects.toThrow(/no pertenece/i);
  });

  it('forbids a non-staff member from grading', async () => {
    const { service } = build({
      questions: [
        {
          id: 'q1',
          kind: QuestionKind.SHORT_ANSWER,
          content: {},
          points: 1,
          order: 0,
        },
      ],
    });
    const started = await service.start('act-1', STUDENT);
    await service.submit(started.id, STUDENT);
    await expect(
      service.grade(started.id, STUDENT, { score: 5 }),
    ).rejects.toThrow(/staff/i);
  });
});
