import { ForbiddenException, NotFoundException } from '@nestjs/common';
import type { AuthUser } from '@/common/auth';
import { CourseAccessService } from '../course-access.service';
import { EnrollmentsController } from '../enrollments/enrollments.controller';
import { LessonsController } from '../lessons/lessons.controller';
import { SectionsController } from '../sections/sections.controller';

const ASSISTANT: AuthUser = {
  userId: 'assistant-1',
  email: 'assistant@example.test',
  name: 'Assistant',
  avatarUrl: null,
  organizationId: 'org-1',
  role: 'STUDENT',
  emailNotificationsEnabled: true,
  preferredLanguage: 'es',
};

const SUBJECT_ID = 'course-web-101';

describe('course-content controller authorization', () => {
  it('authorizes subject staff to create a section', async () => {
    const sections = { create: jest.fn().mockResolvedValue({ id: 'section-1' }) };
    const access = { assertSubjectStaff: jest.fn().mockResolvedValue({ subject: { id: SUBJECT_ID } }) };
    const controller = new SectionsController(sections as never, access as never);

    await controller.create(SUBJECT_ID, ASSISTANT, { title: 'Week 1' });

    expect(access.assertSubjectStaff).toHaveBeenCalledWith(SUBJECT_ID, ASSISTANT);
    expect(sections.create).toHaveBeenCalledWith(SUBJECT_ID, ASSISTANT.organizationId, {
      title: 'Week 1',
    }, ASSISTANT.userId);
  });

  it('checks subject readability before exposing section lessons', async () => {
    const lessons = {
      findSectionSubjectId: jest.fn().mockResolvedValue({ subjectId: SUBJECT_ID }),
      findAll: jest.fn().mockResolvedValue([]),
    };
    const access = { assertSubjectReadable: jest.fn().mockResolvedValue({ subject: { id: SUBJECT_ID } }) };
    const controller = new LessonsController(lessons as never, access as never);

    await controller.findAll('section-1', ASSISTANT);

    expect(access.assertSubjectReadable).toHaveBeenCalledWith(SUBJECT_ID, ASSISTANT);
    expect(lessons.findAll).toHaveBeenCalledWith('section-1', ASSISTANT.organizationId);
  });

  it('passes the validated ordered id list to the sections service', async () => {
    const sections = { reorder: jest.fn().mockResolvedValue(undefined) };
    const access = { assertSubjectStaff: jest.fn().mockResolvedValue(undefined) };
    const controller = new SectionsController(sections as never, access as never);
    const orderedIds = [`c${'a'.repeat(24)}`, `c${'b'.repeat(24)}`];

    await expect(controller.reorder(SUBJECT_ID, ASSISTANT, { orderedIds })).resolves.toEqual({
      reordered: true,
    });
    expect(sections.reorder).toHaveBeenCalledWith(
      SUBJECT_ID,
      ASSISTANT.organizationId,
      orderedIds,
      ASSISTANT.userId,
    );
  });

  it('passes the validated file id to the lesson attachment service', async () => {
    const lessons = {
      findSubjectId: jest.fn().mockResolvedValue({ section: { subjectId: SUBJECT_ID } }),
      attachFile: jest.fn().mockResolvedValue({ id: 'attachment-1' }),
    };
    const access = { assertSubjectStaff: jest.fn().mockResolvedValue(undefined) };
    const controller = new LessonsController(lessons as never, access as never);
    const fileId = `c${'f'.repeat(24)}`;

    await controller.attachFile('lesson-1', ASSISTANT, { fileId });

    expect(lessons.attachFile).toHaveBeenCalledWith(
      'lesson-1',
      fileId,
      ASSISTANT.organizationId,
      ASSISTANT.userId,
    );
  });
});

describe('progress controller authorization', () => {
  it('checks a lesson subject is readable before completing it', async () => {
    const enrollments = {
      findLessonSubjectId: jest.fn().mockResolvedValue({ subjectId: SUBJECT_ID }),
      completeLesson: jest.fn().mockResolvedValue({ completed: true, progress: 10 }),
    };
    const access = { assertSubjectReadable: jest.fn().mockResolvedValue({ subject: { id: SUBJECT_ID } }) };
    const controller = new EnrollmentsController(enrollments as never, access as never);

    await controller.completeLesson('lesson-1', ASSISTANT);

    expect(access.assertSubjectReadable).toHaveBeenCalledWith(SUBJECT_ID, ASSISTANT);
    expect(enrollments.completeLesson).toHaveBeenCalledWith(
      'lesson-1',
      ASSISTANT.organizationId,
      ASSISTANT.userId,
    );
  });
});

