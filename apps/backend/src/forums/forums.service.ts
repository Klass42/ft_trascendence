import {
  ConflictException,
  ForbiddenException,
  Logger,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ForumThread,
  NotificationType,
  SubjectStaffRole,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CourseAccessService } from '../courses/course-access.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateThreadDto } from './dto/create-thread.dto';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { UpdateThreadDto } from './dto/update-thread.dto';

/** Minimal author projection embedded in thread/post responses. */
const AUTHOR_SELECT = {
  id: true,
  name: true,
  avatarUrl: true,
} as const;

@Injectable()
export class ForumsService {
  private readonly logger = new Logger(ForumsService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly access: CourseAccessService,
  ) {}

  // ---------------------------------------------------------------------------
  // Membership gates
  //
  // TODO: extraer helper de membership compartido — this duplicates
  // AssignmentsService.requireCourseMembership on purpose so ForumsModule stays
  // decoupled from AssignmentsModule. Consolidate once the auth pass lands.
  // ---------------------------------------------------------------------------

  private async requireSubject(
    subjectId: string,
    actingUserId: string,
    staffOnly = false,
  ) {
    return staffOnly
      ? this.access.assertSubjectStaffForUser(subjectId, actingUserId)
      : this.access.assertSubjectReadableForUser(subjectId, actingUserId);
  }

  private async requireThreadMembership(
    threadId: string,
    actingUserId: string,
    staffOnly = false,
  ) {
    const thread = await this.prisma.forumThread.findUnique({
      where: { id: threadId },
    });
    if (!thread) {
      throw new NotFoundException('Hilo no encontrado.');
    }
    const access = await this.requireSubject(thread.subjectId, actingUserId, staffOnly);
    return { thread, access };
  }

  /**
   * Load a post and gate on its thread's subject. A post of another tenant is
   * indistinguishable from a missing one (404), as with threads.
   */
  private async requirePostMembership(postId: string, actingUserId: string) {
    const post = await this.prisma.forumPost.findUnique({ where: { id: postId } });
    if (!post) {
      throw new NotFoundException('Mensaje no encontrado.');
    }
    const { thread, access } = await this.requireThreadMembership(post.threadId, actingUserId);
    return { post, thread, access };
  }

  // ---------------------------------------------------------------------------
  // Threads
  // ---------------------------------------------------------------------------

  /** List a course's threads, pinned first then newest, for any member. */
  async listThreads(subjectId: string, actingUserId: string) {
    await this.requireSubject(subjectId, actingUserId);

    return this.prisma.forumThread.findMany({
      where: { subjectId },
      orderBy: [{ pinned: 'desc' }, { createdAt: 'desc' }],
      include: {
        author: { select: AUTHOR_SELECT },
        _count: { select: { posts: true } },
      },
    });
  }

  /**
   * Create a thread (any course member). When `body` is supplied it becomes the
   * thread's opening root post authored by the creator.
   */
  async createThread(
    subjectId: string,
    actingUserId: string,
    dto: CreateThreadDto,
  ) {
    const access = await this.requireSubject(subjectId, actingUserId);

    const body = dto.body?.trim();

    const thread = await this.prisma.forumThread.create({
      data: {
        subjectId,
        authorId: actingUserId,
        title: dto.title,
        ...(body && {
          posts: {
            create: { authorId: actingUserId, body },
          },
        }),
      },
      include: {
        author: { select: AUTHOR_SELECT },
        _count: { select: { posts: true } },
      },
    });
    await this.notifyNewThread(thread, access.subject.organizationId, actingUserId);
    return thread;
  }

  /** A thread with its posts nested into a reply tree, scoped to a member. */
  async getThread(threadId: string, actingUserId: string) {
    const { thread: known, access } = await this.requireThreadMembership(
      threadId,
      actingUserId,
    );

    const [thread, posts, staff] = await Promise.all([
      this.prisma.forumThread.findUnique({
        where: { id: threadId },
        include: { author: { select: AUTHOR_SELECT } },
      }),
      this.prisma.forumPost.findMany({
        where: { threadId },
        orderBy: { createdAt: 'asc' },
        include: { author: { select: AUTHOR_SELECT } },
      }),
      this.prisma.subjectStaff.findMany({
        where: { subjectId: known.subjectId },
        select: { userId: true, role: true },
      }),
    ]);

    const roleByUser = new Map(staff.map((member) => [member.userId, member.role]));

    return {
      ...thread,
      // Lets the client show moderation actions without guessing from the
      // global role: true for the subject's staff and the org admin.
      canModerate: access.isStaff,
      authorRole:
        thread?.authorId != null
          ? roleByUser.get(thread.authorId) ?? null
          : null,
      posts: this.buildTree(posts, roleByUser),
    };
  }

