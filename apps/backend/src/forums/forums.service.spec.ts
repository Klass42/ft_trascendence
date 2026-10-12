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
          if (userId === STUDENT)
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
          where.id === TEACHER
            ? { name: 'Diego Fernández' }
            : where.id === STUDENT
              ? { name: 'Lucía Molina' }
              : null,
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
          threads.find((t) => t.id === where.id) ?? null,
      },
      forumPost: {
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
    const notifications = {
      emit: async (userId: string, type: NotificationType) => {
        emitted.push({ userId, type });
        return { id: 'n-1' };
      },
    } as unknown as NotificationsService;

    const service = new ForumsService(prisma, notifications, accessFromPrisma(prisma));

    // Student opens a thread with an opening post.
    const thread = await service.createThread(COURSE_ID, STUDENT, {
      title: '¿Cómo centro un div?',
      body: 'Llevo horas peleándome con flexbox.',
    });
    expect(thread.authorId).toBe(STUDENT);
    // Creating a thread notifies nobody (the only relevant user is the author).
    expect(emitted).toHaveLength(0);

    // Teacher replies to the thread.
    const reply = await service.addPost(thread.id, TEACHER, {
      body: 'Usa `justify-content: center; align-items: center`.',
    });
    expect(reply.authorId).toBe(TEACHER);

    // Exactly one notification, to the student (thread author), FORUM_REPLY.
    expect(emitted).toHaveLength(1);
    expect(emitted[0].userId).toBe(STUDENT);
    expect(emitted[0].type).toBe(NotificationType.FORUM_REPLY);

    // The student replying to their own thread must not notify themselves.
    await service.addPost(thread.id, STUDENT, { body: '¡Gracias, funcionó!' });
    expect(emitted).toHaveLength(1);
  });
});
