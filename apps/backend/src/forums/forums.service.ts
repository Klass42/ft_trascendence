import {
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

/** Minimal author projection embedded in thread/post responses. */
const AUTHOR_SELECT = {
  id: true,
  name: true,
  avatarUrl: true,
} as const;

@Injectable()
export class ForumsService {
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
  ): Promise<{ thread: ForumThread }> {
    const thread = await this.prisma.forumThread.findUnique({
      where: { id: threadId },
    });
    if (!thread) {
      throw new NotFoundException(`Thread ${threadId} not found`);
    }
    await this.requireSubject(thread.subjectId, actingUserId, staffOnly);
    return { thread };
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
    await this.requireSubject(subjectId, actingUserId);

    const body = dto.body?.trim();

    return this.prisma.forumThread.create({
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
    // No notification on thread creation: the only "relevant user" is the
    // thread author, and we never notify the actor about their own action.
  }

  /** A thread with its posts nested into a reply tree, scoped to a member. */
  async getThread(threadId: string, actingUserId: string) {
    const { thread: known } = await this.requireThreadMembership(
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
      authorRole:
        thread?.authorId != null
          ? roleByUser.get(thread.authorId) ?? null
          : null,
      posts: this.buildTree(posts, roleByUser),
    };
  }

  /** Toggle a thread's pinned flag (course staff only). */
  async togglePin(threadId: string, actingUserId: string) {
    const { thread } = await this.requireThreadMembership(
      threadId,
      actingUserId,
      true,
    );

    return this.prisma.forumThread.update({
      where: { id: threadId },
      data: { pinned: !thread.pinned },
      include: {
        author: { select: AUTHOR_SELECT },
        _count: { select: { posts: true } },
      },
    });
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
          `Parent post ${dto.parentId} not found in this thread`,
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

    const actor = await this.prisma.user.findUnique({
      where: { id: actingUserId },
      select: { name: true },
    });
    const who = actor?.name ?? 'Alguien';

    await Promise.all(
      [...recipients].map((userId) =>
        this.notifications.emit(userId, NotificationType.FORUM_REPLY, {
          title: 'Nueva respuesta en el foro',
          body: `${who} respondió en «${thread.title}»`,
          link: `/forums/${thread.id}`,
        }),
      ),
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
