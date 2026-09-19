import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Activity,
  Course,
  CourseRole,
  CourseStatus,
  Enrollment,
  Prisma,
  Question,
  QuestionKind,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { getAdapter } from './blocks/registry';
import { CreateActivityDto } from './dto/create-activity.dto';
import { UpdateActivityDto } from './dto/update-activity.dto';
import { CreateQuestionDto } from './dto/create-question.dto';
import { UpdateQuestionDto } from './dto/update-question.dto';

/** Course roles allowed to author activities — teacher or teaching assistant.
 * Replicated locally to keep this module decoupled from AssignmentsModule
 * (same pattern as forums/analytics). TODO(shared): a CourseMembershipService. */
export const STAFF_ROLES: CourseRole[] = [
  CourseRole.TEACHER,
  CourseRole.ASSISTANT,
];

@Injectable()
export class ActivitiesService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Tenancy / membership gates ───────────────────────────────────────────

  /** Resolve a course + the acting user's enrollment; the enrollment lookup is
   * the tenant gate (a non-member is treated as if the course doesn't exist).
   * `organizationId` is derived from the course, never from the client. */
  private async requireCourse(
    courseId: string,
    actingUserId: string,
    roles?: CourseRole[],
  ): Promise<{ course: Course; enrollment: Enrollment }> {
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
    });
    if (!course) throw new NotFoundException(`Course ${courseId} not found`);

    const enrollment = await this.prisma.enrollment.findUnique({
      where: { courseId_userId: { courseId, userId: actingUserId } },
    });
    if (!enrollment) throw new NotFoundException(`Course ${courseId} not found`);

    if (roles && !roles.includes(enrollment.role)) {
      throw new ForbiddenException('Only course staff can perform this action');
    }
    return { course, enrollment };
  }

  /** Load an activity and enforce course membership. When `roles` is omitted any
   * member passes, but a non-staff member can only see a PUBLISHED activity
   * (drafts/archived 404 for them, so unpublished work never leaks). */
  async requireActivity(
    activityId: string,
    actingUserId: string,
    roles?: CourseRole[],
  ): Promise<{ activity: Activity; course: Course; enrollment: Enrollment }> {
    const activity = await this.prisma.activity.findUnique({
      where: { id: activityId },
      include: { course: true },
    });
    if (!activity) {
      throw new NotFoundException(`Activity ${activityId} not found`);
    }
    const { course, enrollment } = await this.requireCourse(
      activity.courseId,
      actingUserId,
      roles,
    );
    const isStaff = STAFF_ROLES.includes(enrollment.role);
    if (!isStaff && activity.status !== CourseStatus.PUBLISHED) {
      throw new NotFoundException(`Activity ${activityId} not found`);
    }
    return { activity, course, enrollment };
  }

  private isStaff(role: CourseRole): boolean {
    return STAFF_ROLES.includes(role);
  }

  // ─── Authoring: activities ────────────────────────────────────────────────

  async create(courseId: string, actingUserId: string, dto: CreateActivityDto) {
    const { course } = await this.requireCourse(
      courseId,
      actingUserId,
      STAFF_ROLES,
    );
    this.assertWindow(dto.openAt, dto.dueAt, dto.closeAt);

    if (dto.templateId && dto.sourceActivityId) {
      throw new BadRequestException(
        'templateId and sourceActivityId are mutually exclusive',
      );
    }

    const blocks = await this.resolveCreateBlocks(course.organizationId, dto);

    if (dto.status === CourseStatus.PUBLISHED && blocks.length === 0) {
      throw new BadRequestException('no se puede publicar vacía');
    }

    const created = await this.prisma.activity.create({
      data: {
        courseId,
        ...(dto.type !== undefined && { type: dto.type }),
        title: dto.title,
        description: dto.description,
        openAt: dto.openAt ? new Date(dto.openAt) : null,
        dueAt: dto.dueAt ? new Date(dto.dueAt) : null,
        closeAt: dto.closeAt ? new Date(dto.closeAt) : null,
        maxScore: 0,
        countsTowardFinal: dto.countsTowardFinal ?? true,
        templateId: dto.templateId ?? null,
        ...(dto.attemptsAllowed !== undefined && {
          attemptsAllowed: dto.attemptsAllowed,
        }),
        ...(dto.timeLimitSec !== undefined && { timeLimitSec: dto.timeLimitSec }),
        ...(dto.config !== undefined && {
          config: dto.config as Prisma.InputJsonValue,
        }),
        ...(dto.status !== undefined && { status: dto.status }),
        ...(blocks.length > 0 && {
          questions: {
            create: blocks.map((b, i) => ({
              kind: b.kind,
              prompt: b.prompt,
              points: b.points,
              order: b.order ?? i,
              content: b.content as Prisma.InputJsonValue,
            })),
          },
        }),
      },
      include: { questions: { orderBy: { order: 'asc' } } },
    });

    if (dto.fileIds?.length) {
      await this.replaceActivityFiles(
        created.id,
        course.organizationId,
        dto.fileIds,
      );
    }

    if (blocks.length > 0) {
      await this.recomputeMaxScore(created.id);
      const refreshed = await this.prisma.activity.findUnique({
        where: { id: created.id },
        include: { questions: { orderBy: { order: 'asc' } } },
      });
      return refreshed ?? created;
    }
    return created;
  }

  /** List a course's activities. Students see only PUBLISHED ones and never the
   * answer keys; staff see everything with full question content. */
  async findAllForCourse(courseId: string, actingUserId: string) {
    const { enrollment } = await this.requireCourse(courseId, actingUserId);
    const staff = this.isStaff(enrollment.role);

    const activities = await this.prisma.activity.findMany({
      where: {
        courseId,
        ...(staff ? {} : { status: CourseStatus.PUBLISHED }),
      },
      orderBy: { createdAt: 'desc' },
      include: { questions: { orderBy: { order: 'asc' } } },
    });

    return activities.map((a) => this.viewFor(a, staff));
  }

  /** A single activity, scoped to a member. Non-staff get the student view
   * (answer keys stripped); drafts are already 404 for them via requireActivity. */
  async findOne(activityId: string, actingUserId: string) {
    const { activity, enrollment } = await this.requireActivity(
      activityId,
      actingUserId,
    );
    const full = await this.prisma.activity.findUnique({
      where: { id: activityId },
      include: { questions: { orderBy: { order: 'asc' } } },
    });
    return this.viewFor(full ?? activity, this.isStaff(enrollment.role));
  }

  async update(activityId: string, actingUserId: string, dto: UpdateActivityDto) {
    const { activity, course } = await this.requireActivity(
      activityId,
      actingUserId,
      STAFF_ROLES,
    );

    const merged = {
      openAt: this.mergeDate(dto.openAt, activity.openAt),
      dueAt: this.mergeDate(dto.dueAt, activity.dueAt),
      closeAt: this.mergeDate(dto.closeAt, activity.closeAt),
    };
    this.assertWindow(merged.openAt, merged.dueAt, merged.closeAt);

    if (dto.status === CourseStatus.PUBLISHED) {
      await this.assertPublishable(activityId);
    }

    const updated = await this.prisma.activity.update({
      where: { id: activityId },
      data: {
        ...(dto.type !== undefined && { type: dto.type }),
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.openAt !== undefined && { openAt: merged.openAt }),
        ...(dto.dueAt !== undefined && { dueAt: merged.dueAt }),
        ...(dto.closeAt !== undefined && { closeAt: merged.closeAt }),
        ...(dto.countsTowardFinal !== undefined && {
          countsTowardFinal: dto.countsTowardFinal,
        }),
        ...(dto.attemptsAllowed !== undefined && {
          attemptsAllowed: dto.attemptsAllowed,
        }),
        ...(dto.timeLimitSec !== undefined && {
          timeLimitSec: dto.timeLimitSec,
        }),
        ...(dto.config !== undefined && {
          config: dto.config as Prisma.InputJsonValue,
        }),
        ...(dto.status !== undefined && { status: dto.status }),
      },
      include: { questions: { orderBy: { order: 'asc' } } },
    });

    if (dto.fileIds) {
      await this.replaceActivityFiles(
        activityId,
        course.organizationId,
        dto.fileIds,
      );
    }
    return updated;
  }

  async remove(activityId: string, actingUserId: string) {
    await this.requireActivity(activityId, actingUserId, STAFF_ROLES);
    const attempts = await this.prisma.attempt.count({
      where: { activityId },
    });
    if (attempts > 0) {
      throw new ConflictException('archivar en su lugar');
    }
    await this.prisma.activity.delete({ where: { id: activityId } });
  }

  /** Activities of courses the actor staffs, newest first (template library). */
  async listTeachingActivities(actingUserId: string) {
    const staff = await this.prisma.enrollment.findMany({
      where: { userId: actingUserId, role: { in: STAFF_ROLES } },
      select: { courseId: true },
    });
    const courseIds = staff.map((e) => e.courseId);
    if (courseIds.length === 0) return [];

    const activities = await this.prisma.activity.findMany({
      where: { courseId: { in: courseIds } },
      orderBy: { createdAt: 'desc' },
      include: {
        course: { select: { id: true, title: true } },
        _count: { select: { attempts: true } },
      },
    });
    return activities.map((a) => ({
      id: a.id,
      courseId: a.courseId,
      courseTitle: a.course.title,
      title: a.title,
      status: a.status,
      countsTowardFinal: a.countsTowardFinal,
      attemptCount: a._count.attempts,
      createdAt: a.createdAt.toISOString(),
      dueAt: a.dueAt ? a.dueAt.toISOString() : null,
    }));
  }

  // ─── Authoring: questions ─────────────────────────────────────────────────

  async addQuestion(
    activityId: string,
    actingUserId: string,
    dto: CreateQuestionDto,
  ) {
    await this.requireActivity(activityId, actingUserId, STAFF_ROLES);
    await this.assertNoAttempts(activityId);
    this.validateQuestionContent(dto.kind, dto.content);

    // Append at the end unless an explicit order is given.
    const order =
      dto.order ??
      (await this.prisma.question.count({ where: { activityId } }));

    const question = await this.prisma.question.create({
      data: {
        activityId,
        kind: dto.kind,
        prompt: dto.prompt,
        ...(dto.points !== undefined && { points: dto.points }),
        order,
        content: dto.content as Prisma.InputJsonValue,
      },
    });
    await this.recomputeMaxScore(activityId);
    return question;
  }

  async updateQuestion(
    questionId: string,
    actingUserId: string,
    dto: UpdateQuestionDto,
  ) {
    const question = await this.loadQuestionAsStaff(questionId, actingUserId);
    await this.assertNoAttempts(question.activityId);

    // Validate the resulting (kind, content) pair. Changing kind requires new
    // content; changing content revalidates against the (possibly new) kind.
    const nextKind = dto.kind ?? question.kind;
    if (dto.content !== undefined) {
      this.validateQuestionContent(nextKind, dto.content);
    } else if (dto.kind !== undefined && dto.kind !== question.kind) {
      throw new BadRequestException(
        'Changing a question kind requires new matching content',
      );
    }

    const updated = await this.prisma.question.update({
      where: { id: questionId },
      data: {
        ...(dto.kind !== undefined && { kind: dto.kind }),
        ...(dto.prompt !== undefined && { prompt: dto.prompt }),
        ...(dto.points !== undefined && { points: dto.points }),
        ...(dto.order !== undefined && { order: dto.order }),
        ...(dto.content !== undefined && {
          content: dto.content as Prisma.InputJsonValue,
        }),
      },
    });
    await this.recomputeMaxScore(question.activityId);
    return updated;
  }

  async removeQuestion(questionId: string, actingUserId: string) {
    const question = await this.loadQuestionAsStaff(questionId, actingUserId);
    await this.assertNoAttempts(question.activityId);
    await this.prisma.question.delete({ where: { id: questionId } });
    await this.recomputeMaxScore(question.activityId);
  }

  /** Reorder every question of an activity. The provided id set must match the
   * activity's questions exactly (no missing/extra ids). */
  async reorderQuestions(
    activityId: string,
    actingUserId: string,
    questionIds: string[],
  ) {
    await this.requireActivity(activityId, actingUserId, STAFF_ROLES);
    await this.assertNoAttempts(activityId);
    const existing = await this.prisma.question.findMany({
      where: { activityId },
      select: { id: true },
    });
    const existingIds = new Set(existing.map((q) => q.id));
    if (
      questionIds.length !== existingIds.size ||
      !questionIds.every((id) => existingIds.has(id))
    ) {
      throw new BadRequestException(
        'questionIds must list exactly the activity’s questions',
      );
    }

    await this.prisma.$transaction(
      questionIds.map((id, index) =>
        this.prisma.question.update({
          where: { id },
          data: { order: index },
        }),
      ),
    );
    await this.recomputeMaxScore(activityId);
    return this.prisma.question.findMany({
      where: { activityId },
      orderBy: { order: 'asc' },
    });
  }

  /** Persist Activity.maxScore = sum(question.points), or 0 if none. */
  async recomputeMaxScore(activityId: string): Promise<number> {
    const questions = await this.prisma.question.findMany({
      where: { activityId },
      select: { points: true },
    });
    const maxScore = questions.reduce((sum, q) => sum + q.points, 0);
    await this.prisma.activity.update({
      where: { id: activityId },
      data: { maxScore },
    });
    return maxScore;
  }

  private async loadQuestionAsStaff(
    questionId: string,
    actingUserId: string,
  ): Promise<Question> {
    const question = await this.prisma.question.findUnique({
      where: { id: questionId },
    });
    if (!question) {
      throw new NotFoundException(`Question ${questionId} not found`);
    }
    await this.requireActivity(question.activityId, actingUserId, STAFF_ROLES);
    return question;
  }

  // ─── Student-safe view ────────────────────────────────────────────────────

  /** Shape an activity for the caller: staff get raw content; students get the
   * answer keys stripped from every question so a quiz can't be cheated. */
  private viewFor(
    activity: Activity & { questions?: Question[] },
    staff: boolean,
  ) {
    if (staff || !activity.questions) return activity;
    return {
      ...activity,
      questions: activity.questions.map((q) => ({
        ...q,
        content: ActivitiesService.stripAnswerKey(q.kind, q.content),
      })),
    };
  }

  /** The subset of a question's `content` a student may receive while taking it
   * (options/prompts/counts, never the correct answers). */
  static stripAnswerKey(kind: QuestionKind, content: unknown): unknown {
    const c = (content && typeof content === 'object' ? content : {}) as Record<
      string,
      unknown
    >;
    switch (kind) {
      case QuestionKind.MULTIPLE_CHOICE:
        return { options: c.options ?? [] };
      case QuestionKind.MATCHING:
        return { left: c.left ?? [], right: c.right ?? [] };
      case QuestionKind.ORDERING:
        return { items: c.items ?? [] };
      case QuestionKind.FILL_BLANK: {
        // Preserve only the number of blanks so the UI renders the inputs.
        const blanks = Array.isArray(c.blanks) ? c.blanks : [];
        return { blanks: blanks.map(() => ({})) };
      }
      case QuestionKind.TRUE_FALSE:
      case QuestionKind.SHORT_ANSWER:
        return {};
      case QuestionKind.ESSAY:
      case QuestionKind.FILE_UPLOAD:
        return c;
      default:
        return {};
    }
  }

  /** Validate a question's authoring `content` against its kind. */
  validateQuestionContent(kind: QuestionKind, content: unknown): void {
    getAdapter(kind).validateContent(content);
  }

  private async assertNoAttempts(activityId: string): Promise<void> {
    const count = await this.prisma.attempt.count({ where: { activityId } });
    if (count > 0) {
      throw new ConflictException('la estructura está bloqueada');
    }
  }

  private async assertPublishable(activityId: string): Promise<void> {
    const questions = await this.prisma.question.findMany({
      where: { activityId },
      select: { points: true },
    });
    const total = questions.reduce((sum, q) => sum + q.points, 0);
    if (questions.length === 0 || total === 0) {
      throw new BadRequestException('no se puede publicar vacía');
    }
  }

  private async resolveCreateBlocks(
    organizationId: string,
    dto: CreateActivityDto,
  ): Promise<
    Array<{
      kind: QuestionKind;
      prompt: string;
      points: number;
      order: number;
      content: Record<string, unknown>;
    }>
  > {
    if (dto.templateId) {
      const template = await this.prisma.taskTemplate.findUnique({
        where: { id: dto.templateId },
      });
      if (!template || template.organizationId !== organizationId) {
        throw new NotFoundException(`Task template ${dto.templateId} not found`);
      }
      return this.normalizeBlocks(template.blocks);
    }

    if (dto.sourceActivityId) {
      const source = await this.prisma.activity.findUnique({
        where: { id: dto.sourceActivityId },
        include: {
          course: true,
          questions: { orderBy: { order: 'asc' } },
        },
      });
      if (!source || source.course.organizationId !== organizationId) {
        throw new NotFoundException(
          `Activity ${dto.sourceActivityId} not found`,
        );
      }
      return source.questions.map((q) => ({
        kind: q.kind,
        prompt: q.prompt,
        points: q.points,
        order: q.order,
        content: (q.content ?? {}) as Record<string, unknown>,
      }));
    }

    return [];
  }

  private normalizeBlocks(raw: unknown): Array<{
    kind: QuestionKind;
    prompt: string;
    points: number;
    order: number;
    content: Record<string, unknown>;
  }> {
    if (!Array.isArray(raw)) return [];
    const blocks = raw.map((b, i) => {
      const row = (b && typeof b === 'object' ? b : {}) as Record<
        string,
        unknown
      >;
      return {
        kind: row.kind as QuestionKind,
        prompt: String(row.prompt ?? ''),
        points: typeof row.points === 'number' ? row.points : 1,
        order: typeof row.order === 'number' ? row.order : i,
        content:
          row.content && typeof row.content === 'object'
            ? (row.content as Record<string, unknown>)
            : {},
      };
    });
    for (const block of blocks) {
      this.validateQuestionContent(block.kind, block.content);
    }
    return blocks;
  }

  private async replaceActivityFiles(
    activityId: string,
    organizationId: string,
    fileIds: string[],
  ): Promise<void> {
    if (fileIds.length > 0) {
      const files = await this.prisma.file.findMany({
        where: { id: { in: fileIds }, organizationId },
        select: { id: true },
      });
      if (files.length !== fileIds.length) {
        throw new BadRequestException('One or more files are not in this organization');
      }
    }
    await this.prisma.activityFile.deleteMany({ where: { activityId } });
    if (fileIds.length === 0) return;
    await this.prisma.activityFile.createMany({
      data: fileIds.map((fileId) => ({ activityId, fileId })),
    });
  }

  // ─── Small helpers (shared with the assignments window rules) ─────────────

  private mergeDate(
    patch: string | null | undefined,
    current: Date | null,
  ): Date | null {
    if (patch === undefined) return current;
    return patch ? new Date(patch) : null;
  }

  private assertWindow(
    open?: string | Date | null,
    due?: string | Date | null,
    close?: string | Date | null,
  ): void {
    const o = open ? new Date(open).getTime() : null;
    const d = due ? new Date(due).getTime() : null;
    const c = close ? new Date(close).getTime() : null;
    if (o !== null && d !== null && o > d) {
      throw new BadRequestException(
        'La fecha de apertura no puede ser posterior a la de entrega',
      );
    }
    if (d !== null && c !== null && d > c) {
      throw new BadRequestException(
        'La fecha de entrega no puede ser posterior a la de cierre',
      );
    }
    if (o !== null && c !== null && o > c) {
      throw new BadRequestException(
        'La fecha de apertura no puede ser posterior a la de cierre',
      );
    }
  }
}
