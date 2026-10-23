import { Logger } from '@nestjs/common';
import { NotificationType } from '@prisma/client';
import type { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from './notifications.service';
import { ActivitiesService } from '../activities/activities.service';
import { AssignmentsService } from '../assignments/assignments.service';
import { CoursesService } from '../courses/courses.service';
import { SectionsService } from '../courses/sections/sections.service';
import { LessonsService } from '../courses/lessons/lessons.service';
import { ResourcesService } from '../resources/resources.service';

const ORG_ID = 'org-one';
const ACTOR_ID = 'actor-admin';
const STUDENT_ID = 'student-one';
const TEACHER_ID = 'teacher-one';

function buildNotifications() {
  const created: Array<Record<string, any>> = [];
  const userQueries: any[] = [];
  const prisma = {
    user: {
      findMany: jest.fn(async ({ where }: any) => {
        userQueries.push(where);
        if (where.id?.in) {
          return where.id.in
            .filter((id: string) => [ACTOR_ID, STUDENT_ID, TEACHER_ID].includes(id))
            .map((id: string) => ({ id }));
        }
        if (where.role === 'ADMIN') return [{ id: ACTOR_ID }];
        if (where.role?.in) return [{ id: ACTOR_ID }, { id: TEACHER_ID }];
        return [];
      }),
    },
    notification: {
      create: jest.fn(async ({ data }: any) => {
        const row = { id: `notification-${created.length + 1}`, ...data };
        created.push(row);
        return row;
      }),
    },
  } as unknown as PrismaService;
  const events = { emit: jest.fn() } as any;
  return { service: new NotificationsService(prisma, events), created, userQueries };
}

function subjectMemberships() {
  return [
    { userId: STUDENT_ID },
    { userId: STUDENT_ID },
    { userId: ACTOR_ID },
  ];
}

describe('notification emitters', () => {
  it('sends a published activity notification to enrolled students, without the actor or duplicates', async () => {
    const notifications = buildNotifications();
    const memberships = jest.fn(async () => subjectMemberships());
    const service = new ActivitiesService(
      { courseMembership: { findMany: memberships } } as unknown as PrismaService,
      {} as never,
      notifications.service,
    );

    await (service as any).notifyStudents(
      { id: 'subject-one', title: 'Desarrollo web', courseId: 'cohort-one', organizationId: ORG_ID },
      ACTOR_ID,
      NotificationType.ACTIVITY_PUBLISHED,
      'Nueva tarea publicada: Cuestionario en Desarrollo web',
      'activity-one',
    );

    expect(memberships).toHaveBeenCalledWith({
      where: {
        courseId: 'cohort-one',
        course: { organizationId: ORG_ID },
        user: { organizationId: ORG_ID, role: 'STUDENT' },
      },
      select: { userId: true },
    });
    expect(notifications.created).toHaveLength(1);
    expect(notifications.created[0]).toMatchObject({
      userId: STUDENT_ID,
      type: NotificationType.ACTIVITY_PUBLISHED,
      link: '/activities?subjectId=subject-one&activityId=activity-one',
    });
  });

  it('groups section, lesson, and attachment updates as one course-content notification per student', async () => {
    const notifications = buildNotifications();
    const prisma = {
      subject: {
        findFirst: jest.fn(async () => ({ id: 'subject-one', title: 'Desarrollo web', courseId: 'cohort-one', organizationId: ORG_ID, status: 'PUBLISHED' })),
      },
      lesson: {
        findFirst: jest.fn(async () => ({ sectionId: 'section-one' })),
      },
      section: {
        findFirst: jest.fn(async () => ({ subject: { id: 'subject-one', title: 'Desarrollo web', courseId: 'cohort-one', organizationId: ORG_ID, status: 'PUBLISHED' } })),
      },
      courseMembership: { findMany: jest.fn(async () => subjectMemberships()) },
    } as unknown as PrismaService;

    const sections = new SectionsService(prisma, notifications.service);
    const lessons = new LessonsService(prisma, notifications.service);
    await (sections as any).notifyContent('subject-one', ORG_ID, ACTOR_ID, 'Sección actualizada: HTML');
    await (lessons as any).notifyContent('lesson-one', ORG_ID, ACTOR_ID, 'Adjunto añadido a Introducción');

    expect(notifications.created).toHaveLength(2);
    expect(notifications.created.map((row) => row.userId)).toEqual([STUDENT_ID, STUDENT_ID]);
    expect(notifications.created.every((row) => row.type === NotificationType.COURSE_CONTENT_CHANGED)).toBe(true);
    expect(notifications.created.every((row) => row.link === '/courses/cohort-one/subjects/subject-one')).toBe(true);
  });

  it('notifies cohort members and assigned subject staff inside the tenant on cohort changes', async () => {
    const notifications = buildNotifications();
    const prisma = {
      courseMembership: { findMany: jest.fn(async () => [{ userId: STUDENT_ID }]) },
      subjectStaff: { findMany: jest.fn(async () => [{ userId: TEACHER_ID }]) },
      user: {
        findMany: jest.fn(async ({ where }: any) => where.role === 'ADMIN' ? [{ id: ACTOR_ID }] : []),
      },
    } as unknown as PrismaService;
    const service = new CoursesService(prisma, {} as never, notifications.service);

    await (service as any).notifyCourseUsers('cohort-one', ORG_ID, ACTOR_ID, 'Cohorte archivada: 1º A', '/courses');

    expect(notifications.created.map((row) => row.userId).sort()).toEqual([STUDENT_ID, TEACHER_ID]);
    expect(notifications.created.every((row) => row.type === NotificationType.COURSE_CHANGED)).toBe(true);
  });

  it('notifies only the affected user for a membership or teacher assignment change', async () => {
    const notifications = buildNotifications();
    const service = new CoursesService({} as PrismaService, {} as never, notifications.service);

    await (service as any).emitUsers(
      [STUDENT_ID, ACTOR_ID],
      ORG_ID,
      ACTOR_ID,
      'Te han matriculado en 1º A',
      '/courses',
      NotificationType.MEMBERSHIP_CHANGED,
    );

    expect(notifications.created).toHaveLength(1);
    expect(notifications.created[0]).toMatchObject({ userId: STUDENT_ID, type: NotificationType.MEMBERSHIP_CHANGED });
  });

  it('completes a cohort creation when notification persistence fails', async () => {
    const loggerError = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const notificationService = new NotificationsService(
      {
        user: { findMany: jest.fn(async ({ where }: any) => where.id?.in?.map((id: string) => ({ id })) ?? [{ id: 'other-admin' }]) },
        notification: { create: jest.fn(async () => { throw new Error('database unavailable'); }) },
      } as unknown as PrismaService,
      { emit: jest.fn() } as any,
    );
    const createdCourse = { id: 'cohort-one', organizationId: ORG_ID, name: '1º A' };
    const courseCreate = jest.fn(async () => createdCourse);
    const service = new CoursesService(
      {
        course: { create: courseCreate },
        user: { findMany: jest.fn(async () => [{ id: ACTOR_ID }, { id: 'other-admin' }]) },
      } as unknown as PrismaService,
      {} as never,
      notificationService,
    );

    await expect(service.create({
      name: '1º A',
      academicYear: '2026-2027',
      startsOn: '2026-09-01',
      endsOn: '2027-06-30',
    }, {
      userId: ACTOR_ID,
      email: 'admin@example.test',
      name: 'Admin',
      avatarUrl: null,
      organizationId: ORG_ID,
      role: 'ADMIN',
      emailNotificationsEnabled: true,
      preferredLanguage: 'es',
    })).resolves.toEqual(createdCourse);

    expect(courseCreate).toHaveBeenCalledTimes(1);
    expect(loggerError).toHaveBeenCalled();
    loggerError.mockRestore();
  });

  it('notifies shared-library staff and linked subject students with separate access checks', async () => {
    const notifications = buildNotifications();
    const prisma = {
      user: {
        findMany: jest.fn(async ({ where }: any) => {
          if (where.role?.in) return [{ id: ACTOR_ID }, { id: TEACHER_ID }];
          if (where.id?.in) return where.id.in.map((id: string) => ({ id }));
          return [];
        }),
      },
      courseMembership: { findMany: jest.fn(async () => [{ userId: STUDENT_ID }]) },
    } as unknown as PrismaService;
    const service = new ResourcesService(prisma, {} as never, notifications.service);

    await (service as any).notifyLibraryStaff(ORG_ID, ACTOR_ID, 'Nuevo recurso: Guía HTML');
    await (service as any).notifySubjectStudents(['subject-one'], ORG_ID, ACTOR_ID, 'Nuevo recurso en Desarrollo web: Guía HTML', '/resources');

    expect(notifications.created.map((row) => row.userId)).toEqual([TEACHER_ID, STUDENT_ID]);
    expect(notifications.created.every((row) => row.type === NotificationType.RESOURCE_CHANGED)).toBe(true);
    expect((prisma.courseMembership.findMany as jest.Mock).mock.calls[0][0].where.course.subjects.some).toMatchObject({
      id: { in: ['subject-one'] },
      organizationId: ORG_ID,
      status: 'PUBLISHED',
    });
  });

  it('notifies enrolled students on manual assignment creation without coupling it to staff recipients', async () => {
    const notifications = buildNotifications();
    const memberships = jest.fn(async () => subjectMemberships());
    const service = new AssignmentsService(
      { courseMembership: { findMany: memberships } } as unknown as PrismaService,
      {} as never,
      notifications.service,
    );

    await (service as any).notifyStudents(
      { id: 'subject-one', title: 'Desarrollo web', courseId: 'cohort-one', organizationId: ORG_ID },
      ACTOR_ID,
      NotificationType.ACTIVITY_PUBLISHED,
      'Nueva tarea publicada: Práctica 1 en Desarrollo web',
    );

    expect(notifications.created.map((row) => row.userId)).toEqual([STUDENT_ID]);
    expect(notifications.created[0].type).toBe(NotificationType.ACTIVITY_PUBLISHED);
  });
});
