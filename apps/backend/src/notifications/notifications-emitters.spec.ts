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
import { ResourceFoldersService } from '../resources/resource-folders.service';
import { TaskTemplatesService } from '../activities/templates/task-templates.service';
import { OrganizationsService } from '../organizations/organizations.service';
import { PlatformService } from '../platform/platform.service';
import { UsersService } from '../users/users.service';
import { AuthService } from '../auth/auth.service';

const ORG_ID = 'org-one';
const ACTOR_ID = 'actor-admin';
const STUDENT_ID = 'student-one';
const TEACHER_ID = 'teacher-one';

const SUPERADMIN_ID = 'superadmin-one';

function buildNotifications() {
  const created: Array<Record<string, any>> = [];
  const userQueries: any[] = [];
  const prisma = {
    user: {
      findMany: jest.fn(async ({ where }: any) => {
        userQueries.push(where);
        if (where.id?.in) {
          return where.id.in
            .filter((id: string) => [ACTOR_ID, STUDENT_ID, TEACHER_ID, SUPERADMIN_ID].includes(id))
            .map((id: string) => ({ id }));
        }
        if (where.platformRole === 'SUPERADMIN') return [{ id: SUPERADMIN_ID }, { id: ACTOR_ID }];
        if (where.role === 'ADMIN') return [{ id: ACTOR_ID }];
        if (where.role?.in) return [{ id: ACTOR_ID }, { id: TEACHER_ID }];
        return [];
      }),
    },
    notification: {
      findMany: jest.fn(async () => []),
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
        organization: { findUnique: jest.fn(async () => null) }, course: { create: courseCreate },
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

/**
 * "Every creation, update and deletion notifies" (#132): one case per emitter
 * added there. Each asserts the recipient set (actor excluded, tenant-checked)
 * and the notification type; the README coverage table mirrors this list.
 */
describe('C/U/D notification coverage', () => {
  const recipientsOf = (created: Array<Record<string, any>>) => created.map((row) => row.userId).sort();
  const authUser = (userId: string, role: 'ADMIN' | 'TEACHER' | 'STUDENT') => ({
    userId, email: `${userId}@example.test`, name: userId, avatarUrl: null, organizationId: ORG_ID,
    role, emailNotificationsEnabled: true, preferredLanguage: 'es',
  });

  describe('resource folders', () => {
    function folders(notifications: ReturnType<typeof buildNotifications>) {
      const folder = { id: 'folder-one', name: 'Apuntes', createdById: TEACHER_ID, organizationId: ORG_ID };
      const prisma = {
        user: (notifications.service as any).prisma.user,
        resourceFolder: {
          findFirst: jest.fn(async () => folder),
          create: jest.fn(async () => folder),
          update: jest.fn(async () => ({ ...folder, name: 'Apuntes 2' })),
        },
        learningResource: { updateMany: jest.fn() },
        subjectFolder: { upsert: jest.fn(async () => ({})), deleteMany: jest.fn(async () => ({ count: 1 })) },
        courseMembership: { findMany: jest.fn(async () => [{ userId: STUDENT_ID }, { userId: TEACHER_ID }]) },
        $transaction: jest.fn(async () => []),
      } as unknown as PrismaService;
      (prisma.resourceFolder as any).updateMany = jest.fn();
      (prisma.resourceFolder as any).delete = jest.fn();
      const subject = { id: 'subject-one', title: 'Desarrollo web', courseId: 'cohort-one', status: 'PUBLISHED' };
      const access = { assertSubjectStaff: jest.fn(async () => ({ subject })) };
      return new ResourceFoldersService(prisma, access as never, notifications.service);
    }

    it.each([
      ['create', (s: ResourceFoldersService, u: any) => s.create({ name: 'Apuntes' } as never, u)],
      ['update', (s: ResourceFoldersService, u: any) => s.update('folder-one', { name: 'Apuntes 2' } as never, u)],
      ['delete', (s: ResourceFoldersService, u: any) => s.remove('folder-one', u)],
      ['unpublish', (s: ResourceFoldersService, u: any) => s.removeFromSubject('folder-one', 'subject-one', u)],
    ])('%s notifies library staff but not the actor', async (_name, run) => {
      const notifications = buildNotifications();
      await run(folders(notifications), authUser(TEACHER_ID, 'TEACHER'));
      expect(recipientsOf(notifications.created)).toEqual([ACTOR_ID]);
      expect(notifications.created[0]).toMatchObject({ type: NotificationType.RESOURCE_CHANGED, link: '/resources' });
    });

    it('publishing also notifies the subject students, linking to the subject', async () => {
      const notifications = buildNotifications();
      await folders(notifications).publishToSubject('folder-one', { subjectId: 'subject-one' } as never, authUser(TEACHER_ID, 'TEACHER'));
      expect(recipientsOf(notifications.created)).toEqual([ACTOR_ID, STUDENT_ID].sort());
      expect(notifications.created.find((row) => row.userId === STUDENT_ID)).toMatchObject({
        link: '/courses/cohort-one/subjects/subject-one',
      });
    });
  });

  describe('task templates', () => {
    function templates(notifications: ReturnType<typeof buildNotifications>) {
      const template = { id: 'tpl-one', title: 'Plantilla', organizationId: ORG_ID, createdById: TEACHER_ID };
      const prisma = {
        user: {
          findUnique: jest.fn(async () => ({ id: TEACHER_ID, organizationId: ORG_ID, role: 'TEACHER' })),
          findMany: (notifications.service as any).prisma.user.findMany,
        },
        taskTemplate: {
          create: jest.fn(async () => template),
          findUnique: jest.fn(async () => template),
          update: jest.fn(async () => template),
          delete: jest.fn(async () => template),
        },
        activity: {
          findUnique: jest.fn(async () => ({ id: 'activity-one', title: 'Act', description: null, subjectId: 'subject-one', subject: { organizationId: ORG_ID }, questions: [] })),
        },
      } as unknown as PrismaService;
      const access = { assertSubjectStaffForUser: jest.fn() };
      return new TaskTemplatesService(prisma, access as never, notifications.service);
    }

    it.each([
      ['create', (s: TaskTemplatesService) => s.create(TEACHER_ID, { title: 'Plantilla', blocks: [] } as never)],
      ['update', (s: TaskTemplatesService) => s.update('tpl-one', TEACHER_ID, { title: 'Nueva' } as never)],
      ['delete', (s: TaskTemplatesService) => s.remove('tpl-one', TEACHER_ID)],
      ['saveFromActivity', (s: TaskTemplatesService) => s.saveFromActivity('activity-one', TEACHER_ID)],
    ])('%s notifies the other teachers and admins', async (_name, run) => {
      const notifications = buildNotifications();
      await run(templates(notifications));
      expect(recipientsOf(notifications.created)).toEqual([ACTOR_ID]);
      expect(notifications.created[0]).toMatchObject({ type: NotificationType.RESOURCE_CHANGED, link: '/activities' });
    });
  });

  describe('organization invitations', () => {
    function organizations(notifications: ReturnType<typeof buildNotifications>) {
      const prisma = {
        user: { findFirst: jest.fn(async () => null), findMany: (notifications.service as any).prisma.user.findMany },
        organizationInvitation: {
          findUnique: jest.fn(async () => null),
          findFirst: jest.fn(async () => ({ id: 'inv-1', email: 'a@b.test', role: 'STUDENT' })),
          upsert: jest.fn(async ({ create }: any) => ({ id: 'inv-1', ...create })),
          updateMany: jest.fn(async () => ({ count: 1 })),
        },
        organization: { findUnique: jest.fn(async () => ({ id: ORG_ID, name: 'Klass' })) },
        notification: { findMany: jest.fn(async () => [{ id: 'n1' }]), updateMany: jest.fn(), create: (notifications.service as any).prisma.notification.create },
        auditLog: { create: jest.fn() },
      } as unknown as PrismaService;
      return new OrganizationsService(prisma, notifications.service);
    }

    it.each([
      ['invite', (s: OrganizationsService) => s.invite(ORG_ID, TEACHER_ID, { email: 'a@b.test', role: 'STUDENT' })],
      ['resend', (s: OrganizationsService) => s.resendInvitation(ORG_ID, 'inv-1', TEACHER_ID)],
      ['import (one summary, not one per row)', (s: OrganizationsService) => s.importInvitations(ORG_ID, TEACHER_ID, 'email,role\na@b.test,STUDENT\nc@d.test,TEACHER')],
      ['revoke', (s: OrganizationsService) => s.revokeInvitation(ORG_ID, 'inv-1', TEACHER_ID)],
      ['cancel deletion request', (s: OrganizationsService) => s.cancelDeletionRequest(ORG_ID, { userId: TEACHER_ID })],
    ])('%s notifies the org admins once, not the actor', async (_name, run) => {
      const notifications = buildNotifications();
      await run(organizations(notifications));
      expect(recipientsOf(notifications.created)).toEqual([ACTOR_ID]);
      expect(notifications.created[0].type).toBe(NotificationType.ORGANIZATION_CHANGED);
    });
  });

  describe('platform', () => {
    it.each([
      ['createOrganization', (s: PlatformService) => s.createOrganization({ name: 'Nueva', slug: 'nueva', adminEmail: 'a@b.test' } as never, TEACHER_ID)],
      ['deleteOrganization', (s: PlatformService) => s.deleteOrganization('org-two', TEACHER_ID)],
      ['inviteAdmin', (s: PlatformService) => s.inviteAdmin('org-two', { email: 'a@b.test' } as never, TEACHER_ID)],
    ])('%s notifies the superadmins except the actor', async (_name, run) => {
      const notifications = buildNotifications();
      const org = { id: 'org-two', name: 'Nueva', slug: 'nueva' };
      const tx = {
        organization: { create: jest.fn(async () => org), delete: jest.fn() },
        organizationInvitation: { create: jest.fn(async () => ({ id: 'inv-1' })), upsert: jest.fn(async () => ({ id: 'inv-1', email: 'a@b.test', role: 'ADMIN', expiresAt: new Date() })) },
        auditLog: { create: jest.fn() },
        file: { findMany: jest.fn(async () => []) },
        learningResource: { deleteMany: jest.fn() },
      };
      const prisma = {
        user: (notifications.service as any).prisma.user,
        organization: { findUnique: jest.fn(async () => org) },
        organizationInvitation: { findFirst: jest.fn(async () => null) },
        $transaction: jest.fn(async (fn: any) => fn(tx)),
      } as unknown as PrismaService;
      (prisma.user as any).findFirst = jest.fn(async () => null);
      const service = new PlatformService(prisma, { deleteOrganizationObjects: jest.fn() } as never, notifications.service);
      await run(service);
      // Superadmin query returns [SUPERADMIN, ACTOR_ID]; the acting id is TEACHER_ID so only both listed ids remain.
      expect(recipientsOf(notifications.created)).toEqual([ACTOR_ID, SUPERADMIN_ID].sort());
      expect(notifications.created.every((row) => row.type === NotificationType.ORGANIZATION_CHANGED)).toBe(true);
      expect(notifications.created.every((row) => row.link.startsWith('/platform/organizations'))).toBe(true);
    });

    it('does not notify the superadmin who acted', async () => {
      const notifications = buildNotifications();
      const prisma = {
        user: (notifications.service as any).prisma.user,
        organization: { findUnique: jest.fn(async () => ({ id: 'org-two', name: 'Nueva', slug: 'nueva' })) },
        $transaction: jest.fn(async (fn: any) => fn({
          file: { findMany: jest.fn(async () => []) }, auditLog: { create: jest.fn() },
          learningResource: { deleteMany: jest.fn() }, organization: { delete: jest.fn() },
        })),
      } as unknown as PrismaService;
      const service = new PlatformService(prisma, { deleteOrganizationObjects: jest.fn() } as never, notifications.service);
      await service.deleteOrganization('org-two', SUPERADMIN_ID);
      expect(recipientsOf(notifications.created)).toEqual([ACTOR_ID]);
    });
  });

  describe('users', () => {
    function users(notifications: ReturnType<typeof buildNotifications>, extra: Record<string, unknown> = {}) {
      const baseUser = (notifications.service as any).prisma.user;
      const prisma = {
        user: {
          ...baseUser,
          update: jest.fn(async () => ({ id: TEACHER_ID, name: 'Profe', organizationId: ORG_ID })),
          findUnique: jest.fn(async () => ({ id: TEACHER_ID, name: 'Profe', organizationId: ORG_ID, role: 'TEACHER', passwordHash: null })),
          findFirst: jest.fn(async () => ({ id: TEACHER_ID, name: 'Profe' })),
          updateMany: jest.fn(async () => ({ count: 1 })),
          delete: jest.fn(),
        },
        friendship: {
          findMany: jest.fn(async () => [
            { requesterId: TEACHER_ID, addresseeId: STUDENT_ID },
            { requesterId: ACTOR_ID, addresseeId: TEACHER_ID },
          ]),
        },
        auditLog: { create: jest.fn() },
        ...extra,
      } as unknown as PrismaService;
      return new UsersService(prisma, notifications.service, { createUpload: jest.fn(async () => ({ id: 'file-1' })), getSignedUrl: jest.fn(async () => ({ url: '/x' })) } as never);
    }

    it('updateProfile (name/bio) notifies org admins, not the actor; preferences alone do not', async () => {
      const notifications = buildNotifications();
      const service = users(notifications);
      await service.updateProfile(TEACHER_ID, { name: 'Profe' } as never);
      expect(recipientsOf(notifications.created)).toEqual([ACTOR_ID]);
      expect(notifications.created[0]).toMatchObject({ type: NotificationType.USER_CHANGED, link: `/admin/users/${TEACHER_ID}` });
      notifications.created.length = 0;
      await service.updateProfile(TEACHER_ID, { preferredLanguage: 'en' } as never);
      expect(notifications.created).toHaveLength(0);
    });

    it('deleteOwnAccount notifies the org admins', async () => {
      const notifications = buildNotifications();
      await users(notifications).deleteOwnAccount(TEACHER_ID, {} as never);
      expect(recipientsOf(notifications.created)).toEqual([ACTOR_ID]);
      expect(notifications.created[0].link).toBe('/admin/users');
    });

    it('avatar upload and removal notify the accepted friends, not the actor', async () => {
      const notifications = buildNotifications();
      const service = users(notifications);
      const user = authUser(TEACHER_ID, 'TEACHER');
      await service.uploadAvatar(user, { size: 1 } as Express.Multer.File);
      await service.removeAvatar(user);
      expect(recipientsOf(notifications.created)).toEqual([ACTOR_ID, ACTOR_ID, STUDENT_ID, STUDENT_ID].sort());
      expect(notifications.created.every((row) => row.type === NotificationType.FRIEND_REQUEST && row.link === '/friends')).toBe(true);
    });
  });

  describe('auth', () => {
    function auth(notifications: ReturnType<typeof buildNotifications>, prismaExtra: Record<string, any>) {
      const prisma = { user: { ...(notifications.service as any).prisma.user, ...prismaExtra.user }, ...prismaExtra.rest } as unknown as PrismaService;
      const jwt = { sign: jest.fn(() => 'token'), verify: jest.fn() } as any;
      const config = { getOrThrow: jest.fn(() => 'secret') } as any;
      const service = new AuthService(prisma, jwt, config, notifications.service);
      (service as any).issueTokens = jest.fn(async () => ({ accessToken: 'a', refreshToken: 'r' }));
      return { service, jwt };
    }

    it('register notifies the org admins', async () => {
      const notifications = buildNotifications();
      const log = jest.spyOn(console, 'log').mockImplementation(() => undefined);
      const { service } = auth(notifications, {
        user: {
          findFirst: jest.fn(async () => null),
          create: jest.fn(async ({ data }: any) => ({ id: STUDENT_ID, platformRole: 'NONE', avatarUrl: null, emailNotificationsEnabled: true, preferredLanguage: 'es', ...data })),
          count: jest.fn(async () => 0),
        },
        rest: { organization: { findUnique: jest.fn(async () => ({ id: ORG_ID, status: 'ACTIVE', maxUsers: null, plan: 'FREE' })) } },
      });
      await service.register({ organizationSlug: 'klass', email: 'n@example.test', name: 'Nuevo', password: 'demo1234' } as never);
      log.mockRestore();
      expect(recipientsOf(notifications.created)).toEqual([ACTOR_ID]);
      expect(notifications.created[0]).toMatchObject({ type: NotificationType.USER_CHANGED, link: `/admin/users/${STUDENT_ID}` });
    });

    it('changePassword and resetPassword warn the account owner themself', async () => {
      const argon2 = await import('argon2');
      const passwordHash = await argon2.hash('old-pass-1');
      const notifications = buildNotifications();
      const { service, jwt } = auth(notifications, {
        user: {
          findUnique: jest.fn(async () => ({ id: STUDENT_ID, organizationId: ORG_ID, passwordHash })),
          update: jest.fn(),
        },
        rest: { session: { deleteMany: jest.fn() }, auditLog: { create: jest.fn() } },
      });
      await service.changePassword(STUDENT_ID, { currentPassword: 'old-pass-1', newPassword: 'new-pass-22' } as never);
      jwt.verify.mockReturnValue({ sub: STUDENT_ID, purpose: 'password-reset', fp: (service as any).passwordFingerprint(passwordHash) });
      await service.resetPassword('token', 'new-pass-333');
      expect(recipientsOf(notifications.created)).toEqual([STUDENT_ID, STUDENT_ID]);
      expect(notifications.created.every((row) => row.type === NotificationType.USER_CHANGED && row.link === '/profile')).toBe(true);
    });
  });
});
