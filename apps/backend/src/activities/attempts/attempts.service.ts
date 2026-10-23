import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  Activity,
  AttemptStatus,
  NotificationType,
  Prisma,
} from '@prisma/client';
import { ANALYTICS_UPDATED } from '../../analytics/analytics.events';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { ActivitiesService } from '../activities.service';
import { gradeQuestion, isAutoGradable } from '../grading/graders';
import { SaveAnswersDto } from './dto/save-answers.dto';
import { GradeAttemptDto } from './dto/grade-attempt.dto';

@Injectable()
export class AttemptsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activities: ActivitiesService,
    private readonly notifications: NotificationsService,
    private readonly events: EventEmitter2,
  ) {}

  // ─── Student: start / save / submit ───────────────────────────────────────

  /** Start (or resume) an attempt. Enforces the open/close window and the
   * per-activity attempt cap. Returns the attempt plus the student-safe activity
   * (answer keys stripped) so the client can render the quiz. */
  async start(activityId: string, actingUserId: string) {
    const { activity } = await this.activities.requireActivity(
      activityId,
      actingUserId,
    );

    const now = new Date();
    if (activity.openAt && now < activity.openAt) {
      throw new BadRequestException('La actividad aún no está abierta');
    }
    if (activity.closeAt && now > activity.closeAt) {
      throw new BadRequestException('La actividad está cerrada');
    }

    // Resume an in-progress attempt instead of opening a second one.
    const inProgress = await this.prisma.attempt.findFirst({
      where: {
        activityId,
        userId: actingUserId,
        status: AttemptStatus.IN_PROGRESS,
      },
    });
    if (inProgress) return this.studentView(inProgress.id, actingUserId);

    const used = await this.prisma.attempt.count({
      where: { activityId, userId: actingUserId },
    });
    if (activity.attemptsAllowed > 0 && used >= activity.attemptsAllowed) {
      throw new BadRequestException(
        'No quedan intentos disponibles para esta actividad',
      );
    }

    const attempt = await this.prisma.attempt.create({
      data: {
        activityId,
        userId: actingUserId,
        attemptNo: used + 1,
        status: AttemptStatus.IN_PROGRESS,
      },
    });
    return this.studentView(attempt.id, actingUserId);
  }

  /** Upsert answers for an in-progress attempt (autosave-friendly; a subset is
   * fine). Only the owner may save, and only while IN_PROGRESS. */
  async saveAnswers(
    attemptId: string,
    actingUserId: string,
    dto: SaveAnswersDto,
  ) {
    const attempt = await this.loadOwnedAttempt(attemptId, actingUserId);
    if (attempt.status !== AttemptStatus.IN_PROGRESS) {
      throw new BadRequestException('El intento ya fue enviado');
    }

    const validIds = new Set(attempt.activity.questions.map((q) => q.id));
    for (const a of dto.answers) {
      if (!validIds.has(a.questionId)) {
        throw new BadRequestException(
          `La pregunta ${a.questionId} no pertenece a esta actividad`,
        );
      }
    }

    await this.prisma.$transaction(
      dto.answers.map((a) =>
        this.prisma.answer.upsert({
          where: {
            attemptId_questionId: { attemptId, questionId: a.questionId },
          },
          create: {
            attemptId,
            questionId: a.questionId,
            response: a.response as Prisma.InputJsonValue,
          },
          update: { response: a.response as Prisma.InputJsonValue },
        }),
      ),
    );
    return this.studentView(attemptId, actingUserId);
  }

  /** Finalise an attempt: auto-grade every objective question, compute the
   * scaled score, and either mark it GRADED (fully objective → notify) or leave
   * it SUBMITTED awaiting manual grading (has subjective questions). */
  async submit(attemptId: string, actingUserId: string) {
    const attempt = await this.loadOwnedAttempt(attemptId, actingUserId);
    if (attempt.status !== AttemptStatus.IN_PROGRESS) {
      throw new BadRequestException('El intento ya fue enviado');
    }

    const { activity } = attempt;
    const answersByQ = new Map(attempt.answers.map((a) => [a.questionId, a]));

    let awardedSum = 0;
    let totalPoints = 0;
    let hasManual = false;
    const answerUpdates: Prisma.PrismaPromise<unknown>[] = [];

    for (const q of activity.questions) {
      totalPoints += q.points;
      const answer = answersByQ.get(q.id);

      if (isAutoGradable(q.kind, q.content)) {
        const { correct, awarded } = gradeQuestion(
          q.kind,
          q.content,
          answer?.response ?? {},
          q.points,
        );
        awardedSum += awarded;
        if (answer) {
          answerUpdates.push(
            this.prisma.answer.update({
              where: { id: answer.id },
              data: { correct, awarded },
            }),
          );
        } else {
          // No saved answer for an objective question → 0, recorded so the
          // student's result is complete.
          answerUpdates.push(
            this.prisma.answer.create({
              data: {
                attemptId,
                questionId: q.id,
                response: {} as Prisma.InputJsonValue,
                correct: false,
                awarded: 0,
              },
            }),
          );
        }
      } else {
        hasManual = true;
      }
    }

    const now = new Date();
    const scaledObjective =
      totalPoints > 0 ? (awardedSum / totalPoints) * activity.maxScore : 0;

    const attemptData: Prisma.AttemptUpdateInput = hasManual
      ? { status: AttemptStatus.SUBMITTED, submittedAt: now }
      : {
          status: AttemptStatus.GRADED,
          submittedAt: now,
          gradedAt: now,
          score: round2(scaledObjective),
        };

    await this.prisma.$transaction([
      ...answerUpdates,
      this.prisma.attempt.update({ where: { id: attemptId }, data: attemptData }),
    ]);
    this.events.emit(ANALYTICS_UPDATED, {
      courseId: activity.subjectId,
      organizationId: activity.subject.organizationId,
    });

    if (!hasManual) {
      await this.notifyGraded(
        actingUserId,
        activity,
        round2(scaledObjective),
      );
    }
    return this.studentView(attemptId, actingUserId);
  }

  /** The acting user's own attempts for an activity, with their per-answer
   * results. Correct answer keys are only revealed when the author opted in
   * (`config.showSolutions`). */
  async listMine(activityId: string, actingUserId: string) {
    await this.activities.requireActivity(activityId, actingUserId);
    const attempts = await this.prisma.attempt.findMany({
      where: { activityId, userId: actingUserId },
      orderBy: { attemptNo: 'asc' },
      include: { answers: true },
    });
    return attempts;
  }

  // ─── Staff: view all attempts / manual grade ──────────────────────────────

  /** Every attempt for an activity (course staff only), with student + answers. */
  async listForActivity(activityId: string, actingUserId: string) {
    await this.activities.requireActivity(activityId, actingUserId, true);
    return this.prisma.attempt.findMany({
      where: { activityId },
      orderBy: [{ userId: 'asc' }, { attemptNo: 'asc' }],
      include: {
        answers: true,
        user: { select: { id: true, name: true, email: true, avatarUrl: true } },
      },
    });
  }

  /** Staff awards points on subjective answers. GRADED only when every
   * question has awarded != null; otherwise stays SUBMITTED. */
  async grade(attemptId: string, actingUserId: string, dto: GradeAttemptDto) {
    const attempt = await this.prisma.attempt.findUnique({
      where: { id: attemptId },
      include: {
        answers: true,
        activity: {
          include: {
            questions: { orderBy: { order: 'asc' } },
            subject: { select: { organizationId: true } },
          },
        },
      },
    });
    if (!attempt) throw new NotFoundException(`Attempt ${attemptId} not found`);
    await this.activities.requireActivity(
      attempt.activityId,
      actingUserId,
      true,
    );

    if (attempt.status === AttemptStatus.IN_PROGRESS) {
      throw new BadRequestException('El intento aún no se ha enviado');
    }

    const questions = new Map(
      attempt.activity.questions.map((q) => [q.id, q]),
    );
    for (const item of dto.answers) {
      const question = questions.get(item.questionId);
      if (!question) {
        throw new BadRequestException(
          `La pregunta ${item.questionId} no pertenece a esta actividad`,
        );
      }
      if (item.awarded > question.points) {
        throw new BadRequestException(
          `La nota no puede superar ${question.points}`,
        );
      }
    }

    for (const item of dto.answers) {
      await this.prisma.answer.upsert({
        where: {
          attemptId_questionId: {
            attemptId,
            questionId: item.questionId,
          },
        },
        create: {
          attemptId,
          questionId: item.questionId,
          response: {} as Prisma.InputJsonValue,
          awarded: item.awarded,
        },
        update: { awarded: item.awarded },
      });
    }

    const answers = await this.prisma.answer.findMany({
      where: { attemptId },
    });
    const awardedByQ = new Map(answers.map((a) => [a.questionId, a.awarded]));
    let allAwarded = true;
    let sum = 0;
    for (const q of attempt.activity.questions) {
      const awarded = awardedByQ.get(q.id);
      if (awarded == null) {
        allAwarded = false;
      } else {
        sum += awarded;
      }
    }

    const now = new Date();
    const graded = await this.prisma.attempt.update({
      where: { id: attemptId },
      data: {
        score: round2(sum),
        ...(dto.feedback !== undefined && { feedback: dto.feedback }),
        ...(allAwarded
          ? {
              status: AttemptStatus.GRADED,
              gradedById: actingUserId,
              gradedAt: now,
            }
          : { status: AttemptStatus.SUBMITTED }),
      },
    });
    this.events.emit(ANALYTICS_UPDATED, {
      courseId: attempt.activity.subjectId,
      organizationId: attempt.activity.subject.organizationId,
    });

    if (allAwarded) {
      await this.notifyGraded(
        attempt.userId,
        attempt.activity,
        graded.score ?? 0,
      );
    }
    return graded;
  }

  // ─── Internals ────────────────────────────────────────────────────────────

  private async loadOwnedAttempt(attemptId: string, actingUserId: string) {
    const attempt = await this.prisma.attempt.findUnique({
      where: { id: attemptId },
      include: {
        answers: true,
        activity: {
          include: {
            questions: { orderBy: { order: 'asc' } },
            subject: { select: { organizationId: true } },
          },
        },
      },
    });
    if (!attempt) throw new NotFoundException(`Attempt ${attemptId} not found`);
    if (attempt.userId !== actingUserId) {
      throw new ForbiddenException('No es tu intento');
    }
    return attempt;
  }

  /** Attempt + student-safe activity view (answer keys stripped unless the
   * activity is configured to show solutions and the attempt is graded). */
  private async studentView(attemptId: string, actingUserId: string) {
    const attempt = await this.prisma.attempt.findUnique({
      where: { id: attemptId },
      include: {
        answers: true,
        activity: { include: { questions: { orderBy: { order: 'asc' } } } },
      },
    });
    if (!attempt) throw new NotFoundException(`Attempt ${attemptId} not found`);

    const cfg = (attempt.activity.config ?? {}) as Record<string, unknown>;
    const reveal =
      cfg.showSolutions === true && attempt.status === AttemptStatus.GRADED;

    const questions = attempt.activity.questions.map((q) => ({
      ...q,
      content: reveal
        ? q.content
        : ActivitiesService.stripAnswerKey(q.kind, q.content),
    }));

    return {
      ...attempt,
      activity: { ...attempt.activity, questions },
    };
  }

  private async notifyGraded(
    userId: string,
    activity: Activity,
    score: number,
  ) {
    await this.notifications.emit(userId, NotificationType.GRADE_PUBLISHED, {
      title: 'Actividad calificada',
      body: `Tu intento de «${activity.title}» ha sido calificado: ${score}/${activity.maxScore}`,
      link: `/activities?activityId=${activity.id}`,
    });
  }
}

/** Round to 2 decimals to avoid float noise in stored scores. */
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