  /**
   * Rename a thread. Only its author may edit it (moderators can delete or pin,
   * not rewrite someone else's words). The opening message is a post and is
   * edited through `updatePost`.
   */
  async updateThread(threadId: string, actingUserId: string, dto: UpdateThreadDto) {
    const { thread } = await this.requireThreadMembership(threadId, actingUserId);
    if (!thread.authorId || thread.authorId !== actingUserId) {
      throw new ForbiddenException('Solo el autor puede editar el hilo.');
    }
    return this.prisma.forumThread.update({
      where: { id: threadId },
      data: { title: dto.title.trim() },
      include: {
        author: { select: AUTHOR_SELECT },
        _count: { select: { posts: true } },
      },
    });
  }

  /** Toggle a thread's pinned flag (course staff only). */
  async togglePin(threadId: string, actingUserId: string) {
    const { thread, access } = await this.requireThreadMembership(
      threadId,
      actingUserId,
      true,
    );

    const updated = await this.prisma.forumThread.update({
      where: { id: threadId },
      data: { pinned: !thread.pinned },
      include: {
        author: { select: AUTHOR_SELECT },
        _count: { select: { posts: true } },
      },
    });
    if (!thread.pinned && thread.authorId) {
      await this.notifications.emitMany(
        [thread.authorId],
        NotificationType.FORUM_THREAD,
        { title: 'Tu hilo se ha fijado', body: `«${thread.title}» aparece destacado en el foro.`, link: `/forums/${thread.id}` },
        { organizationId: access.subject.organizationId, actorId: actingUserId },
      );
    }
    return updated;
  }

  /** Delete a thread (staff only) and notify its author after deletion. */
  /**
   * Delete a thread — the subject's staff or an org admin always; its author
   * only while nobody else has posted in it (their words would go with it).
   */
  async deleteThread(threadId: string, actingUserId: string) {
    const { thread, access } = await this.requireThreadMembership(threadId, actingUserId);
    if (!access.isStaff) {
      if (!thread.authorId || thread.authorId !== actingUserId) {
        throw new ForbiddenException('No tienes permiso para borrar este hilo.');
      }
      const othersPosts = await this.prisma.forumPost.count({
        where: { threadId, OR: [{ authorId: null }, { authorId: { not: actingUserId } }] },
      });
      if (othersPosts > 0) {
        throw new ConflictException('El hilo ya tiene respuestas de otras personas; pide a un profesor que lo borre.');
      }
    }
    await this.prisma.forumThread.delete({ where: { id: threadId } });
    // Pins, replies and new-thread notices link to a page that no longer exists.
    await this.notifications.removeByLink(access.subject.organizationId, { equals: [`/forums/${threadId}`] });
    if (thread.authorId) {
      await this.notifications.emitMany(
        [thread.authorId],
        NotificationType.FORUM_THREAD,
        { title: 'Tu hilo se ha eliminado', body: `«${thread.title}» ya no está en el foro.`, link: '/forums' },
        { organizationId: access.subject.organizationId, actorId: actingUserId },
      );
    }
  }

  // ---------------------------------------------------------------------------
  // Posts
  // ---------------------------------------------------------------------------

  /**
   * Add a post to a thread (any course member). An optional `parentId` nests it
   * as a reply. Notifies the thread author and, for a reply, the parent post's
   * author — never the actor, and never twice.
   */
  async addPost(threadId: string, actingUserId: string, dto: CreatePostDto) {
    const { thread } = await this.requireThreadMembership(
      threadId,
      actingUserId,
    );

    let parentAuthorId: string | null = null;
    if (dto.parentId) {
      // The parent must belong to this very thread — prevents cross-thread (and
      // therefore cross-course/tenant) nesting.
      const parent = await this.prisma.forumPost.findFirst({
        where: { id: dto.parentId, threadId },
        select: { authorId: true },
      });
      if (!parent) {
        throw new NotFoundException(
          'El mensaje al que respondes no existe en este hilo.',
        );
      }
      parentAuthorId = parent.authorId;
    }

    const post = await this.prisma.forumPost.create({
      data: {
        threadId,
        authorId: actingUserId,
        parentId: dto.parentId ?? null,
        body: dto.body,
      },
      include: { author: { select: AUTHOR_SELECT } },
    });

    await this.notifyReply(thread, actingUserId, parentAuthorId);

    return post;
  }

  /** Edit a post's body (its author only). */
  async updatePost(postId: string, actingUserId: string, dto: UpdatePostDto) {
    const { post } = await this.requirePostMembership(postId, actingUserId);
    if (!post.authorId || post.authorId !== actingUserId) {
      throw new ForbiddenException('Solo el autor puede editar el mensaje.');
    }
    return this.prisma.forumPost.update({
      where: { id: postId },
      data: { body: dto.body.trim() },
      include: { author: { select: AUTHOR_SELECT } },
    });
  }

