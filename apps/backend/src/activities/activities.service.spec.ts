import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PublicationStatus, QuestionKind } from '@prisma/client';
import { ActivitiesService } from './activities.service';
import { accessFromPrisma } from '../test/access-from-prisma';
import type { PrismaService } from '../prisma/prisma.service';
import type { UpdateActivityDto } from './dto/update-activity.dto';
import type { CreateQuestionDto } from './dto/create-question.dto';

describe('ActivitiesService.validateQuestionContent', () => {
  const svc = new ActivitiesService({} as unknown as PrismaService, {} as never);
  const ok = (kind: QuestionKind, content: unknown) =>
    expect(() => svc.validateQuestionContent(kind, content)).not.toThrow();
  const bad = (kind: QuestionKind, content: unknown) =>
    expect(() => svc.validateQuestionContent(kind, content)).toThrow();

  it('MULTIPLE_CHOICE needs ≥2 options and valid correct indices', () => {
    ok(QuestionKind.MULTIPLE_CHOICE, { options: ['a', 'b'], correct: [0] });
    bad(QuestionKind.MULTIPLE_CHOICE, { options: ['a'], correct: [0] });
    bad(QuestionKind.MULTIPLE_CHOICE, { options: ['a', 'b'], correct: [5] });
    bad(QuestionKind.MULTIPLE_CHOICE, { options: ['a', 'b'], correct: [] });
  });

  it('TRUE_FALSE needs a boolean answer', () => {
    ok(QuestionKind.TRUE_FALSE, { answer: false });
    bad(QuestionKind.TRUE_FALSE, { answer: 'no' });
  });

  it('FILL_BLANK needs each blank to carry accepted answers', () => {
    ok(QuestionKind.FILL_BLANK, { blanks: [{ accepted: ['a'] }] });
    bad(QuestionKind.FILL_BLANK, { blanks: [] });
    bad(QuestionKind.FILL_BLANK, { blanks: [{ accepted: [] }] });
  });

  it('MATCHING needs left/right and in-bounds pairs', () => {
    ok(QuestionKind.MATCHING, {
      left: ['1'],
      right: ['a'],
      pairs: [[0, 0]],
    });
    bad(QuestionKind.MATCHING, { left: ['1'], right: ['a'], pairs: [[0, 5]] });
    bad(QuestionKind.MATCHING, { left: [], right: ['a'], pairs: [] });
  });

  it('ORDERING needs a permutation of item indices', () => {
    ok(QuestionKind.ORDERING, { items: ['x', 'y'], correctOrder: [1, 0] });
    bad(QuestionKind.ORDERING, { items: ['x', 'y'], correctOrder: [0, 0] });
    bad(QuestionKind.ORDERING, { items: ['x'], correctOrder: [0] });
  });

  it('SHORT_ANSWER accepts an optional accepted[]', () => {
    ok(QuestionKind.SHORT_ANSWER, {});
    ok(QuestionKind.SHORT_ANSWER, { accepted: ['Madrid'] });
    bad(QuestionKind.SHORT_ANSWER, { accepted: 'Madrid' });
  });
});

describe('ActivitiesService.stripAnswerKey', () => {
  it('removes the correct answers but keeps what the UI needs', () => {
    expect(
      ActivitiesService.stripAnswerKey(QuestionKind.MULTIPLE_CHOICE, {
        options: ['a', 'b'],
        correct: [1],
      }),
    ).toEqual({ options: ['a', 'b'] });

    expect(
      ActivitiesService.stripAnswerKey(QuestionKind.ORDERING, {
        items: ['x', 'y'],
        correctOrder: [1, 0],
      }),
    ).toEqual({ items: ['x', 'y'] });

    // FILL_BLANK keeps only the blank count (no accepted answers leak).
    expect(
      ActivitiesService.stripAnswerKey(QuestionKind.FILL_BLANK, {
        blanks: [{ accepted: ['a'] }, { accepted: ['b'] }],
      }),
    ).toEqual({ blanks: [{}, {}] });

    expect(
      ActivitiesService.stripAnswerKey(QuestionKind.TRUE_FALSE, { answer: true }),
    ).toEqual({});
  });
});

