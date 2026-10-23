import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  Activity,
  AttemptStatus,
  NotificationType,
  PublicationStatus,
  Question,
  QuestionKind,
  Prisma,
} from '@prisma/client';
import { ANALYTICS_UPDATED } from '../../analytics/analytics.events';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { ActivitiesService } from '../activities.service';
import { getAdapter } from '../blocks/registry';
import { gradeQuestion, isAutoGradable } from '../grading/graders';
import { SaveAnswersDto } from './dto/save-answers.dto';
import { GradeAttemptDto } from './dto/grade-attempt.dto';

type AttemptWithAnswers = Prisma.AttemptGetPayload<{
  include: { answers: true };
}>;
type ActivityWithQuestions = Activity & { questions: Question[] };

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
    const { activity } = await this.requireStudentActivity(
      activityId,
      actingUserId,
      true,
    );
    const attempt = await this.startOrResumeAttempt(activity, actingUserId);
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

    const questions = new Map(
      attempt.activity.questions.map((question) => [question.id, question]),
    );
    for (const a of dto.answers) {
      const question = questions.get(a.questionId);
      if (!question) {
        throw new BadRequestException(
          `La pregunta ${a.questionId} no pertenece a esta actividad`,
        );
      }
      const adapter = getAdapter(question.kind);
      adapter.validateContent(question.content);
      adapter.validateResponse(a.response);
      if (question.kind === QuestionKind.FILE_UPLOAD) {
        await this.validateFileUploadResponse(
          question,
          a.response,
          attempt.activity.subject.organizationId,
          actingUserId,
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
    const { activity } = await this.requireStudentActivity(
      activityId,
      actingUserId,
      false,
    );
    const attempts = await this.prisma.attempt.findMany({
      where: { activityId, userId: actingUserId },
      orderBy: { attemptNo: 'asc' },
      include: { answers: true },
    });
    return attempts.map((attempt) =>
      this.projectStudentAttempt(attempt, activity),
    );
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
            subject: { select: { organizationId: true } },
            questions: { orderBy: { order: 'asc' } },
          },
        },
      },
    });
    if (!attempt) throw new NotFoundException(`Attempt ${attemptId} not found`);
    if (attempt.userId !== actingUserId) {
      throw new ForbiddenException('No es tu intento');
    }
    await this.requireStudentActivity(attempt.activityId, actingUserId, true);
    return attempt;
  }

  /** Attempt + explicit student projection; answer results are only revealed
   * when the attempt is graded and the activity allows showing solutions. */
  private async studentView(attemptId: string, actingUserId: string) {
    const attempt = await this.prisma.attempt.findUnique({
      where: { id: attemptId },
      include: {
        answers: true,
        activity: {
          include: {
            subject: { select: { organizationId: true } },
            questions: { orderBy: { order: 'asc' } },
          },
        },
      },
    });
    if (!attempt) throw new NotFoundException(`Attempt ${attemptId} not found`);
    if (attempt.userId !== actingUserId) {
      throw new ForbiddenException('No es tu intento');
    }
    await this.requireStudentActivity(attempt.activityId, actingUserId, false);

    return this.projectStudentAttempt(
      attempt,
      attempt.activity,
      attempt.activity,
    );
  }

  private projectStudentAttempt(
    attempt: AttemptWithAnswers,
    activity: Activity,
    activityWithQuestions?: ActivityWithQuestions,
  ) {
    const cfg = (activity.config ?? {}) as Record<string, unknown>;
    const reveal =
      cfg.showSolutions === true && attempt.status === AttemptStatus.GRADED;

    const studentAttempt = {
      id: attempt.id,
      activityId: attempt.activityId,
      userId: attempt.userId,
      attemptNo: attempt.attemptNo,
      status: attempt.status,
      startedAt: attempt.startedAt,
      submittedAt: attempt.submittedAt,
      score: attempt.status === AttemptStatus.GRADED ? attempt.score : null,
      gradedAt: attempt.gradedAt,
      // The teacher's comment is shown as soon as the attempt is graded; only
      // the per-answer verdicts depend on `showSolutions`.
      ...(attempt.status === AttemptStatus.GRADED && {
        feedback: attempt.feedback,
      }),
      answers: attempt.answers.map((answer) => ({
        id: answer.id,
        attemptId: answer.attemptId,
        questionId: answer.questionId,
        response: answer.response,
        ...(reveal && {
          correct: answer.correct,
          awarded: answer.awarded,
        }),
      })),
    };

    if (!activityWithQuestions) return studentAttempt;
    return {
      ...studentAttempt,
      activity: {
        id: activityWithQuestions.id,
        subjectId: activityWithQuestions.subjectId,
        type: activityWithQuestions.type,
        title: activityWithQuestions.title,
        description: activityWithQuestions.description,
        openAt: activityWithQuestions.openAt,
        dueAt: activityWithQuestions.dueAt,
        closeAt: activityWithQuestions.closeAt,
        maxScore: activityWithQuestions.maxScore,
        attemptsAllowed: activityWithQuestions.attemptsAllowed,
        timeLimitSec: activityWithQuestions.timeLimitSec,
        config: activityWithQuestions.config,
        status: activityWithQuestions.status,
        countsTowardFinal: activityWithQuestions.countsTowardFinal,
        templateId: activityWithQuestions.templateId,
        createdAt: activityWithQuestions.createdAt,
        updatedAt: activityWithQuestions.updatedAt,
        questions: activityWithQuestions.questions.map((question) => ({
          id: question.id,
          activityId: question.activityId,
          kind: question.kind,
          prompt: question.prompt,
          points: question.points,
          order: question.order,
          content: reveal
            ? question.content
            : ActivitiesService.stripAnswerKey(question.kind, question.content),
          createdAt: question.createdAt,
          updatedAt: question.updatedAt,
        })),
      },
    };
  }

  private async requireStudentActivity(
    activityId: string,
    actingUserId: string,
    checkWindow: boolean,
  ) {
    const required = await this.activities.requireActivity(
      activityId,
      actingUserId,
    );
    if (!required.access.isMember) {
      throw new ForbiddenException('Debes estar matriculado en este curso');
    }
    if (required.activity.status !== PublicationStatus.PUBLISHED) {
      throw new NotFoundException(`Activity ${activityId} not found`);
    }
    if (checkWindow) this.assertOpenWindow(required.activity);
    return required;
  }

  private assertOpenWindow(activity: Activity) {
    const now = new Date();
    if (activity.openAt && now < activity.openAt) {
      throw new BadRequestException('La actividad aún no está abierta');
    }
    if (activity.closeAt && now > activity.closeAt) {
      throw new BadRequestException('La actividad está cerrada');
    }
  }

  private async startOrResumeAttempt(activity: Activity, actingUserId: string) {
    const maxRetries = 3;
    for (let retry = 0; retry <= maxRetries; retry += 1) {
      try {
        return await this.prisma.$transaction(
          async (tx) => {
            const inProgress = await tx.attempt.findFirst({
              where: {
                activityId: activity.id,
                userId: actingUserId,
                status: AttemptStatus.IN_PROGRESS,
              },
            });
            if (inProgress) return inProgress;

            const used = await tx.attempt.count({
              where: { activityId: activity.id, userId: actingUserId },
            });
            if (activity.attemptsAllowed > 0 && used >= activity.attemptsAllowed) {
              throw new BadRequestException(
                'No quedan intentos disponibles para esta actividad',
              );
            }

            return tx.attempt.create({
              data: {
                activityId: activity.id,
                userId: actingUserId,
                attemptNo: used + 1,
                status: AttemptStatus.IN_PROGRESS,
              },
            });
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        );
      } catch (error) {
        if (!this.isStartConflict(error)) throw error;

        const inProgress = await this.prisma.attempt.findFirst({
          where: {
            activityId: activity.id,
            userId: actingUserId,
            status: AttemptStatus.IN_PROGRESS,
          },
        });
        if (inProgress) return inProgress;
        if (retry === maxRetries) {
          throw new ConflictException(
            'No se pudo abrir el intento de forma concurrente',
          );
        }
      }
    }
    throw new ConflictException('No se pudo abrir el intento');
  }

  private isStartConflict(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      ['P2002', 'P2034'].includes(String((error as { code: unknown }).code))
    );
  }

  private async validateFileUploadResponse(
    question: Question,
    response: Record<string, unknown>,
    organizationId: string,
    actingUserId: string,
  ) {
    const content = question.content as Record<string, unknown>;
    const fileIds = response.fileIds as string[];
    const maxFiles = content.maxFiles as number;
    if (fileIds.length > maxFiles) {
      throw new BadRequestException(
        `No puedes adjuntar más de ${maxFiles} fichero(s)`,
      );
    }

    const files = fileIds.length
      ? await this.prisma.file.findMany({
          where: {
            id: { in: fileIds },
            organizationId,
            uploaderId: actingUserId,
          },
          select: { id: true, originalName: true, contentType: true },
        })
      : [];
    if (files.length !== fileIds.length) {
      throw new BadRequestException('Uno o más ficheros no son válidos');
    }

    const acceptedTypes = Array.isArray(content.accept)
      ? content.accept.filter((entry): entry is string => typeof entry === 'string')
      : [];
    if (
      acceptedTypes.length > 0 &&
      files.some((file) => !this.isAcceptedFile(file, acceptedTypes))
    ) {
      throw new BadRequestException(
        'Uno o más ficheros no cumplen el tipo permitido',
      );
    }
  }

  private isAcceptedFile(
    file: { originalName: string; contentType: string | null },
    acceptedTypes: string[],
  ) {
    const mimeType = file.contentType?.toLowerCase() ?? '';
    const fileName = file.originalName.toLowerCase();
    return acceptedTypes.some((accepted) => {
      const rule = accepted.trim().toLowerCase();
      if (rule.startsWith('.')) return fileName.endsWith(rule);
      if (rule.endsWith('/*')) return mimeType.startsWith(rule.slice(0, -1));
      return mimeType === rule;
    });
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