  /**
   * Delete a post — its author while it has no replies, or the subject's staff
   * or an org admin (nested replies go with it, cascade). Reply notices link to the thread,
   * which stays valid, so there is nothing to clean up or announce.
   */
  async deletePost(postId: string, actingUserId: string) {
    const { post, access } = await this.requirePostMembership(postId, actingUserId);
    const isAuthor = !!post.authorId && post.authorId === actingUserId;
    if (!isAuthor && !access.isStaff) {
      throw new ForbiddenException('No tienes permiso para borrar este mensaje.');
    }
    // Replies cascade with the post: an author may not take other people's
    // replies down with their own message; moderators may.
    if (!access.isStaff) {
      const replies = await this.prisma.forumPost.count({ where: { parentId: postId } });
      if (replies > 0) {
        throw new ConflictException('Este mensaje ya tiene respuestas y no se puede borrar.');
      }
    }
    await this.prisma.forumPost.delete({ where: { id: postId } });
  }

  // ---------------------------------------------------------------------------
  // Search
  // ---------------------------------------------------------------------------

  /**
   * Search a course's forum: threads whose title matches, or that contain a
   * post whose body matches (case-insensitive). Scoped to course members.
   */
  async search(subjectId: string, actingUserId: string, q: string) {
    await this.requireSubject(subjectId, actingUserId);

    const term = q.trim();
    return this.prisma.forumThread.findMany({
      where: {
        subjectId,
        OR: [
          { title: { contains: term, mode: 'insensitive' } },
          { posts: { some: { body: { contains: term, mode: 'insensitive' } } } },
        ],
      },
      orderBy: [{ pinned: 'desc' }, { createdAt: 'desc' }],
      include: {
        author: { select: AUTHOR_SELECT },
        _count: { select: { posts: true } },
      },
    });
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  /**
   * Emit FORUM_REPLY to the users relevant to a new post: the thread author and,
   * for a reply, the parent post's author. Skips the acting user (no
   * self-notify) and de-duplicates so a single person is notified at most once.
   */
  private async notifyReply(
    thread: ForumThread,
    actingUserId: string,
    parentAuthorId: string | null,
  ) {
    const recipients = new Set<string>();
    if (thread.authorId) recipients.add(thread.authorId);
    if (parentAuthorId) recipients.add(parentAuthorId);
    recipients.delete(actingUserId); // never notify yourself

    if (recipients.size === 0) return;

    try {
      const [actor, subject] = await Promise.all([
        this.prisma.user.findUnique({ where: { id: actingUserId }, select: { name: true } }),
        this.prisma.subject.findFirst({ where: { id: thread.subjectId }, select: { organizationId: true } }),
      ]);
      if (!subject) return;
      await this.notifications.emitMany(
        [...recipients],
        NotificationType.FORUM_REPLY,
        {
          title: 'Nueva respuesta en el foro',
          body: `${actor?.name ?? 'Alguien'} respondió en «${thread.title}»`,
          link: `/forums/${thread.id}`,
        },
        { organizationId: subject.organizationId, actorId: actingUserId },
      );
    } catch (error) {
      this.logger.error('No se pudo preparar la notificación de respuesta en el foro', error instanceof Error ? error.stack : undefined);
    }
  }

  private async notifyNewThread(thread: ForumThread, organizationId: string, actingUserId: string) {
    await this.notifications.emitMany(
      async () => {
        const staff = await this.prisma.subjectStaff.findMany({
          where: { subjectId: thread.subjectId, subject: { organizationId }, user: { organizationId } },
          select: { userId: true },
        });
        return staff.map(({ userId }) => userId);
      },
      NotificationType.FORUM_THREAD,
      { title: 'Nuevo hilo en el foro', body: `Se ha creado «${thread.title}».`, link: `/forums/${thread.id}` },
      { organizationId, actorId: actingUserId },
    );
  }

  /**
   * Turn a flat, chronologically-ordered post list into a nested reply tree.
   * Each node carries its author's course role (or null) for staff badging.
   * Orphans (parent outside the set) are treated as roots so nothing is lost.
   */
  private buildTree(
    posts: Array<{
      id: string;
      parentId: string | null;
      author: { id: string; name: string; avatarUrl: string | null } | null;
      [key: string]: unknown;
    }>,
    roleByUser: Map<string, SubjectStaffRole>,
  ) {
    type Node = (typeof posts)[number] & {
      authorRole: SubjectStaffRole | null;
      replies: Node[];
    };

    const byId = new Map<string, Node>();
    for (const p of posts) {
      byId.set(p.id, {
        ...p,
        authorRole: p.author ? roleByUser.get(p.author.id) ?? null : null,
        replies: [],
      });
    }

    const roots: Node[] = [];
    for (const node of byId.values()) {
      const parent = node.parentId ? byId.get(node.parentId) : undefined;
      if (parent) parent.replies.push(node);
      else roots.push(node);
    }
    return roots;
  }
}