describe('lesson progress endpoints', () => {
  const ORG = 'org-1';
  const OTHER_ORG_USER: AuthUser = { ...ASSISTANT, userId: 'other-1', organizationId: 'org-2' };
  const TEACHER: AuthUser = { ...ASSISTANT, userId: 'teacher-1', role: 'TEACHER' };
  const STUDENT: AuthUser = { ...ASSISTANT, userId: 'student-1', role: 'STUDENT' };

  /** Real access service over a fake DB: one subject in ORG, teacher-1 is staff, student-1 is a member. */
  const build = () => {
    const prisma = {
      subject: {
        findFirst: jest.fn().mockImplementation(({ where }) =>
          where.id === SUBJECT_ID && where.organizationId === ORG
            ? Promise.resolve({ id: SUBJECT_ID, courseId: 'cohort-1', status: 'PUBLISHED', organizationId: ORG, course: { organizationId: ORG } })
            : Promise.resolve(null)),
      },
      subjectStaff: {
        findUnique: jest.fn().mockImplementation(({ where }) =>
          Promise.resolve(where.subjectId_userId.userId === TEACHER.userId ? { role: 'TEACHER' } : null)),
      },
      courseMembership: {
        findUnique: jest.fn().mockImplementation(({ where }) =>
          Promise.resolve(where.courseId_userId.userId === STUDENT.userId ? { id: 'm1' } : null)),
      },
    };
    const enrollments = {
      findLessonSubjectId: jest.fn().mockResolvedValue({ subjectId: SUBJECT_ID }),
      uncompleteLesson: jest.fn().mockResolvedValue({ completed: false, progress: 0 }),
      getSubjectLessonProgress: jest.fn().mockResolvedValue([{ userId: 'student-1', completedLessonIds: ['l1'] }]),
    };
    const access = new CourseAccessService(prisma as never);
    return { enrollments, controller: new EnrollmentsController(enrollments as never, access) };
  };

  it('lets subject staff read per-student lesson progress', async () => {
    const { controller, enrollments } = build();
    await expect(controller.getLessonProgress(SUBJECT_ID, TEACHER)).resolves.toEqual([
      { userId: 'student-1', completedLessonIds: ['l1'] },
    ]);
    expect(enrollments.getSubjectLessonProgress).toHaveBeenCalledWith(SUBJECT_ID, ORG);
  });

  it('lets an org admin read per-student lesson progress without a staff row', async () => {
    const { controller } = build();
    await expect(
      controller.getLessonProgress(SUBJECT_ID, { ...ASSISTANT, userId: 'admin-1', role: 'ADMIN' }),
    ).resolves.toHaveLength(1);
  });

  it('rejects a student reading per-student lesson progress with 403', async () => {
    const { controller, enrollments } = build();
    await expect(controller.getLessonProgress(SUBJECT_ID, STUDENT)).rejects.toBeInstanceOf(ForbiddenException);
    expect(enrollments.getSubjectLessonProgress).not.toHaveBeenCalled();
  });

  it('answers 404 for a subject of another organization', async () => {
    const { controller, enrollments } = build();
    await expect(controller.getLessonProgress(SUBJECT_ID, OTHER_ORG_USER)).rejects.toBeInstanceOf(NotFoundException);
    expect(enrollments.getSubjectLessonProgress).not.toHaveBeenCalled();
  });

  it('unmarks only the caller completion after the readability check', async () => {
    const { controller, enrollments } = build();
    await expect(controller.uncompleteLesson('lesson-1', STUDENT)).resolves.toEqual({ completed: false, progress: 0 });
    expect(enrollments.uncompleteLesson).toHaveBeenCalledWith('lesson-1', ORG, STUDENT.userId);
  });

  it('rejects unmarking a lesson of a subject the caller cannot read', async () => {
    const { controller, enrollments } = build();
    const outsider: AuthUser = { ...STUDENT, userId: 'outsider-1' };
    await expect(controller.uncompleteLesson('lesson-1', outsider)).rejects.toBeInstanceOf(ForbiddenException);
    expect(enrollments.uncompleteLesson).not.toHaveBeenCalled();
  });
});
