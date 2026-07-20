import { CourseRole, CourseStatus, QuestionKind } from '@prisma/client';
import { ActivitiesService } from './activities.service';
import type { PrismaService } from '../prisma/prisma.service';

describe('ActivitiesService.validateQuestionContent', () => {
  const svc = new ActivitiesService({} as unknown as PrismaService);
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
                status: CourseStatus.PUBLISHED,
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
            ? { role: CourseRole.TEACHER }
            : null,
      },
    } as unknown as PrismaService;
  }

  it('treats a non-member as if the activity does not exist (404)', async () => {
    const svc = new ActivitiesService(prismaFake());
    await expect(svc.findOne(ACTIVITY, 'stranger-999')).rejects.toThrow(
      /not found/i,
    );
  });
});
