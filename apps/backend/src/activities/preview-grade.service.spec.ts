import {
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PublicationStatus, QuestionKind } from '@prisma/client';
import { ActivitiesService } from './activities.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { PreviewGradeDto } from './dto/preview-grade.dto';

describe('ActivitiesService.previewGrade', () => {
  const ACTIVITY_ID = 'activity-preview-1';
  const SUBJECT_ID = 'subject-preview-1';
  const ORG_A = 'org-a';
  const ORG_B = 'org-b';
  const TEACHER = 'teacher-a';
  const STUDENT = 'student-a';
  const OTHER_ORG_TEACHER = 'teacher-b';

  const questions = [
    {
      id: 'question-choice',
      activityId: ACTIVITY_ID,
      kind: QuestionKind.MULTIPLE_CHOICE,
      prompt: '¿Cuánto es 2 + 2?',
      points: 2,
      order: 0,
      content: { options: ['3', '4'], correct: [1] },
    },
    {
      id: 'question-essay',
      activityId: ACTIVITY_ID,
      kind: QuestionKind.ESSAY,
      prompt: 'Explica el resultado.',
      points: 3,
      order: 1,
      content: { maxChars: 300 },
    },
  ];

  function build() {
    const findFirst = jest.fn(async ({ where }: any) => {
      if (where.id !== ACTIVITY_ID || where.subject.is.organizationId !== ORG_A) {
        return null;
      }
      return {
        id: ACTIVITY_ID,
        subjectId: SUBJECT_ID,
        title: 'Tarea de prueba',
        status: PublicationStatus.DRAFT,
        openAt: new Date('2020-01-01T00:00:00.000Z'),
        closeAt: new Date('2020-01-02T00:00:00.000Z'),
        maxScore: 20,
        subject: { id: SUBJECT_ID, organizationId: ORG_A },
        questions,
      };
    });
    const attemptCreate = jest.fn();
    const answerCreate = jest.fn();
    const access = {
      assertSubjectStaffForUser: jest.fn(async (subjectId: string, userId: string) => {
        if (userId === STUDENT) throw new ForbiddenException();
        if (subjectId !== SUBJECT_ID) throw new NotFoundException();
        return { isStaff: true };
      }),
    };
    const prisma = {
      user: {
        findUnique: async ({ where }: any) => {
          if (where.id === TEACHER || where.id === STUDENT) {
            return { id: where.id, organizationId: ORG_A };
          }
          if (where.id === OTHER_ORG_TEACHER) {
            return { id: where.id, organizationId: ORG_B };
          }
          return null;
        },
      },
      activity: { findFirst },
      attempt: { create: attemptCreate },
      answer: { create: answerCreate },
    } as unknown as PrismaService;
    return {
      service: new ActivitiesService(prisma, access as never),
      findFirst,
      attemptCreate,
      answerCreate,
      access,
    };
  }

  const dto: PreviewGradeDto = {
    answers: [
      { questionId: 'question-choice', response: { selected: [1] } },
      { questionId: 'question-essay', response: { text: 'Porque 2 + 2 = 4.' } },
    ],
  };

  it('grades a draft outside its window and returns answer-key content without writes', async () => {
    const { service, findFirst, attemptCreate, answerCreate } = build();

    const preview = await service.previewGrade(ACTIVITY_ID, TEACHER, dto);

    expect(findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        id: ACTIVITY_ID,
        subject: { is: { organizationId: ORG_A } },
      },
    }));
    expect(preview).toEqual({
      score: 8,
      maxScore: 20,
      results: [
        {
          questionId: 'question-choice',
          autoGradable: true,
          correct: true,
          awarded: 2,
          points: 2,
        },
        {
          questionId: 'question-essay',
          autoGradable: false,
          correct: null,
          awarded: null,
          points: 3,
        },
      ],
      solutions: questions.map(({ id, content }) => ({
        questionId: id,
        content,
      })),
    });
    expect(attemptCreate).not.toHaveBeenCalled();
    expect(answerCreate).not.toHaveBeenCalled();
  });

  it('rejects students with 403', async () => {
    const { service } = build();
    await expect(service.previewGrade(ACTIVITY_ID, STUDENT, dto)).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('returns 404 for another organization', async () => {
    const { service, findFirst, access } = build();
    await expect(
      service.previewGrade(ACTIVITY_ID, OTHER_ORG_TEACHER, dto),
    ).rejects.toThrow(NotFoundException);
    expect(findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        id: ACTIVITY_ID,
        subject: { is: { organizationId: ORG_B } },
      },
    }));
    expect(access.assertSubjectStaffForUser).not.toHaveBeenCalled();
  });

  it('rejects answers that do not belong to this activity', async () => {
    const { service } = build();
    await expect(
      service.previewGrade(ACTIVITY_ID, TEACHER, {
        answers: [{ questionId: 'elsewhere', response: {} }],
      }),
    ).rejects.toThrow(/no pertenece/i);
  });
});
