import type { AuthUser } from '@/common/auth';
import { CourseRole } from '@prisma/client';
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

const COURSE_ID = 'course-1';

describe('course-content controller authorization', () => {
  it('authorizes a course assistant to create a section through course access', async () => {
    const sections = { create: jest.fn().mockResolvedValue({ id: 'section-1' }) };
    const access = { assertStaff: jest.fn().mockResolvedValue({ id: COURSE_ID }) };
    const controller = new SectionsController(sections as never, access as never);

    await controller.create(COURSE_ID, ASSISTANT, { title: 'Week 1' });

    expect(access.assertStaff).toHaveBeenCalledWith(COURSE_ID, ASSISTANT);
    expect(sections.create).toHaveBeenCalledWith(COURSE_ID, ASSISTANT.organizationId, {
      title: 'Week 1',
    });
  });

  it('checks course readability before exposing section lessons', async () => {
    const lessons = {
      findSectionCourseId: jest.fn().mockResolvedValue({ courseId: COURSE_ID }),
      findAll: jest.fn().mockResolvedValue([]),
    };
    const access = { assertReadable: jest.fn().mockResolvedValue({ id: COURSE_ID }) };
    const controller = new LessonsController(lessons as never, access as never);

    await controller.findAll('section-1', ASSISTANT);

    expect(access.assertReadable).toHaveBeenCalledWith(COURSE_ID, ASSISTANT);
    expect(lessons.findAll).toHaveBeenCalledWith('section-1', ASSISTANT.organizationId);
  });
});

describe('enrollment controller authorization', () => {
  it('uses the owning course to authorize roster role changes', async () => {
    const enrollments = {
      findEnrollmentCourseId: jest.fn().mockResolvedValue(COURSE_ID),
      updateRole: jest.fn().mockResolvedValue({ id: 'enrollment-1', role: 'STUDENT' }),
    };
    const access = { assertStaff: jest.fn().mockResolvedValue({ id: COURSE_ID }) };
    const controller = new EnrollmentsController(enrollments as never, access as never);

    await controller.updateRole('enrollment-1', { role: CourseRole.STUDENT }, ASSISTANT);

    expect(access.assertStaff).toHaveBeenCalledWith(COURSE_ID, ASSISTANT);
    expect(enrollments.updateRole).toHaveBeenCalledWith('enrollment-1', ASSISTANT.organizationId, {
      role: 'STUDENT',
    });
  });

  it('checks a lesson course is readable before completing it', async () => {
    const enrollments = {
      findLessonCourseId: jest.fn().mockResolvedValue({ courseId: COURSE_ID }),
      completeLesson: jest.fn().mockResolvedValue({ completed: true, progress: 10 }),
    };
    const access = { assertReadable: jest.fn().mockResolvedValue({ id: COURSE_ID }) };
    const controller = new EnrollmentsController(enrollments as never, access as never);

    await controller.completeLesson('lesson-1', ASSISTANT);

    expect(access.assertReadable).toHaveBeenCalledWith(COURSE_ID, ASSISTANT);
    expect(enrollments.completeLesson).toHaveBeenCalledWith(
      'lesson-1',
      ASSISTANT.organizationId,
      ASSISTANT.userId,
    );
  });
});