describe('ActivitiesService tenancy', () => {
  const ACTIVITY = 'act-1';
  const COURSE = 'course-web-101';

  function prismaFake(): PrismaService {
    return {
      activity: {
        findUnique: async ({ where }: any) =>
          where.id === ACTIVITY
            ? {
                id: ACTIVITY,
                courseId: COURSE,
                status: PublicationStatus.PUBLISHED,
                course: { id: COURSE, organizationId: 'org-klass-0001' },
              }
            : null,
      },
      course: {
        findUnique: async ({ where }: any) =>
          where.id === COURSE
            ? { id: COURSE, organizationId: 'org-klass-0001' }
            : null,
      },
      enrollment: {
        // Only the teacher is enrolled; strangers get no enrollment.
        findUnique: async ({ where }: any) =>
          where.courseId_userId.userId === 'user-diego-001'
            ? { role: 'TEACHER' as never }
            : null,
      },
    } as unknown as PrismaService;
  }

  it('treats a non-member as if the activity does not exist (404)', async () => {
    const prisma = prismaFake();
    const svc = new ActivitiesService(prisma, accessFromPrisma(prisma));
    await expect(svc.findOne(ACTIVITY, 'stranger-999')).rejects.toThrow(
      /not found/i,
    );
  });
});

describe('ActivitiesService authoring (flag, derived maxScore, lock)', () => {
  const COURSE = 'course-web-101';
  const ORG = 'org-klass-0001';
  const TEACHER = 'user-diego-001';
  const STUDENT = 'user-lucia-001';
  const ESSAY = 'ESSAY' as unknown as QuestionKind;

  const MCQ_DTO: CreateQuestionDto = {
    kind: QuestionKind.MULTIPLE_CHOICE,
    prompt: '2+2',
    points: 3,
    content: { options: ['3', '4'], correct: [1] },
  };

  function build(notifications?: unknown) {
    const activities: any[] = [];
    const questions: any[] = [];
    const attempts: any[] = [];
    let seq = 0;

    const withIncludes = (row: any, include: any) => {
      if (!row) return null;
      const out: any = { ...row };
      if (include?.course || include?.subject) {
        out.course = { id: COURSE, organizationId: ORG, title: 'Web 101' };
        out.subject = out.course;
      }
      if (include?.questions) {
        out.questions = questions
          .filter((q) => q.activityId === row.id)
          .sort((a, b) => a.order - b.order);
      }
      return out;
    };

    const prisma: any = {
      course: {
        findUnique: async ({ where }: any) =>
          where.id === COURSE
            ? { id: COURSE, organizationId: ORG, title: 'Web 101' }
            : null,
      },
      enrollment: {
        findUnique: async ({ where }: any) => {
          const { courseId, userId } = where.courseId_userId;
          if (courseId !== COURSE) return null;
          if (userId === TEACHER) return { role: 'TEACHER' as never };
          if (userId === STUDENT) return { role: 'STUDENT' as never };
          return null;
        },
      },
      activity: {
        findUnique: async ({ where, include }: any) =>
          withIncludes(
            activities.find((a) => a.id === where.id),
            include,
          ),
        create: async ({ data, include }: any) => {
          seq += 1;
          const row = {
            id: `act-${seq}`,
            maxScore: 0,
            countsTowardFinal: true,
            status: PublicationStatus.DRAFT,
            type: 'QUIZ',
            description: null,
            openAt: null,
            dueAt: null,
            closeAt: null,
            attemptsAllowed: 1,
            timeLimitSec: null,
            config: {},
            templateId: null,
            createdAt: new Date(),
            updatedAt: new Date(),
            ...data,
          };
          activities.push(row);
          return withIncludes(row, include ?? { questions: true });
        },
        update: async ({ where, data, include }: any) => {
          const row = activities.find((a) => a.id === where.id);
          Object.assign(row, data);
          return withIncludes(row, include ?? { questions: true });
        },
        delete: async ({ where }: any) => {
          const idx = activities.findIndex((a) => a.id === where.id);
          const [row] = activities.splice(idx, 1);
          return row;
        },
      },
      question: {
        count: async ({ where }: any) =>
          questions.filter((q) => q.activityId === where.activityId).length,
        findMany: async ({ where, orderBy }: any) => {
          const rows = questions.filter(
            (q) => !where?.activityId || q.activityId === where.activityId,
          );
          if (orderBy?.order === 'asc') rows.sort((a, b) => a.order - b.order);
          return rows;
        },
        findUnique: async ({ where }: any) =>
          questions.find((q) => q.id === where.id) ?? null,
        create: async ({ data }: any) => {
          seq += 1;
          const row = { id: `q-${seq}`, points: 1, order: 0, ...data };
          questions.push(row);
          return row;
        },
        update: async ({ where, data }: any) => {
          const row = questions.find((q) => q.id === where.id);
          Object.assign(row, data);
          return row;
        },
        delete: async ({ where }: any) => {
          const idx = questions.findIndex((q) => q.id === where.id);
          const [row] = questions.splice(idx, 1);
          return row;
        },
      },
      attempt: {
        count: async ({ where }: any) =>
          attempts.filter((a) => {
            if (where?.activityId && a.activityId !== where.activityId) {
              return false;
            }
            if (where?.userId && a.userId !== where.userId) return false;
            return true;
          }).length,
        findFirst: async ({ where }: any) =>
          attempts.find((a) => {
            if (where?.activityId && a.activityId !== where.activityId) {
              return false;
            }
            return true;
          }) ?? null,
      },
    };
    prisma.$transaction = async (arg: any) => {
      if (typeof arg === 'function') return arg(prisma);
      return Promise.all(arg);
    };

    return {
      service: new ActivitiesService(prisma as PrismaService, accessFromPrisma(prisma), notifications as never),
      activities,
      questions,
      attempts,
    };
  }

  it('ignores client maxScore and sets 0 when there are no questions', async () => {
    const { service } = build();
    const created = await service.create(COURSE, TEACHER, {
      title: 'Tarea vacía',
      maxScore: 99,
    });
    expect(created.maxScore).toBe(0);
    expect(created.questions).toEqual([]);
  });

  it('recomputes maxScore as sum of question points after addQuestion', async () => {
    const { service } = build();
    const created = await service.create(COURSE, TEACHER, {
      title: 'Examen',
    });

    await service.addQuestion(created.id, TEACHER, {
      kind: ESSAY,
      prompt: 'Desarrolla',
      points: 7,
      content: {},
    } as CreateQuestionDto);
    await service.addQuestion(created.id, TEACHER, MCQ_DTO);

    const found = await service.findOne(created.id, TEACHER);
    expect(found.maxScore).toBe(10);
  });

  it('stores countsTowardFinal default true and can patch false', async () => {
    const { service } = build();
    const created = await service.create(COURSE, TEACHER, {
      title: 'Tarea',
    });
    expect((created as any).countsTowardFinal).toBe(true);

    const patched = await service.update(created.id, TEACHER, {
      countsTowardFinal: false,
    } as UpdateActivityDto);
    expect((patched as any).countsTowardFinal).toBe(false);
  });

  it('addQuestion throws ConflictException when an attempt exists', async () => {
    const { service, attempts } = build();
    const created = await service.create(COURSE, TEACHER, { title: 'Quiz' });
    attempts.push({
      id: 'att-1',
      activityId: created.id,
      userId: STUDENT,
      status: 'SUBMITTED',
    });

    await expect(service.addQuestion(created.id, TEACHER, MCQ_DTO)).rejects.toBeInstanceOf(
      ConflictException,
    );
    await expect(service.addQuestion(created.id, TEACHER, MCQ_DTO)).rejects.toThrow(
      /la estructura está bloqueada/,
    );
  });

  it('remove throws ConflictException when attempts exist', async () => {
    const { service, attempts } = build();
    const created = await service.create(COURSE, TEACHER, { title: 'Quiz' });
    attempts.push({
      id: 'att-1',
      activityId: created.id,
      userId: STUDENT,
      status: 'GRADED',
    });

    await expect(service.remove(created.id, TEACHER)).rejects.toBeInstanceOf(
      ConflictException,
    );
    await expect(service.remove(created.id, TEACHER)).rejects.toThrow(
      /archivar en su lugar/,
    );
  });

  it('remove deletes the notifications that deep-link to the deleted activity', async () => {
    const notify = { emitMany: jest.fn(), removeByLink: jest.fn() };
    const { service, activities } = build(notify);
    const created = await service.create(COURSE, TEACHER, { title: 'Borrador' });

    await service.remove(created.id, TEACHER);

    expect(activities.find((a: any) => a.id === created.id)).toBeUndefined();
    expect(notify.removeByLink).toHaveBeenCalledWith(expect.any(String), {
      endsWith: [`activityId=${created.id}`],
    });
  });

  it('refuses to publish a task whose total is 0 points', async () => {
    const { service } = build();
    const created = await service.create(COURSE, TEACHER, { title: 'Sin puntos' });
    await service.addQuestion(created.id, TEACHER, { ...MCQ_DTO, points: 0 });

    await expect(
      service.update(created.id, TEACHER, { status: PublicationStatus.PUBLISHED }),
    ).rejects.toThrow(/0 puntos en total/);
  });

  it('refuses to publish when any non-upload question has 0 points', async () => {
    const { service } = build();
    const created = await service.create(COURSE, TEACHER, { title: 'Mixta' });
    await service.addQuestion(created.id, TEACHER, MCQ_DTO);
    await service.addQuestion(created.id, TEACHER, { ...MCQ_DTO, points: 0 });

    await expect(
      service.update(created.id, TEACHER, { status: PublicationStatus.PUBLISHED }),
    ).rejects.toThrow(/La pregunta 2 tiene 0 puntos/);
  });

  it('still publishes a 0-point FILE_UPLOAD companion and re-saves published tasks', async () => {
    const { service } = build();
    const created = await service.create(COURSE, TEACHER, { title: 'Con fichero' });
    await service.addQuestion(created.id, TEACHER, MCQ_DTO);
    await service.addQuestion(created.id, TEACHER, {
      kind: QuestionKind.FILE_UPLOAD,
      prompt: 'Evidencia',
      points: 0,
      content: { maxFiles: 1 },
    });

    const published = await service.update(created.id, TEACHER, {
      status: PublicationStatus.PUBLISHED,
    });
    expect(published.status).toBe(PublicationStatus.PUBLISHED);
    await expect(
      service.update(created.id, TEACHER, { status: PublicationStatus.PUBLISHED }),
    ).resolves.toBeDefined();
  });

  it('publishing with no questions throws BadRequestException', async () => {
    const { service } = build();
    const created = await service.create(COURSE, TEACHER, { title: 'Vacía' });

    await expect(
      service.update(created.id, TEACHER, { status: PublicationStatus.PUBLISHED }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.update(created.id, TEACHER, { status: PublicationStatus.PUBLISHED }),
    ).rejects.toThrow(/no se puede publicar vacía/);
  });
});

describe('ActivitiesService source activity authorization', () => {
  it('hides an inaccessible source activity before loading its questions', async () => {
    const access = {
      assertSubjectStaffForUser: jest.fn(async (subjectId: string) => {
        if (subjectId === 'destination-subject') {
          return {
            subject: { id: subjectId, organizationId: 'org-klass-0001' },
            isStaff: true,
          };
        }
        throw new ForbiddenException();
      }),
      assertSubjectReadableForUser: jest.fn(),
    };
    const prisma = {
      activity: {
        findFirst: jest.fn(async () => ({ subjectId: 'source-subject' })),
        create: jest.fn(),
      },
    } as unknown as PrismaService;
    const service = new ActivitiesService(prisma, access as any);

    await expect(
      service.create('destination-subject', 'user-teacher-001', {
        title: 'Copia',
        sourceActivityId: 'private-source',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(access.assertSubjectStaffForUser).toHaveBeenNthCalledWith(
      1,
      'destination-subject',
      'user-teacher-001',
    );
    expect(access.assertSubjectStaffForUser).toHaveBeenNthCalledWith(
      2,
      'source-subject',
      'user-teacher-001',
    );
    expect(prisma.activity.findFirst).toHaveBeenCalledTimes(1);
    expect(prisma.activity.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'private-source',
        subject: { organizationId: 'org-klass-0001' },
      },
      select: { subjectId: true },
    });
    expect(prisma.activity.create).not.toHaveBeenCalled();
  });
});

describe('ActivitiesService.listMyPendingActivities', () => {
  const ORG = 'org-klass-0001';
  const USER = {
    userId: 'user-lucia-001', email: 'lucia@example.test', name: 'Lucía',
    avatarUrl: null, organizationId: ORG, role: 'STUDENT',
    emailNotificationsEnabled: true, preferredLanguage: 'es',
  } as const;
  const NOW = new Date('2026-10-27T12:00:00Z');
  const day = (n: number) => new Date(NOW.getTime() + n * 86400000);
  const row = (
    id: string,
    over: Partial<{
      dueAt: Date | null; closeAt: Date | null; attemptsAllowed: number;
      attempts: { status: string }[];
    }> = {},
  ) => ({
    id, subjectId: 'subj-1', title: id, description: null, openAt: null,
    dueAt: null, closeAt: null, attemptsAllowed: 1, attempts: [], ...over,
  });
  const build = (rows: ReturnType<typeof row>[]) => {
    const findMany = jest.fn().mockResolvedValue(rows);
    const svc = new ActivitiesService(
      { activity: { findMany } } as unknown as PrismaService,
      {} as never,
    );
    return { svc, findMany };
  };

  it('scopes the query to published work of the user in their organization, skipping archived cohorts and closed windows', async () => {
    const { svc, findMany } = build([]);
    await svc.listMyPendingActivities(USER, NOW);

    const args = findMany.mock.calls[0][0];
    expect(args.where.status).toBe('PUBLISHED');
    expect(args.where.OR).toEqual([{ closeAt: null }, { closeAt: { gt: NOW } }]);
    expect(args.where.subject).toEqual({
      organizationId: ORG,
      status: 'PUBLISHED',
      course: {
        organizationId: ORG,
        status: { not: 'ARCHIVED' },
        memberships: { some: { userId: USER.userId } },
      },
    });
    expect(args.select.attempts).toEqual({
      where: { userId: USER.userId },
      select: { status: true },
    });
  });

  it('drops activities already handed in (graded or submitted)', async () => {
    const { svc } = build([
      row('graded', { dueAt: day(1), attempts: [{ status: 'GRADED' }] }),
      row('submitted', { dueAt: day(1), attempts: [{ status: 'SUBMITTED' }] }),
      row('fresh', { dueAt: day(2) }),
    ]);
    const out = await svc.listMyPendingActivities(USER, NOW);
    expect(out.map((a) => a.id)).toEqual(['fresh']);
  });

  it('drops handed-in work even with retries left, keeps untouched and in-progress ones', async () => {
    const { svc } = build([
      row('retry-left', { dueAt: day(1), attemptsAllowed: 2, attempts: [{ status: 'GRADED' }] }),
      row('unlimited-done', { dueAt: day(1), attemptsAllowed: 0, attempts: [{ status: 'SUBMITTED' }] }),
      row('untouched', { dueAt: day(2), attemptsAllowed: 0 }),
      row('resuming', { dueAt: day(3), attemptsAllowed: 2, attempts: [{ status: 'GRADED' }, { status: 'IN_PROGRESS' }] }),
    ]);
    const out = await svc.listMyPendingActivities(USER, NOW);
    expect(out.map((a) => [a.id, a.attemptsUsed, a.inProgress])).toEqual([
      ['untouched', 0, false],
      ['resuming', 2, true],
    ]);
  });

  it('sorts by dueAt then closeAt, undated last, and serializes dates', async () => {
    const { svc } = build([
      row('undated'),
      row('closeOnly', { closeAt: day(5) }),
      row('late', { dueAt: day(9) }),
      row('soon', { dueAt: day(1), closeAt: day(30) }),
    ]);
    const out = await svc.listMyPendingActivities(USER, NOW);
    expect(out.map((a) => a.id)).toEqual(['soon', 'closeOnly', 'late', 'undated']);
    expect(out[0].dueAt).toBe(day(1).toISOString());
    expect(out[3].dueAt).toBeNull();
    expect(out[0]).not.toHaveProperty('attempts');
  });
});
