import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Activity,
  Prisma,
  PublicationStatus,
  Question,
  QuestionKind,
  Subject,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CourseAccessService, SubjectAccess } from '../courses/course-access.service';
import { getAdapter } from './blocks/registry';
import { CreateActivityDto } from './dto/create-activity.dto';
import { UpdateActivityDto } from './dto/update-activity.dto';
import { CreateQuestionDto } from './dto/create-question.dto';
import { UpdateQuestionDto } from './dto/update-question.dto';

@Injectable()
export class ActivitiesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: CourseAccessService,
  ) {}

  // ─── Tenancy / staff gates ────────────────────────────────────────────────

  private async requireSubject(
    subjectId: string,
    actingUserId: string,
    staffOnly = false,
  ): Promise<SubjectAccess> {
    return staffOnly
      ? this.access.assertSubjectStaffForUser(subjectId, actingUserId)
      : this.access.assertSubjectReadableForUser(subjectId, actingUserId);
  }

  /** Load an activity. Non-staff can only see a PUBLISHED activity. */
  async requireActivity(
    activityId: string,
    actingUserId: string,
    staffOnly = false,
  ): Promise<{ activity: Activity; subject: Subject; access: SubjectAccess }> {
    const activity = await this.prisma.activity.findUnique({
      where: { id: activityId },
      include: { subject: true },
    });
    if (!activity) {
      throw new NotFoundException(`Activity ${activityId} not found`);
    }
    const access = await this.requireSubject(activity.subjectId, actingUserId, staffOnly);
    if (!access.isStaff && activity.status !== PublicationStatus.PUBLISHED) {
      throw new NotFoundException(`Activity ${activityId} not found`);
    }
    return { activity, subject: activity.subject, access };
  }

  // ─── Authoring: activities ────────────────────────────────────────────────

  async create(subjectId: string, actingUserId: string, dto: CreateActivityDto) {
    const { subject } = await this.requireSubject(subjectId, actingUserId, true);
    this.assertWindow(dto.openAt, dto.dueAt, dto.closeAt);

    if (dto.templateId && dto.sourceActivityId) {
      throw new BadRequestException(
        'templateId and sourceActivityId are mutually exclusive',
      );
    }

    const blocks = await this.resolveCreateBlocks(
      subject.organizationId,
      actingUserId,
      dto,
    );

    if (dto.status === PublicationStatus.PUBLISHED && blocks.length === 0) {
      throw new BadRequestException('no se puede publicar vacía');
    }

    const created = await this.prisma.activity.create({
      data: {
        subjectId,
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
        subject.organizationId,
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
  async findAllForCourse(subjectId: string, actingUserId: string) {
    const access = await this.requireSubject(subjectId, actingUserId);
    const staff = access.isStaff;

    const activities = await this.prisma.activity.findMany({
      where: {
        subjectId,
        ...(staff ? {} : { status: PublicationStatus.PUBLISHED }),
      },
      orderBy: { createdAt: 'desc' },
      include: { questions: { orderBy: { order: 'asc' } } },
    });

    return activities.map((a) => this.viewFor(a, staff));
  }

  /** A single activity, scoped to a member. Non-staff get the student view
   * (answer keys stripped); drafts are already 404 for them via requireActivity. */
  async findOne(activityId: string, actingUserId: string) {
    const { activity, access } = await this.requireActivity(
      activityId,
      actingUserId,
    );
    const full = await this.prisma.activity.findUnique({
      where: { id: activityId },
      include: { questions: { orderBy: { order: 'asc' } } },
    });
    return this.viewFor(full ?? activity, access.isStaff);
  }

  async update(activityId: string, actingUserId: string, dto: UpdateActivityDto) {
    const { activity, subject } = await this.requireActivity(
      activityId,
      actingUserId,
      true,
    );

    const merged = {
      openAt: this.mergeDate(dto.openAt, activity.openAt),
      dueAt: this.mergeDate(dto.dueAt, activity.dueAt),
      closeAt: this.mergeDate(dto.closeAt, activity.closeAt),
    };
    this.assertWindow(merged.openAt, merged.dueAt, merged.closeAt);

    if (dto.status === PublicationStatus.PUBLISHED) {
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
        subject.organizationId,
        dto.fileIds,
      );
    }
    return updated;
  }

  async remove(activityId: string, actingUserId: string) {
    await this.requireActivity(activityId, actingUserId, true);
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
    const actor = await this.prisma.user.findUnique({
      where: { id: actingUserId },
      select: { organizationId: true, role: true },
    });
    if (!actor?.organizationId) return [];
    const staffWhere = actor.role === 'ADMIN'
      ? { organizationId: actor.organizationId }
      : { organizationId: actor.organizationId, staff: { some: { userId: actingUserId } } };
    const subjects = await this.prisma.subject.findMany({
      where: staffWhere,
      select: { id: true },
    });
    const subjectIds = subjects.map((subject) => subject.id);
    if (subjectIds.length === 0) return [];

    const activities = await this.prisma.activity.findMany({
      where: { subjectId: { in: subjectIds } },
      orderBy: { createdAt: 'desc' },
      include: {
        subject: { select: { id: true, title: true } },
        _count: { select: { attempts: true } },
      },
    });
    return activities.map((a) => ({
      id: a.id,
      subjectId: a.subjectId,
      courseId: a.subjectId,
      courseTitle: a.subject.title,
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
    await this.requireActivity(activityId, actingUserId, true);
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
    await this.requireActivity(activityId, actingUserId, true);
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
    await this.requireActivity(question.activityId, actingUserId, true);
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
    actingUserId: string,
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
      const sourceRef = await this.prisma.activity.findFirst({
        where: {
          id: dto.sourceActivityId,
          subject: { organizationId },
        },
        select: { subjectId: true },
      });
      if (!sourceRef) {
        throw new NotFoundException(
          `Activity ${dto.sourceActivityId} not found`,
        );
      }

      try {
        await this.requireSubject(sourceRef.subjectId, actingUserId, true);
      } catch (error) {
        // Do not let a caller distinguish an inaccessible source from a
        // missing one in the same organization.
        if (error instanceof ForbiddenException) {
          throw new NotFoundException(
            `Activity ${dto.sourceActivityId} not found`,
          );
        }
        throw error;
      }

      const source = await this.prisma.activity.findFirst({
        where: {
          id: dto.sourceActivityId,
          subject: { organizationId },
        },
        include: {
          subject: true,
          questions: { orderBy: { order: 'asc' } },
        },
      });
      if (!source) {
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
