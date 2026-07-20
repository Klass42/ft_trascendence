import {
  BadRequestException,
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
    await this.requireCourse(courseId, actingUserId, STAFF_ROLES);
    this.assertWindow(dto.openAt, dto.dueAt, dto.closeAt);

    return this.prisma.activity.create({
      data: {
        courseId,
        ...(dto.type !== undefined && { type: dto.type }),
        title: dto.title,
        description: dto.description,
        openAt: dto.openAt ? new Date(dto.openAt) : null,
        dueAt: dto.dueAt ? new Date(dto.dueAt) : null,
        closeAt: dto.closeAt ? new Date(dto.closeAt) : null,
        ...(dto.maxScore !== undefined && { maxScore: dto.maxScore }),
        ...(dto.attemptsAllowed !== undefined && {
          attemptsAllowed: dto.attemptsAllowed,
        }),
        ...(dto.timeLimitSec !== undefined && { timeLimitSec: dto.timeLimitSec }),
        ...(dto.config !== undefined && {
          config: dto.config as Prisma.InputJsonValue,
        }),
        ...(dto.status !== undefined && { status: dto.status }),
      },
      include: { questions: { orderBy: { order: 'asc' } } },
    });
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
    const { activity } = await this.requireActivity(
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

    return this.prisma.activity.update({
      where: { id: activityId },
      data: {
        ...(dto.type !== undefined && { type: dto.type }),
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.openAt !== undefined && { openAt: merged.openAt }),
        ...(dto.dueAt !== undefined && { dueAt: merged.dueAt }),
        ...(dto.closeAt !== undefined && { closeAt: merged.closeAt }),
        ...(dto.maxScore !== undefined && { maxScore: dto.maxScore }),
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
  }

  async remove(activityId: string, actingUserId: string) {
    await this.requireActivity(activityId, actingUserId, STAFF_ROLES);
    await this.prisma.activity.delete({ where: { id: activityId } });
  }

  // ─── Authoring: questions ─────────────────────────────────────────────────

  async addQuestion(
    activityId: string,
    actingUserId: string,
    dto: CreateQuestionDto,
  ) {
    await this.requireActivity(activityId, actingUserId, STAFF_ROLES);
    this.validateQuestionContent(dto.kind, dto.content);

    // Append at the end unless an explicit order is given.
    const order =
      dto.order ??
      (await this.prisma.question.count({ where: { activityId } }));

    return this.prisma.question.create({
      data: {
        activityId,
        kind: dto.kind,
        prompt: dto.prompt,
        ...(dto.points !== undefined && { points: dto.points }),
        order,
        content: dto.content as Prisma.InputJsonValue,
      },
    });
  }

  async updateQuestion(
    questionId: string,
    actingUserId: string,
    dto: UpdateQuestionDto,
  ) {
    const question = await this.loadQuestionAsStaff(questionId, actingUserId);

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

    return this.prisma.question.update({
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
  }

  async removeQuestion(questionId: string, actingUserId: string) {
    await this.loadQuestionAsStaff(questionId, actingUserId);
    await this.prisma.question.delete({ where: { id: questionId } });
  }

  /** Reorder every question of an activity. The provided id set must match the
   * activity's questions exactly (no missing/extra ids). */
  async reorderQuestions(
    activityId: string,
    actingUserId: string,
    questionIds: string[],
  ) {
    await this.requireActivity(activityId, actingUserId, STAFF_ROLES);
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
    return this.prisma.question.findMany({
      where: { activityId },
      orderBy: { order: 'asc' },
    });
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
      default:
        return {};
    }
  }

  // ─── Per-kind content validation (backend half of front+back validation) ──

  /** Validate a question's authoring `content` against its kind. Throws
   * BadRequestException with a clear message so bad authoring can't produce an
   * ungradeable question. */
  validateQuestionContent(kind: QuestionKind, content: unknown): void {
    const c = (content && typeof content === 'object' ? content : {}) as Record<
      string,
      unknown
    >;
    const isStrArr = (v: unknown) =>
      Array.isArray(v) && v.every((x) => typeof x === 'string');
    const isIdxArr = (v: unknown, max: number) =>
      Array.isArray(v) &&
      v.every((x) => Number.isInteger(x) && x >= 0 && x < max);
    const bad = (msg: string) => {
      throw new BadRequestException(msg);
    };

    switch (kind) {
      case QuestionKind.MULTIPLE_CHOICE: {
        if (!isStrArr(c.options) || (c.options as string[]).length < 2) {
          bad('MULTIPLE_CHOICE requires options: string[] (≥2)');
        }
        if (
          !isIdxArr(c.correct, (c.options as string[]).length) ||
          (c.correct as number[]).length < 1
        ) {
          bad('MULTIPLE_CHOICE requires correct: valid option indices (≥1)');
        }
        break;
      }
      case QuestionKind.TRUE_FALSE:
        if (typeof c.answer !== 'boolean') bad('TRUE_FALSE requires answer: boolean');
        break;
      case QuestionKind.FILL_BLANK: {
        const blanks = c.blanks;
        if (!Array.isArray(blanks) || blanks.length < 1) {
          bad('FILL_BLANK requires blanks: { accepted: string[] }[] (≥1)');
        }
        (blanks as unknown[]).forEach((b, i) => {
          const accepted = (b as Record<string, unknown>)?.accepted;
          if (!isStrArr(accepted) || (accepted as string[]).length < 1) {
            bad(`FILL_BLANK blank #${i + 1} needs accepted: string[] (≥1)`);
          }
        });
        break;
      }
      case QuestionKind.MATCHING: {
        const { left, right, pairs } = c;
        if (!isStrArr(left) || (left as string[]).length < 1) {
          bad('MATCHING requires left: string[] (≥1)');
        }
        if (!isStrArr(right) || (right as string[]).length < 1) {
          bad('MATCHING requires right: string[] (≥1)');
        }
        if (
          !Array.isArray(pairs) ||
          pairs.length < 1 ||
          !pairs.every(
            (p) =>
              Array.isArray(p) &&
              p.length === 2 &&
              Number.isInteger(p[0]) &&
              p[0] >= 0 &&
              p[0] < (left as string[]).length &&
              Number.isInteger(p[1]) &&
              p[1] >= 0 &&
              p[1] < (right as string[]).length,
          )
        ) {
          bad('MATCHING requires pairs: [leftIdx, rightIdx][] within bounds');
        }
        break;
      }
      case QuestionKind.ORDERING: {
        const { items, correctOrder } = c;
        if (!isStrArr(items) || (items as string[]).length < 2) {
          bad('ORDERING requires items: string[] (≥2)');
        }
        const n = (items as string[]).length;
        if (
          !Array.isArray(correctOrder) ||
          correctOrder.length !== n ||
          new Set(correctOrder).size !== n ||
          !isIdxArr(correctOrder, n)
        ) {
          bad('ORDERING requires correctOrder: a permutation of item indices');
        }
        break;
      }
      case QuestionKind.SHORT_ANSWER:
        // `accepted` optional: empty/absent → the question is graded manually.
        if (c.accepted !== undefined && !isStrArr(c.accepted)) {
          bad('SHORT_ANSWER accepted must be string[] when provided');
        }
        break;
      default:
        bad(`Unsupported question kind: ${kind}`);
    }
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
