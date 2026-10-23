import type { AuthUser } from '@/common/auth';
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
