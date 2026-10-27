import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PublicationStatus, QuestionKind } from '@prisma/client';
import { ActivitiesService } from '../activities.service';
import { TaskTemplatesService } from './task-templates.service';
import { accessFromPrisma } from '../../test/access-from-prisma';
import type { PrismaService } from '../../prisma/prisma.service';
import type { CreateActivityDto } from '../dto/create-activity.dto';

const ORG_A = 'org-klass-0001';
const ORG_B = 'org-other-0002';
const COURSE_A = 'course-web-101';
const COURSE_A2 = 'course-web-102';
const COURSE_B = 'course-other-201';
const TEACHER = 'user-diego-001';
const ASSISTANT = 'user-aina-001';
const STUDENT = 'user-lucia-001';
const TEACHER_B = 'user-berta-001';

const ESSAY = 'ESSAY' as unknown as QuestionKind;

const MCQ_CONTENT = { options: ['3', '4'], correct: [1] };

describe('TaskTemplatesService', () => {
  function buildWorld() {
    const users = [
      { id: TEACHER, organizationId: ORG_A, role: 'TEACHER', name: 'Diego' },
      { id: ASSISTANT, organizationId: ORG_A, role: 'STUDENT', name: 'Aina' },
      { id: STUDENT, organizationId: ORG_A, role: 'STUDENT', name: 'Lucía' },
      { id: TEACHER_B, organizationId: ORG_B, role: 'TEACHER', name: 'Berta' },
    ];
    const courses = [
      { id: COURSE_A, organizationId: ORG_A, title: 'Web 101' },
      { id: COURSE_A2, organizationId: ORG_A, title: 'Web 102' },
      { id: COURSE_B, organizationId: ORG_B, title: 'Other org' },
    ];
    const enrollments = [
      { courseId: COURSE_A, userId: TEACHER, role: 'TEACHER' as never },
      { courseId: COURSE_A2, userId: TEACHER, role: 'TEACHER' as never },
      { courseId: COURSE_A, userId: ASSISTANT, role: 'ASSISTANT' as never },
      { courseId: COURSE_A, userId: STUDENT, role: 'STUDENT' as never },
      { courseId: COURSE_B, userId: TEACHER_B, role: 'TEACHER' as never },
    ];
    const activities: any[] = [];
    const questions: any[] = [];
    const attempts: any[] = [];
    const templates: any[] = [];
    let seq = 0;

    const courseById = (id: string) => courses.find((c) => c.id === id) ?? null;

    const withActivityIncludes = (row: any, include: any) => {
      if (!row) return null;
      const out: any = { ...row };
      if (include?.course || include?.subject) {
        out.subject = courseById(row.subjectId ?? row.courseId);
        out.course = out.subject;
      }
      if (include?.questions) {
        out.questions = questions
          .filter((q) => q.activityId === row.id)
          .sort((a, b) => a.order - b.order);
      }
      if (include?.attempts) {
        out.attempts = attempts.filter((a) => a.activityId === row.id);
      }
      return out;
    };

    const prisma: any = {
      user: {
        findUnique: async ({ where }: any) =>
          users.find((u) => u.id === where.id) ?? null,
      },
      course: {
        findUnique: async ({ where }: any) => courseById(where.id),
      },
      subjectStaff: {
        findFirst: async ({ where }: any) => {
          const hit = enrollments.find((e) => {
            if (e.role === 'STUDENT') return false;
            if (where.userId && e.userId !== where.userId) return false;
            if (where.subject?.organizationId) {
              const course = courseById(e.courseId);
              if (!course || course.organizationId !== where.subject.organizationId) return false;
            }
            return true;
          });
          return hit ? { id: 'staff' } : null;
        },
      },
      enrollment: {
        findUnique: async ({ where }: any) => {
          const { courseId, userId } = where.courseId_userId;
          return (
            enrollments.find(
              (e) => e.courseId === courseId && e.userId === userId,
            ) ?? null
          );
        },
        findFirst: async ({ where }: any) => {
          return (
            enrollments.find((e) => {
              if (where.userId && e.userId !== where.userId) return false;
              if (where.role?.in && !where.role.in.includes(e.role)) return false;
              if (where.role && !where.role.in && e.role !== where.role) {
                return false;
              }
              if (where.course?.organizationId) {
                const course = courseById(e.courseId);
                if (!course || course.organizationId !== where.course.organizationId) {
                  return false;
                }
              }
              return true;
            }) ?? null
          );
        },
        findMany: async ({ where }: any) =>
          enrollments.filter((e) => {
            if (where?.userId && e.userId !== where.userId) return false;
            if (where?.courseId && e.courseId !== where.courseId) return false;
            if (where?.role?.in && !where.role.in.includes(e.role)) return false;
            if (where?.role && !where.role.in && e.role !== where.role) return false;
            return true;
          }),
      },
      activity: {
        findUnique: async ({ where, include }: any) =>
          withActivityIncludes(
            activities.find((a) => a.id === where.id),
            include,
          ),
        create: async ({ data, include }: any) => {
          seq += 1;
          const nested = data.questions?.create;
          const { questions: _ignored, ...rest } = data;
          const row = {
            id: rest.id ?? `act-${seq}`,
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
            ...rest,
          };
          activities.push(row);
          const toCreate = Array.isArray(nested) ? nested : nested ? [nested] : [];
          for (const q of toCreate) {
            seq += 1;
            questions.push({
              id: `q-${seq}`,
              activityId: row.id,
              points: 1,
              order: 0,
              ...q,
            });
          }
          return withActivityIncludes(row, include ?? { questions: true });
        },
        update: async ({ where, data, include }: any) => {
          const row = activities.find((a) => a.id === where.id);
          Object.assign(row, data);
          return withActivityIncludes(row, include);
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
        createMany: async ({ data }: any) => {
          const rows = Array.isArray(data) ? data : [data];
          for (const q of rows) {
            seq += 1;
            questions.push({ id: `q-${seq}`, points: 1, order: 0, ...q });
          }
          return { count: rows.length };
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
            if (where?.activityId && a.activityId !== where.activityId) return false;
            if (where?.userId && a.userId !== where.userId) return false;
            return true;
          }).length,
        findMany: async ({ where }: any) =>
          attempts.filter(
            (a) => !where?.activityId || a.activityId === where.activityId,
          ),
        create: async ({ data }: any) => {
          seq += 1;
          const row = { id: `att-${seq}`, ...data };
          attempts.push(row);
          return row;
        },
      },
      taskTemplate: {
        findUnique: async ({ where }: any) =>
          templates.find((t) => t.id === where.id) ?? null,
        findFirst: async ({ where }: any) =>
          templates.find((t) => t.id === where.id && t.organizationId === where.organizationId) ?? null,
        findMany: async ({ where }: any) =>
          templates.filter(
            (t) =>
              !where?.organizationId || t.organizationId === where.organizationId,
          ),
        create: async ({ data }: any) => {
          seq += 1;
          const row = {
            id: `tpl-${seq}`,
            createdAt: new Date(),
            updatedAt: new Date(),
            description: null,
            createdFromId: null,
            ...data,
          };
          templates.push(row);
          return row;
        },
        update: async ({ where, data }: any) => {
          const row = templates.find((t) => t.id === where.id);
          Object.assign(row, data);
          return row;
        },
        delete: async ({ where }: any) => {
          const idx = templates.findIndex((t) => t.id === where.id);
          const [row] = templates.splice(idx, 1);
          return row;
        },
      },
    };
    prisma.$transaction = async (arg: any) => {
      if (typeof arg === 'function') return arg(prisma);
      return Promise.all(arg);
    };

    const activitiesService = new ActivitiesService(prisma as PrismaService, accessFromPrisma(prisma));
    const templatesService = new TaskTemplatesService(prisma as PrismaService, accessFromPrisma(prisma));
    return {
      activitiesService,
      templatesService,
      activities,
      questions,
      attempts,
      templates,
    };
  }

  async function seedExam(world: ReturnType<typeof buildWorld>) {
    const activity = await world.activitiesService.create(COURSE_A, TEACHER, {
      title: 'Examen mixto',
      description: 'MCQ + ensayo',
    });
    world.questions.push(
      {
        id: 'q-mcq',
        activityId: activity.id,
        kind: QuestionKind.MULTIPLE_CHOICE,
        prompt: '2+2',
        points: 3,
        order: 0,
        content: MCQ_CONTENT,
      },
      {
        id: 'q-essay',
        activityId: activity.id,
        kind: ESSAY,
        prompt: 'Desarrolla',
        points: 7,
        order: 1,
        content: {},
      },
    );
    world.attempts.push({
      id: 'att-src',
      activityId: activity.id,
      userId: STUDENT,
      status: 'GRADED',
      score: 9,
      attemptNo: 1,
    });
    return activity;
  }

  it('saveFromActivity snapshots questions and does not copy attempts', async () => {
    const world = buildWorld();
    const activity = await seedExam(world);

    const template = await world.templatesService.saveFromActivity(
      activity.id,
      TEACHER,
    );

    expect(template.createdFromId).toBe(activity.id);
    expect(template.organizationId).toBe(ORG_A);
    expect(template.createdById).toBe(TEACHER);
    expect(template.title).toBe('Examen mixto');
    expect(template.blocks).toEqual([
      {
        kind: QuestionKind.MULTIPLE_CHOICE,
        prompt: '2+2',
        points: 3,
        order: 0,
        content: MCQ_CONTENT,
      },
      {
        kind: ESSAY,
        prompt: 'Desarrolla',
        points: 7,
        order: 1,
        content: {},
      },
    ]);
    expect(JSON.stringify(template.blocks)).not.toMatch(/att-src/);
    expect(
      world.attempts.filter((a) => a.activityId === activity.id),
    ).toHaveLength(1);
  });

  it('grades a template preview without creating activities or attempts', async () => {
    const world = buildWorld();
    const source = await seedExam(world);
    const template = await world.templatesService.saveFromActivity(source.id, TEACHER);
    const activityCount = world.activities.length;
    const attemptCount = world.attempts.length;

    const preview = await world.templatesService.previewGrade(template.id, TEACHER, {
      answers: [{ questionId: `${template.id}:0`, response: { selected: [1] } }],
    });

    expect(preview).toMatchObject({
      score: 3,
      maxScore: 10,
      results: [
        { questionId: `${template.id}:0`, autoGradable: true, correct: true, awarded: 3, points: 3 },
        { questionId: `${template.id}:1`, autoGradable: false, correct: null, awarded: null, points: 7 },
      ],
    });
    expect(preview.solutions[0]).toEqual({
      questionId: `${template.id}:0`,
      content: MCQ_CONTENT,
    });
    expect(world.activities).toHaveLength(activityCount);
    expect(world.attempts).toHaveLength(attemptCount);
  });

  it('create from templateId hydrates questions with same kind/prompt/points/content', async () => {
    const world = buildWorld();
    const source = await seedExam(world);
    const template = await world.templatesService.saveFromActivity(
      source.id,
      TEACHER,
    );

    const copy = await world.activitiesService.create(COURSE_A2, TEACHER, {
      title: 'Copia desde plantilla',
      templateId: template.id,
    } as CreateActivityDto);

    expect((copy as any).templateId).toBe(template.id);
    expect(copy.questions).toHaveLength(2);
    expect(copy.questions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: QuestionKind.MULTIPLE_CHOICE,
          prompt: '2+2',
          points: 3,
          content: MCQ_CONTENT,
        }),
        expect.objectContaining({
          kind: ESSAY,
          prompt: 'Desarrolla',
          points: 7,
          content: {},
        }),
      ]),
    );
  });

  it('create from templateId leaves attempts empty', async () => {
    const world = buildWorld();
    const source = await seedExam(world);
    const template = await world.templatesService.saveFromActivity(
      source.id,
      TEACHER,
    );

    const copy = await world.activitiesService.create(COURSE_A2, TEACHER, {
      title: 'Copia limpia',
      templateId: template.id,
    } as CreateActivityDto);

    expect(
      world.attempts.filter((a) => a.activityId === copy.id),
    ).toHaveLength(0);
    expect(
      world.attempts.filter((a) => a.activityId === source.id),
    ).toHaveLength(1);
  });

  it('rejects templateId from another organization with NotFoundException', async () => {
    const world = buildWorld();
    const source = await seedExam(world);
    const template = await world.templatesService.saveFromActivity(
      source.id,
      TEACHER,
    );

    await expect(
      world.activitiesService.create(COURSE_B, TEACHER_B, {
        title: 'Intruso',
        templateId: template.id,
      } as CreateActivityDto),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects templateId and sourceActivityId together with BadRequestException', async () => {
    const world = buildWorld();
    await expect(
      world.activitiesService.create(COURSE_A, TEACHER, {
        title: 'Conflicto',
        templateId: 'tpl-1',
        sourceActivityId: 'act-1',
      } as CreateActivityDto),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('student cannot findAll (NotFoundException)', async () => {
    const world = buildWorld();
    await seedExam(world);
    await world.templatesService.saveFromActivity(
      world.activities[0].id,
      TEACHER,
    );

    await expect(world.templatesService.findAll(STUDENT)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('assistant of a course in the org can findAll but cannot delete another teacher template (ForbiddenException)', async () => {
    const world = buildWorld();
    const source = await seedExam(world);
    const template = await world.templatesService.saveFromActivity(
      source.id,
      TEACHER,
    );

    const list = await world.templatesService.findAll(ASSISTANT);
    expect(list.map((t: { id: string }) => t.id)).toContain(template.id);

    await expect(
      world.templatesService.remove(template.id, ASSISTANT),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(world.templates.find((t) => t.id === template.id)).toBeDefined();
  });
});
