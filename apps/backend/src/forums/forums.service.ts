import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Course,
  CourseRole,
  Enrollment,
  ForumThread,
  NotificationType,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateThreadDto } from './dto/create-thread.dto';
import { CreatePostDto } from './dto/create-post.dto';

/** Course roles allowed to perform staff-only actions (e.g. pinning). */
export const STAFF_ROLES: CourseRole[] = [
  CourseRole.TEACHER,
  CourseRole.ASSISTANT,
];

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
  ) {}

  // ---------------------------------------------------------------------------
  // Membership gates
  //
  // TODO: extraer helper de membership compartido — this duplicates
  // AssignmentsService.requireCourseMembership on purpose so ForumsModule stays
  // decoupled from AssignmentsModule. Consolidate once the auth pass lands.
  // ---------------------------------------------------------------------------

  /**
   * Resolve a course together with the acting user's enrollment, deriving the
   * tenant `organizationId` from the course itself (never from the client).
   *
   * The enrollment lookup doubles as the tenant/membership gate: a user from
   * another org (or a stranger to the course) has no enrollment and is treated
   * as if the course does not exist.
   */
  private async requireMembership(
    courseId: string,
    actingUserId: string,
    roles?: CourseRole[],
  ): Promise<{ course: Course; enrollment: Enrollment }> {
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
    });
    if (!course) {
      throw new NotFoundException(`Course ${courseId} not found`);
    }

    const enrollment = await this.prisma.enrollment.findUnique({
      where: { courseId_userId: { courseId, userId: actingUserId } },
    });
    if (!enrollment) {
      // Don't leak the course's existence to non-members.
      throw new NotFoundException(`Course ${courseId} not found`);
    }

    if (roles && !roles.includes(enrollment.role)) {
      throw new ForbiddenException('Only course staff can perform this action');
    }

    return { course, enrollment };
  }

  /**
   * Load a thread and enforce that `actingUserId` is a member of its course.
   * Returns the thread plus the parent course (for its org) and the actor's
   * enrollment (for role checks).
   */
  private async requireThreadMembership(
    threadId: string,
    actingUserId: string,
    roles?: CourseRole[],
  ): Promise<{
    thread: ForumThread;
    course: Course;
    enrollment: Enrollment;
  }> {
    const thread = await this.prisma.forumThread.findUnique({
      where: { id: threadId },
    });
    if (!thread) {
      throw new NotFoundException(`Thread ${threadId} not found`);
    }

    const { course, enrollment } = await this.requireMembership(
      thread.courseId,
      actingUserId,
      roles,
    );

    return { thread, course, enrollment };
  }

  // ---------------------------------------------------------------------------
  // Threads
  // ---------------------------------------------------------------------------

  /** List a course's threads, pinned first then newest, for any member. */
  async listThreads(courseId: string, actingUserId: string) {
    await this.requireMembership(courseId, actingUserId);

    return this.prisma.forumThread.findMany({
      where: { courseId },
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
    courseId: string,
    actingUserId: string,
    dto: CreateThreadDto,
  ) {
    await this.requireMembership(courseId, actingUserId);

    const body = dto.body?.trim();

    return this.prisma.forumThread.create({
      data: {
        courseId,
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
    const { course } = await this.requireThreadMembership(
      threadId,
      actingUserId,
    );

    const [thread, posts, enrollments] = await Promise.all([
      this.prisma.forumThread.findUnique({
        where: { id: threadId },
        include: { author: { select: AUTHOR_SELECT } },
      }),
      this.prisma.forumPost.findMany({
        where: { threadId },
        orderBy: { createdAt: 'asc' },
        include: { author: { select: AUTHOR_SELECT } },
      }),
      // Map author -> course role so the UI can badge staff (TEACHER/ASSISTANT).
      // One cheap query rather than a join per post.
      this.prisma.enrollment.findMany({
        where: { courseId: course.id },
        select: { userId: true, role: true },
      }),
    ]);

    const roleByUser = new Map(enrollments.map((e) => [e.userId, e.role]));

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
      STAFF_ROLES,
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
  async search(courseId: string, actingUserId: string, q: string) {
    await this.requireMembership(courseId, actingUserId);

    const term = q.trim();
    return this.prisma.forumThread.findMany({
      where: {
        courseId,
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
    roleByUser: Map<string, CourseRole>,
  ) {
    type Node = (typeof posts)[number] & {
      authorRole: CourseRole | null;
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
