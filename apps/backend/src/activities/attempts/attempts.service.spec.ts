import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import {
  AttemptStatus,
  PublicationStatus,
  NotificationType,
  QuestionKind,
} from '@prisma/client';
import { AttemptsService } from './attempts.service';
import { ActivitiesService } from '../activities.service';
import { accessFromPrisma } from '../../test/access-from-prisma';
import type { PrismaService } from '../../prisma/prisma.service';
import type { NotificationsService } from '../../notifications/notifications.service';
import type { GradeAttemptDto } from './dto/grade-attempt.dto';

const ESSAY = 'ESSAY' as unknown as QuestionKind;

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
    const activity: any = {
      id: 'act-1',
      subjectId: COURSE,
      title: 'Quiz de prueba',
      type: 'QUIZ',
      status: PublicationStatus.PUBLISHED,
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
    const files: any[] = [];
    const emitted: Array<{ userId: string; type: NotificationType; payload: any }> =
      [];
    let seq = 0;
    let member = true;
    let transactionQueue = Promise.resolve();

    const withIncludes = (a: any, include: any) => {
      const row = { ...a };
      if (include?.answers) row.answers = answers.filter((x) => x.attemptId === a.id);
      if (include?.activity) {
        row.activity = {
          ...activity,
          subject: { organizationId: 'org-klass-0001' },
          questions: [...opts.questions].sort((p, q) => p.order - q.order),
        };
      }
      return row;
    };

    const prisma: any = {
      activity: {
        findUnique: async ({ where, include }: any) => {
          if (where.id !== activity.id) return null;
          const base: any = { ...activity };
          if (include?.course || include?.subject) {
            base.subject = { id: COURSE, organizationId: 'org-klass-0001', courseId: COURSE };
            base.course = base.subject;
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
          if (u === STUDENT && member) return { role: 'STUDENT' as never };
          if (u === TEACHER) return { role: 'TEACHER' as never };
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
            feedback: null,
            ...data,
          };
          attempts.push(row);
          return row;
        },
        findUnique: async ({ where, include }: any) => {
          const a = attempts.find((x) => x.id === where.id);
          return a ? withIncludes(a, include) : null;
        },
        findMany: async ({ where, include, orderBy }: any) => {
          const rows = attempts.filter((a) => {
            if (where?.activityId && a.activityId !== where.activityId) return false;
            if (where?.userId && a.userId !== where.userId) return false;
            return true;
          });
          if (orderBy?.attemptNo === 'asc') {
            rows.sort((a, b) => a.attemptNo - b.attemptNo);
          }
          return rows.map((a) => withIncludes(a, include));
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
          const row = {
            id: `ans-${seq}`,
            attemptId,
            questionId,
            awarded: null,
            correct: null,
            ...create,
          };
          answers.push(row);
          return row;
        },
        update: async ({ where, data }: any) => {
          const an = where.id
            ? answers.find((x) => x.id === where.id)
            : answers.find(
                (x) =>
                  x.attemptId === where.attemptId_questionId.attemptId &&
                  x.questionId === where.attemptId_questionId.questionId,
              );
          Object.assign(an, data);
          return an;
        },
        findMany: async ({ where }: any) =>
          answers.filter((x) => {
            if (where?.attemptId && x.attemptId !== where.attemptId) return false;
            if (where?.questionId && x.questionId !== where.questionId) {
              return false;
            }
            return true;
          }),
        create: async ({ data }: any) => {
          seq += 1;
          const row = { id: `ans-${seq}`, awarded: null, correct: null, ...data };
          answers.push(row);
          return row;
        },
      },
      file: {
        findMany: async ({ where }: any) =>
          files.filter((file) =>
            where.id.in.includes(file.id) &&
            file.organizationId === where.organizationId &&
            file.uploaderId === where.uploaderId,
          ),
      },
    };
    prisma.$transaction = async (ops: any) => {
      if (typeof ops !== 'function') return Promise.all(ops);
      const previous = transactionQueue;
      let release!: () => void;
      transactionQueue = new Promise<void>((resolve) => {
        release = resolve;
      });
      await previous;
      try {
        return await ops(prisma);
      } finally {
        release();
      }
    };

    const notifications = {
      emit: async (userId: string, type: NotificationType, payload: any) => {
        emitted.push({ userId, type, payload });
        return { id: `n-${emitted.length}` };
      },
    } as unknown as NotificationsService;

    const service = new AttemptsService(
      prisma as PrismaService,
      new ActivitiesService(prisma as PrismaService, accessFromPrisma(prisma as never)),
      notifications,
    );
    return {
      service,
      attempts,
      answers,
      emitted,
      files,
      activity,
      setMember: (value: boolean) => {
        member = value;
      },
    };
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
    expect(done.answers[0]).not.toHaveProperty('correct');
    expect(done.answers[0]).not.toHaveProperty('awarded');
    expect(done.answers[0]).not.toHaveProperty('feedback');
    expect(emitted).toHaveLength(0);
  });

  it('hides per-answer results and feedback until a graded attempt allows solutions', async () => {
    const { service } = build({
      questions: [
        { id: 'essay-1', kind: ESSAY, content: {}, points: 1, order: 0 },
        { id: 'essay-2', kind: ESSAY, content: {}, points: 1, order: 1 },
      ],
      config: { showSolutions: true },
    });
    const started = await service.start('act-1', STUDENT);
    await service.saveAnswers(started.id, STUDENT, {
      answers: [
        { questionId: 'essay-1', response: { text: 'uno' } },
        { questionId: 'essay-2', response: { text: 'dos' } },
      ],
    });
    await service.submit(started.id, STUDENT);
    await service.grade(started.id, TEACHER, {
      answers: [{ questionId: 'essay-1', awarded: 1 }],
      feedback: 'Comentario de corrección',
    } as unknown as GradeAttemptDto);

    const pending = (await service.listMine('act-1', STUDENT))[0] as any;
    expect(pending.status).toBe(AttemptStatus.SUBMITTED);
    expect(pending.score).toBeNull();
    expect(pending).not.toHaveProperty('feedback');
    expect(pending.answers[0]).not.toHaveProperty('correct');
    expect(pending.answers[0]).not.toHaveProperty('awarded');
    expect(pending.answers[0]).not.toHaveProperty('feedback');

    await service.grade(started.id, TEACHER, {
      answers: [{ questionId: 'essay-2', awarded: 0 }],
    } as unknown as GradeAttemptDto);
    const graded = (await service.listMine('act-1', STUDENT))[0] as any;
    expect(graded.status).toBe(AttemptStatus.GRADED);
    expect(graded.feedback).toBe('Comentario de corrección');
    expect(graded.answers[0]).toHaveProperty('awarded', 1);
    expect(graded.answers[0]).toHaveProperty('correct', null);
  });

  it('shows the teacher feedback on a graded attempt even when showSolutions is false', async () => {
    const { service } = build({
      questions: [{ id: 'essay-1', kind: ESSAY, content: {}, points: 1, order: 0 }],
      config: { showSolutions: false },
    });
    const started = await service.start('act-1', STUDENT);
    await service.saveAnswers(started.id, STUDENT, {
      answers: [{ questionId: 'essay-1', response: { text: 'uno' } }],
    });
    await service.submit(started.id, STUDENT);
    await service.grade(started.id, TEACHER, {
      answers: [{ questionId: 'essay-1', awarded: 1 }],
      feedback: 'Buen trabajo',
    } as unknown as GradeAttemptDto);

    const graded = (await service.listMine('act-1', STUDENT))[0] as any;
    expect(graded.status).toBe(AttemptStatus.GRADED);
    expect(graded.feedback).toBe('Buen trabajo');
    expect(graded.answers[0]).not.toHaveProperty('awarded');
    expect(graded.answers[0]).not.toHaveProperty('correct');
  });

  it('keeps answer results hidden when showSolutions is false while staff retain them', async () => {
    const { service } = build({
      questions: [mcq('q1', [0])],
      config: { showSolutions: false },
    });
    const started = await service.start('act-1', STUDENT);
    await service.saveAnswers(started.id, STUDENT, {
      answers: [{ questionId: 'q1', response: { selected: [0] } }],
    });
    const submitted = (await service.submit(started.id, STUDENT)) as any;
    expect(submitted.status).toBe(AttemptStatus.GRADED);
    expect(submitted.answers[0]).not.toHaveProperty('correct');
    expect(submitted.answers[0]).not.toHaveProperty('awarded');

    const staffAttempts = await service.listForActivity('act-1', TEACHER);
    expect(staffAttempts[0].answers[0]).toMatchObject({ correct: true, awarded: 1 });
  });

  it('does not allow attempt operations after course membership is removed', async () => {
    const { service, setMember } = build({ questions: [mcq('q1', [0])] });
    const started = await service.start('act-1', STUDENT);
    setMember(false);

    await expect(
      service.saveAnswers(started.id, STUDENT, {
        answers: [{ questionId: 'q1', response: { selected: [0] } }],
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.submit(started.id, STUDENT)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('rechecks the publication state and open window when saving or submitting', async () => {
    const closed = build({ questions: [mcq('q1', [0])] });
    const started = await closed.service.start('act-1', STUDENT);
    closed.activity.closeAt = new Date(Date.now() - 1000);
    await expect(
      closed.service.saveAnswers(started.id, STUDENT, {
        answers: [{ questionId: 'q1', response: { selected: [0] } }],
      }),
    ).rejects.toThrow(/cerrada/i);

    const archived = build({ questions: [mcq('q1', [0])] });
    const archivedAttempt = await archived.service.start('act-1', STUDENT);
    archived.activity.status = PublicationStatus.ARCHIVED;
    await expect(
      archived.service.submit(archivedAttempt.id, STUDENT),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('validates FILE_UPLOAD ownership, organization, type and maximum count on save', async () => {
    const uploadQuestion: Q = {
      id: 'upload-1',
      kind: QuestionKind.FILE_UPLOAD,
      content: { maxFiles: 1, accept: ['application/pdf'] },
      points: 1,
      order: 0,
    };
    const { service, files } = build({ questions: [uploadQuestion] });
    files.push({
      id: 'pdf-1',
      organizationId: 'org-klass-0001',
      uploaderId: STUDENT,
      originalName: 'respuesta.pdf',
      contentType: 'application/pdf',
    });
    files.push({
      id: 'image-1',
      organizationId: 'org-klass-0001',
      uploaderId: STUDENT,
      originalName: 'respuesta.png',
      contentType: 'image/png',
    });
    files.push({
      id: 'foreign-1',
      organizationId: 'org-klass-0001',
      uploaderId: 'another-student',
      originalName: 'ajena.pdf',
      contentType: 'application/pdf',
    });
    files.push({
      id: 'other-org-1',
      organizationId: 'org-otro-0002',
      uploaderId: STUDENT,
      originalName: 'otro-org.pdf',
      contentType: 'application/pdf',
    });

    const started = await service.start('act-1', STUDENT);
    await expect(
      service.saveAnswers(started.id, STUDENT, {
        answers: [
          { questionId: 'upload-1', response: { fileIds: ['pdf-1', 'pdf-1'] } },
        ],
      }),
    ).rejects.toThrow(/más de 1/i);
    await expect(
      service.saveAnswers(started.id, STUDENT, {
        answers: [{ questionId: 'upload-1', response: { fileIds: ['foreign-1'] } }],
      }),
    ).rejects.toThrow(/no son válidos/i);
    await expect(
      service.saveAnswers(started.id, STUDENT, {
        answers: [{ questionId: 'upload-1', response: { fileIds: ['other-org-1'] } }],
      }),
    ).rejects.toThrow(/no son válidos/i);
    await expect(
      service.saveAnswers(started.id, STUDENT, {
        answers: [{ questionId: 'upload-1', response: { fileIds: 'pdf-1' } as any }],
      }),
    ).rejects.toThrow(BadRequestException);
    await expect(
      service.saveAnswers(started.id, STUDENT, {
        answers: [{ questionId: 'upload-1', response: { fileIds: ['image-1'] } }],
      }),
    ).rejects.toThrow(/tipo permitido/i);

    const saved = await service.saveAnswers(started.id, STUDENT, {
      answers: [{ questionId: 'upload-1', response: { fileIds: ['pdf-1'] } }],
    });
    expect(saved.answers[0].response).toEqual({ fileIds: ['pdf-1'] });
  });

  it('serializes concurrent starts and resumes the same in-progress attempt', async () => {
    const { service, attempts } = build({
      questions: [mcq('q1', [0])],
      attemptsAllowed: 1,
    });
    const [first, second] = await Promise.all([
      service.start('act-1', STUDENT),
      service.start('act-1', STUDENT),
    ]);

    expect(first.id).toBe(second.id);
    expect(attempts).toHaveLength(1);
    expect(attempts[0].attemptNo).toBe(1);
  });

  it('mixed MCQ+ESSAY submit stays SUBMITTED, auto-awards the MCQ, and skips GRADE_PUBLISHED', async () => {
    const { service, answers, emitted } = build({
      questions: [
        {
          id: 'mcq-1',
          kind: QuestionKind.MULTIPLE_CHOICE,
          content: { options: ['a', 'b', 'c'], correct: [0] },
          points: 4,
          order: 0,
        },
        { id: 'essay-1', kind: ESSAY, content: {}, points: 6, order: 1 },
      ],
      maxScore: 10,
    });
    const started = await service.start('act-1', STUDENT);
    await service.saveAnswers(started.id, STUDENT, {
      answers: [
        { questionId: 'mcq-1', response: { selected: [0] } },
        { questionId: 'essay-1', response: { text: 'mi ensayo' } },
      ],
    });
    const done = await service.submit(started.id, STUDENT);

    expect(done.status).toBe(AttemptStatus.SUBMITTED);
    expect(done.score).toBeNull();
    expect(emitted).toHaveLength(0);
    expect(answers.find((a) => a.questionId === 'mcq-1')?.awarded).toBe(4);
    expect(answers.find((a) => a.questionId === 'essay-1')?.awarded ?? null).toBeNull();
  });

  it('grades subjective answers, sums awarded, emits GRADE_PUBLISHED when complete', async () => {
    const { service, emitted } = build({
      questions: [
        {
          id: 'mcq-1',
          kind: QuestionKind.MULTIPLE_CHOICE,
          content: { options: ['a', 'b', 'c'], correct: [0] },
          points: 4,
          order: 0,
        },
        { id: 'essay-1', kind: ESSAY, content: {}, points: 6, order: 1 },
      ],
      maxScore: 10,
    });
    const started = await service.start('act-1', STUDENT);
    await service.saveAnswers(started.id, STUDENT, {
      answers: [
        { questionId: 'mcq-1', response: { selected: [0] } },
        { questionId: 'essay-1', response: { text: 'mi ensayo' } },
      ],
    });
    await service.submit(started.id, STUDENT);

    const graded = await service.grade(started.id, TEACHER, {
      answers: [{ questionId: 'essay-1', awarded: 5 }],
      feedback: 'bien',
    } as unknown as GradeAttemptDto);

    expect(graded.status).toBe(AttemptStatus.GRADED);
    expect(graded.score).toBe(9);
    expect((graded as any).feedback).toBe('bien');
    expect(emitted).toHaveLength(1);
    expect(emitted[0]).toMatchObject({
      userId: STUDENT,
      type: NotificationType.GRADE_PUBLISHED,
    });
  });

  it('rejects awarded greater than question.points', async () => {
    const { service } = build({
      questions: [{ id: 'essay-1', kind: ESSAY, content: {}, points: 6, order: 0 }],
      maxScore: 6,
    });
    const started = await service.start('act-1', STUDENT);
    await service.saveAnswers(started.id, STUDENT, {
      answers: [{ questionId: 'essay-1', response: { text: 'hola' } }],
    });
    await service.submit(started.id, STUDENT);

    await expect(
      service.grade(started.id, TEACHER, {
        answers: [{ questionId: 'essay-1', awarded: 7 }],
      } as unknown as GradeAttemptDto),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('stays SUBMITTED if a subjective answer is omitted', async () => {
    const { service, emitted } = build({
      questions: [
        { id: 'essay-1', kind: ESSAY, content: {}, points: 5, order: 0 },
        { id: 'essay-2', kind: ESSAY, content: {}, points: 5, order: 1 },
      ],
      maxScore: 10,
    });
    const started = await service.start('act-1', STUDENT);
    await service.saveAnswers(started.id, STUDENT, {
      answers: [
        { questionId: 'essay-1', response: { text: 'uno' } },
        { questionId: 'essay-2', response: { text: 'dos' } },
      ],
    });
    await service.submit(started.id, STUDENT);

    const partial = await service.grade(started.id, TEACHER, {
      answers: [{ questionId: 'essay-1', awarded: 4 }],
    } as unknown as GradeAttemptDto);

    expect(partial.status).toBe(AttemptStatus.SUBMITTED);
    expect(partial.score).toBe(4);
    expect(emitted).toHaveLength(0);
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
      service.grade(started.id, STUDENT, {
        answers: [{ questionId: 'q1', awarded: 5 }],
      } as unknown as GradeAttemptDto),
    ).rejects.toThrow(/staff/i);
  });
});
