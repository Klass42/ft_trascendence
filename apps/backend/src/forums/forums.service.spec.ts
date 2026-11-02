import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { NotificationType } from '@prisma/client';
import { ForumsService } from './forums.service';
import { accessFromPrisma } from '../test/access-from-prisma';
import type { PrismaService } from '../prisma/prisma.service';
import type { NotificationsService } from '../notifications/notifications.service';

/**
 * Happy-path test of the forum flow: a student opens a thread, the teacher
 * replies, and the thread author (the student) — but not the replying teacher
 * — receives a FORUM_REPLY notification. Uses a tiny in-memory Prisma fake so
 * it runs without a database.
 */
describe('ForumsService', () => {
  const COURSE_ID = 'course-web-101';
  const ORG_ID = 'org-klass-0001';
  const STUDENT = 'user-lucia-001';
  const TEACHER = 'user-diego-001';
  const OTHER_STUDENT = 'user-sam-002';
  const OUTSIDER = 'user-student-outsider'; // same org, not enrolled in the course
  const OTHER_ORG = 'user-student-otherorg'; // belongs to another tenant
  const ADMIN = 'user-admin-001'; // org admin, neither staff nor enrolled

  function buildPrismaFake() {
    const threads: Array<Record<string, any>> = [];
    const posts: Array<Record<string, any>> = [];
    let seq = 0;

    return {
      course: {
        findUnique: async ({ where }: any) =>
          where.id === COURSE_ID
            ? { id: COURSE_ID, organizationId: ORG_ID }
            : null,
      },
      enrollment: {
        findUnique: async ({ where }: any) => {
          const { courseId, userId } = where.courseId_userId;
          if (courseId !== COURSE_ID) return null;
          if (userId === STUDENT || userId === OTHER_STUDENT || userId === OTHER_ORG)
            return { courseId, userId, role: 'STUDENT' as never };
          if (userId === TEACHER)
            return { courseId, userId, role: 'TEACHER' as never };
          return null;
        },
        findMany: async () => [
          { userId: STUDENT, role: 'STUDENT' as never },
          { userId: TEACHER, role: 'TEACHER' as never },
        ],
      },
      user: {
        findUnique: async ({ where }: any) =>
          where.id === OTHER_ORG
            ? { name: 'Otra Org', organizationId: 'org-other-0002' }
            : where.id === TEACHER
            ? { name: 'Diego Fernández' }
            : where.id === STUDENT
              ? { name: 'Lucía Molina' }
              : null,
      },
      subject: {
        findFirst: async ({ where }: any) =>
          where.id === COURSE_ID ? { id: COURSE_ID, organizationId: ORG_ID } : null,
      },
      subjectStaff: {
        findMany: async () => [{ userId: TEACHER }],
      },
      forumThread: {
        create: async ({ data }: any) => {
          seq += 1;
          const thread = {
            id: `thread-${seq}`,
            subjectId: data.subjectId,
            authorId: data.authorId,
            title: data.title,
            pinned: false,
            createdAt: new Date(0),
          };
          threads.push(thread);
          if (data.posts?.create) {
            seq += 1;
            posts.push({
              id: `post-${seq}`,
              threadId: thread.id,
              authorId: data.posts.create.authorId,
              parentId: null,
              body: data.posts.create.body,
              createdAt: new Date(0),
            });
          }
          return { ...thread, author: null, _count: { posts: 0 } };
        },
        findUnique: async ({ where }: any) =>
          (() => {
            const thread = threads.find((t) => t.id === where.id);
            // Prisma returns a record snapshot; don't expose the mutable fake row.
            return thread ? { ...thread } : null;
          })(),
        update: async ({ where, data }: any) => {
          const thread = threads.find((t) => t.id === where.id);
          if (!thread) return null;
          Object.assign(thread, data);
          return { ...thread, author: null, _count: { posts: 0 } };
        },
        delete: async ({ where }: any) => {
          const index = threads.findIndex((t) => t.id === where.id);
          if (index >= 0) threads.splice(index, 1);
        },
      },
      forumPost: {
        findUnique: async ({ where }: any) => {
          const post = posts.find((p) => p.id === where.id);
          return post ? { ...post } : null;
        },
        update: async ({ where, data }: any) => {
          const post = posts.find((p) => p.id === where.id);
          if (!post) return null;
          Object.assign(post, data);
          return { ...post };
        },
        delete: async ({ where }: any) => {
          // Mirror the schema's onDelete: Cascade for nested replies.
          const doomed = new Set([where.id]);
          for (let grew = true; grew; ) {
            grew = false;
            for (const p of posts) {
              if (p.parentId && doomed.has(p.parentId) && !doomed.has(p.id)) {
                doomed.add(p.id);
                grew = true;
              }
            }
          }
          for (let i = posts.length - 1; i >= 0; i--) {
            if (doomed.has(posts[i].id)) posts.splice(i, 1);
          }
        },
        findMany: async ({ where }: any) =>
          posts.filter((p) => p.threadId === where.threadId).map((p) => ({ ...p, author: null })),
        count: async ({ where }: any) =>
          posts.filter((p) =>
            where.parentId !== undefined
              ? p.parentId === where.parentId
              : p.threadId === where.threadId && (p.authorId == null || p.authorId !== where.OR[1].authorId.not),
          ).length,
        findFirst: async ({ where }: any) =>
          posts.find(
            (p) => p.id === where.id && p.threadId === where.threadId,
          ) ?? null,
        create: async ({ data }: any) => {
          seq += 1;
          const post = {
            id: `post-${seq}`,
            threadId: data.threadId,
            authorId: data.authorId,
            parentId: data.parentId ?? null,
            body: data.body,
            createdAt: new Date(0),
            author: null,
          };
          posts.push(post);
          return post;
        },
      },
    } as unknown as PrismaService;
  }

  it('a teacher reply notifies the thread author, not the replier', async () => {
    const prisma = buildPrismaFake();
    const emitted: Array<{ userId: string; type: NotificationType }> = [];
    const emitMany = jest.fn(async (loader: any, type: NotificationType) => {
      const userIds = typeof loader === 'function' ? await loader() : loader;
      for (const userId of userIds) emitted.push({ userId, type });
    });
    const notifications = {
      emitMany,
    } as unknown as NotificationsService;

    const service = new ForumsService(prisma, notifications, accessFromPrisma(prisma));

    // Student opens a thread with an opening post.
    const thread = await service.createThread(COURSE_ID, STUDENT, {
      title: '¿Cómo centro un div?',
      body: 'Llevo horas peleándome con flexbox.',
    });
    expect(thread.authorId).toBe(STUDENT);
    // A new thread reaches subject staff, never its student author.
    expect(emitted).toEqual([{ userId: TEACHER, type: NotificationType.FORUM_THREAD }]);

    // Teacher replies to the thread.
    const reply = await service.addPost(thread.id, TEACHER, {
      body: 'Usa `justify-content: center; align-items: center`.',
    });
    expect(reply.authorId).toBe(TEACHER);

    // Exactly one notification, to the student (thread author), FORUM_REPLY.
    expect(emitted).toHaveLength(2);
    expect(emitted[1].userId).toBe(STUDENT);
    expect(emitted[1].type).toBe(NotificationType.FORUM_REPLY);

    // The student replying to their own thread must not notify themselves.
    await service.addPost(thread.id, STUDENT, { body: '¡Gracias, funcionó!' });
    expect(emitted).toHaveLength(2);
  });

  it('notifies a thread author when their thread is pinned or deleted', async () => {
    const prisma = buildPrismaFake();
    const emitted: Array<{ userId: string; type: NotificationType }> = [];
    const emitMany = jest.fn(async (loader: any, type: NotificationType) => {
      const userIds = typeof loader === 'function' ? await loader() : loader;
      for (const userId of userIds) emitted.push({ userId, type });
    });
    const removeByLink = jest.fn(async () => 0);
    const notifications = {
      emitMany,
      removeByLink,
    } as unknown as NotificationsService;
    const service = new ForumsService(prisma, notifications, accessFromPrisma(prisma));
    const thread = await service.createThread(COURSE_ID, STUDENT, { title: 'Pregunta para el profesor' });
    emitted.length = 0;
    emitMany.mockClear();

    await service.togglePin(thread.id, TEACHER);
    await service.deleteThread(thread.id, TEACHER);

    // Notices linking to the deleted thread are removed, scoped to its organization.
    expect(removeByLink).toHaveBeenCalledWith(expect.any(String), { equals: [`/forums/${thread.id}`] });

    expect(emitMany.mock.calls.map(([recipients]) => recipients)).toEqual([
      [STUDENT],
      [STUDENT],
    ]);
    expect(emitted).toEqual([
      { userId: STUDENT, type: NotificationType.FORUM_THREAD },
      { userId: STUDENT, type: NotificationType.FORUM_THREAD },
    ]);
  });
  describe('editing and moderation', () => {
    function setup() {
      const prisma = buildPrismaFake();
      const emitMany = jest.fn(async () => undefined);
      const removeByLink = jest.fn(async () => 0);
      const notifications = { emitMany, removeByLink } as unknown as NotificationsService;
      const service = new ForumsService(prisma, notifications, accessFromPrisma(prisma));
      return { service, emitMany, removeByLink };
    }

    async function threadWithReplies() {
      const ctx = setup();
      const thread = await ctx.service.createThread(COURSE_ID, STUDENT, {
        title: 'Duda',
        body: 'Mensaje inicial',
      });
      const reply = await ctx.service.addPost(thread.id, OTHER_STUDENT, { body: 'Respuesta' });
      const nested = await ctx.service.addPost(thread.id, STUDENT, { body: 'Anidada', parentId: reply.id });
      ctx.emitMany.mockClear();
      return { ...ctx, thread, reply, nested };
    }

    it('lets the author edit their own post and trims the body', async () => {
      const { service, reply } = await threadWithReplies();
      const updated = await service.updatePost(reply.id, OTHER_STUDENT, { body: '  Corregido  ' });
      expect(updated.body).toBe('Corregido');
    });

    it.each([
      ['another student', OTHER_STUDENT, 'student'],
      ['the subject teacher', TEACHER, 'teacher'],
      ['an org admin', ADMIN, 'admin'],
    ])('does not let %s edit a post they did not write', async (_label, actor) => {
      const { service, nested } = await threadWithReplies();
      await expect(service.updatePost(nested.id, actor, { body: 'Reescrito' })).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('lets subject staff and an org admin delete a post with its replies', async () => {
      for (const actor of [TEACHER, ADMIN]) {
        const { service, reply, thread } = await threadWithReplies();
        await service.deletePost(reply.id, actor);
        const after = await service.getThread(thread.id, STUDENT);
        // The opening post remains; the deleted reply and its nested answer are gone.
        expect(after.posts.map((p: any) => p.body)).toEqual(['Mensaje inicial']);
      }
    });

    it('lets the author delete their own post only while it has no replies', async () => {
      const { service, reply, nested, thread } = await threadWithReplies();
      await expect(service.deletePost(reply.id, OTHER_STUDENT)).rejects.toBeInstanceOf(ConflictException);
      await service.deletePost(nested.id, STUDENT);
      await service.deletePost(reply.id, OTHER_STUDENT);
      const after = await service.getThread(thread.id, STUDENT);
      expect(after.posts.map((p: any) => p.body)).toEqual(['Mensaje inicial']);
    });

    it('rejects deleting a post for another student, an unenrolled user and another tenant', async () => {
      const { service, nested } = await threadWithReplies();
      await expect(service.deletePost(nested.id, OTHER_STUDENT)).rejects.toBeInstanceOf(ForbiddenException);
      await expect(service.deletePost(nested.id, OUTSIDER)).rejects.toBeInstanceOf(ForbiddenException);
      await expect(service.deletePost(nested.id, OTHER_ORG)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('returns 404 for a missing post and hides posts from other tenants on edit', async () => {
      const { service, nested } = await threadWithReplies();
      await expect(service.deletePost('post-missing', STUDENT)).rejects.toBeInstanceOf(NotFoundException);
      await expect(service.updatePost('post-missing', STUDENT, { body: 'x' })).rejects.toBeInstanceOf(NotFoundException);
      await expect(service.updatePost(nested.id, OTHER_ORG, { body: 'x' })).rejects.toBeInstanceOf(NotFoundException);
    });

    it('deleting a post tells the thread participants but keeps thread-level links', async () => {
      const { service, reply, emitMany, removeByLink } = await threadWithReplies();
      await service.deletePost(reply.id, TEACHER);
      expect(emitMany).toHaveBeenCalledTimes(1);
      const [recipients, type, payload, options] = emitMany.mock.calls[0] as any[];
      expect(new Set(recipients)).toEqual(new Set([STUDENT, OTHER_STUDENT]));
      expect(type).toBe(NotificationType.FORUM_REPLY);
      expect(payload.link).toMatch(/^\/forums\/thread-/);
      expect(options.actorId).toBe(TEACHER);
      expect(removeByLink).not.toHaveBeenCalled();
    });

    it('notifies participants (not the actor) when a post is edited or a thread is renamed', async () => {
      const { service, reply, thread, emitMany } = await threadWithReplies();

      await service.updatePost(reply.id, OTHER_STUDENT, { body: 'Corregido' });
      let [loader, type, payload, options] = emitMany.mock.calls.at(-1) as any[];
      expect(new Set(await loader())).toEqual(new Set([STUDENT, OTHER_STUDENT]));
      expect(type).toBe(NotificationType.FORUM_REPLY);
      expect(payload.link).toBe(`/forums/${thread.id}`);
      expect(options).toEqual({ organizationId: ORG_ID, actorId: OTHER_STUDENT });

      emitMany.mockClear();
      await service.updatePost(reply.id, OTHER_STUDENT, { body: 'Corregido' });
      expect(emitMany).not.toHaveBeenCalled(); // unchanged body: nothing to announce

      await service.updateThread(thread.id, STUDENT, { title: 'Duda resuelta' });
      [loader, type, payload, options] = emitMany.mock.calls.at(-1) as any[];
      expect(new Set(await loader())).toEqual(new Set([STUDENT, OTHER_STUDENT, TEACHER])); // + subject staff
      expect(type).toBe(NotificationType.FORUM_THREAD);
      expect(options).toEqual({ organizationId: ORG_ID, actorId: STUDENT });
    });

    it('lets only the author rename a thread', async () => {
      const { service, thread } = await threadWithReplies();
      const updated = await service.updateThread(thread.id, STUDENT, { title: '  Duda resuelta ' });
      expect(updated.title).toBe('Duda resuelta');
      for (const actor of [OTHER_STUDENT, TEACHER, ADMIN]) {
        await expect(service.updateThread(thread.id, actor, { title: 'Otro' })).rejects.toBeInstanceOf(ForbiddenException);
      }
      await expect(service.updateThread(thread.id, OTHER_ORG, { title: 'Otro' })).rejects.toBeInstanceOf(NotFoundException);
      await expect(service.updateThread('thread-missing', STUDENT, { title: 'Otro' })).rejects.toBeInstanceOf(NotFoundException);
    });

    it('deletes a thread for staff and admins, and for its author only while nobody else posted', async () => {
      const { service, thread } = await threadWithReplies();
      await expect(service.deleteThread(thread.id, OTHER_STUDENT)).rejects.toBeInstanceOf(ForbiddenException);
      await expect(service.deleteThread(thread.id, STUDENT)).rejects.toBeInstanceOf(ConflictException);
      await expect(service.deleteThread(thread.id, OTHER_ORG)).rejects.toBeInstanceOf(NotFoundException);
      await service.deleteThread(thread.id, ADMIN);
      await expect(service.getThread(thread.id, STUDENT)).rejects.toBeInstanceOf(NotFoundException);

      const solo = await service.createThread(COURSE_ID, STUDENT, { title: 'Sola', body: 'Nadie respondió' });
      await service.deleteThread(solo.id, STUDENT);
      await expect(service.getThread(solo.id, STUDENT)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('flags who can moderate when loading a thread', async () => {
      const { service, thread } = await threadWithReplies();
      expect((await service.getThread(thread.id, STUDENT)).canModerate).toBe(false);
      expect((await service.getThread(thread.id, TEACHER)).canModerate).toBe(true);
      expect((await service.getThread(thread.id, ADMIN)).canModerate).toBe(true);
    });
  });
});
