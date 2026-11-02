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
import { gradeResponses } from '../grading/grade-responses';
import { SaveAnswersDto } from './dto/save-answers.dto';
import { GradeAttemptDto } from './dto/grade-attempt.dto';

type AttemptWithAnswers = Prisma.AttemptGetPayload<{
  include: { answers: true };
}>;
type ActivityWithQuestions = Activity & { questions: Question[] };
type ActivityWithSubject = Activity & { subject: { organizationId: string } };

/** Extra time after an attempt's `expiresAt` during which the server still
 * accepts the client's final autosave + submit. It absorbs network latency and
 * clock rounding so a learner who submits "at 00:00" does not lose work. Past
 * it, saving is rejected and the attempt is closed with what was already saved. */
export const TIME_LIMIT_GRACE_MS = 30_000;

/** Attempts may be closed by retrying a few serialization conflicts. */
const FINALIZE_MAX_RETRIES = 3;

function responseFileIds(response: unknown): string[] {
  if (!response || typeof response !== 'object' || Array.isArray(response)) {
    return [];
  }
  const fileIds = (response as Record<string, unknown>).fileIds;
  return Array.isArray(fileIds)
    ? fileIds.filter((fileId): fileId is string => typeof fileId === 'string')
    : [];
}

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
      false,
    );
    // A timed attempt left open past its deadline is closed first, so it neither
    // gets "resumed" nor blocks a new attempt — even if the window has closed.
    await this.closeExpiredInProgress(activity, actingUserId);
    this.assertOpenWindow(activity);
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
    const expiresAt = this.expiryOf(attempt, attempt.activity);
    // Timed attempts are bounded by their own deadline (already capped by
    // `closeAt`); untimed ones keep the plain open/close window.
    if (!expiresAt) this.assertOpenWindow(attempt.activity);
    if (attempt.status !== AttemptStatus.IN_PROGRESS) {
      throw new BadRequestException('El intento ya fue enviado');
    }
    if (expiresAt && this.isPastGrace(expiresAt)) {
      await this.finalizeAndNotify(attempt.id, expiresAt);
      throw new BadRequestException(
        'Se agotó el tiempo del intento; se ha enviado con las respuestas ya guardadas.',
      );
    }

    const questions = new Map(
      attempt.activity.questions.map((question) => [question.id, question]),
    );
    for (const a of dto.answers) {
      const question = questions.get(a.questionId);
      if (!question) {
        throw new BadRequestException(
          `La pregunta ${a.questionId} no pertenece a esta tarea`,
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

  /** Submit an attempt (see `finalizeAttempt`). With a time limit the request
   * is accepted until `expiresAt` + grace; later, it still finalises the attempt
   * with the answers saved before the deadline. */
  async submit(attemptId: string, actingUserId: string) {
    const attempt = await this.loadOwnedAttempt(attemptId, actingUserId);
    const expiresAt = this.expiryOf(attempt, attempt.activity);
    if (!expiresAt) this.assertOpenWindow(attempt.activity);
    if (attempt.status !== AttemptStatus.IN_PROGRESS) {
      throw new BadRequestException('El intento ya fue enviado');
    }

    // A late request still finalises the attempt (the learner does not lose the
    // work already saved); `submit` carries no payload, so nothing sent after
    // the deadline can alter the answers. Past the grace period the submission
    // is stamped at the deadline instead of "now".
    const submittedAt =
      expiresAt && this.isPastGrace(expiresAt) ? expiresAt : new Date();
    await this.finalizeAndNotify(attemptId, submittedAt);
    return this.studentView(attemptId, actingUserId);
  }

  /** One of the acting user's own attempts with its activity (questions, and
   * answer keys only when `showSolutions` allows it on a graded attempt). */
  async getMine(attemptId: string, actingUserId: string) {
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
    await this.closeExpiredInProgress(activity, actingUserId);
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
    const { activity, subject } = await this.activities.requireActivity(
      activityId,
      actingUserId,
      true,
    );
    // Abandoned timed attempts would otherwise stay "in progress" (and
    // ungradable) forever if the learner never comes back.
    await this.closeExpiredInProgress(activity);
    const attempts = await this.prisma.attempt.findMany({
      where: {
        activityId,
        activity: {
          is: { subject: { is: { organizationId: subject.organizationId } } },
        },
      },
      orderBy: [{ userId: 'asc' }, { attemptNo: 'asc' }],
      include: {
        answers: { include: { question: { select: { kind: true } } } },
        user: { select: { id: true, name: true, email: true, avatarUrl: true } },
      },
    });
    const fileIds = [
      ...new Set(
        attempts.flatMap((attempt) =>
          attempt.answers.flatMap((answer) =>
            answer.question.kind === QuestionKind.FILE_UPLOAD
              ? responseFileIds(answer.response)
              : [],
          ),
        ),
      ),
    ];
    const files = fileIds.length
      ? await this.prisma.file.findMany({
          where: { id: { in: fileIds }, organizationId: subject.organizationId },
          select: { id: true, originalName: true },
        })
      : [];
    const filesById = new Map(files.map((file) => [file.id, file]));

    return attempts.map((attempt) => ({
      ...attempt,
      answers: attempt.answers.map((answer) => {
        const { question, ...answerData } = answer;
        if (question.kind !== QuestionKind.FILE_UPLOAD) return answerData;
        const answerFiles = responseFileIds(answer.response).flatMap((id) => {
          const file = filesById.get(id);
          return file ? [file] : [];
        });
        return { ...answerData, files: answerFiles };
      }),
    }));
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
    if (!attempt) throw new NotFoundException('Intento no encontrado.');
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
          `La pregunta ${item.questionId} no pertenece a esta tarea`,
        );
      }
      if (item.awarded === undefined && item.feedback === undefined) {
        throw new BadRequestException(
          `Indica la nota o un comentario para la pregunta ${item.questionId}`,
        );
      }
      if (item.awarded !== undefined && item.awarded > question.points) {
        throw new BadRequestException(
          `La nota no puede superar ${question.points}`,
        );
      }
    }

    for (const item of dto.answers) {
      const feedback =
        item.feedback === undefined ? undefined : item.feedback.trim() || null;
      const patch = {
        ...(item.awarded !== undefined && { awarded: item.awarded }),
        ...(feedback !== undefined && { feedback }),
      };
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
          ...patch,
        },
        update: patch,
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
        attempt.attemptNo,
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
    if (!attempt) throw new NotFoundException('Intento no encontrado.');
    if (attempt.userId !== actingUserId) {
      throw new ForbiddenException('No es tu intento');
    }
    // The open/close window is checked by the callers: timed attempts are
    // governed by their own deadline instead (see `expiryOf`).
    await this.requireStudentActivity(attempt.activityId, actingUserId, false);
    return attempt;
  }

  /** Attempt + explicit student projection; answer results are only revealed
   * when the attempt is graded and the activity allows showing solutions. */
  private async studentView(attemptId: string, actingUserId: string) {
    const load = () =>
      this.prisma.attempt.findUnique({
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
    let attempt = await load();
    if (!attempt) throw new NotFoundException('Intento no encontrado.');
    if (attempt.userId !== actingUserId) {
      throw new ForbiddenException('No es tu intento');
    }
    await this.requireStudentActivity(attempt.activityId, actingUserId, false);

    // Reading a timed attempt whose deadline passed closes it first.
    const expiresAt = this.expiryOf(attempt, attempt.activity);
    if (
      attempt.status === AttemptStatus.IN_PROGRESS &&
      expiresAt &&
      this.isPastGrace(expiresAt)
    ) {
      await this.finalizeAndNotify(attempt.id, expiresAt);
      attempt = await load();
      if (!attempt) throw new NotFoundException('Intento no encontrado.');
    }

    const projected = this.projectStudentAttempt(
      attempt,
      attempt.activity,
      attempt.activity,
    );
    // The learner may see the names of their own uploads (never someone else's,
    // never another organization's) so the review can say what was delivered.
    const kinds = new Map(
      attempt.activity.questions.map((question) => [question.id, question.kind]),
    );
    const fileIds = [
      ...new Set(
        attempt.answers.flatMap((answer) =>
          kinds.get(answer.questionId) === QuestionKind.FILE_UPLOAD
            ? responseFileIds(answer.response)
            : [],
        ),
      ),
    ];
    if (!fileIds.length) return projected;
    const files = await this.prisma.file.findMany({
      where: {
        id: { in: fileIds },
        organizationId: attempt.activity.subject.organizationId,
        uploaderId: actingUserId,
      },
      select: { id: true, originalName: true },
    });
    const filesById = new Map(files.map((file) => [file.id, file]));
    return {
      ...projected,
      answers: projected.answers.map((answer) =>
        kinds.get(answer.questionId) === QuestionKind.FILE_UPLOAD
          ? {
              ...answer,
              files: responseFileIds(answer.response).flatMap((id) => {
                const file = filesById.get(id);
                return file ? [file] : [];
              }),
            }
          : answer,
      ),
    };
  }

  private projectStudentAttempt(
    attempt: AttemptWithAnswers,
    activity: Activity,
    activityWithQuestions?: ActivityWithQuestions,
  ) {
    const cfg = (activity.config ?? {}) as Record<string, unknown>;
    const reveal =
      cfg.showSolutions === true && attempt.status === AttemptStatus.GRADED;

    const expiresAt =
      attempt.status === AttemptStatus.IN_PROGRESS
        ? this.expiryOf(attempt, activity)
        : null;

    const studentAttempt = {
      id: attempt.id,
      activityId: attempt.activityId,
      userId: attempt.userId,
      attemptNo: attempt.attemptNo,
      status: attempt.status,
      startedAt: attempt.startedAt,
      submittedAt: attempt.submittedAt,
      // Server-side deadline of a timed, in-progress attempt (null otherwise).
      // `serverNow` lets the client correct for its own clock offset.
      expiresAt,
      ...(expiresAt && { serverNow: new Date() }),
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
        // Like the attempt-level comment, a per-question comment is not a
        // solution: it is not gated by `showSolutions`, only by publication.
        ...(attempt.status === AttemptStatus.GRADED && {
          feedback: answer.feedback,
        }),
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
      throw new ForbiddenException('Debes estar matriculado en esta cohorte.');
    }
    if (required.activity.status !== PublicationStatus.PUBLISHED) {
      throw new NotFoundException('Tarea no encontrada.');
    }
    if (checkWindow) this.assertOpenWindow(required.activity);
    return required;
  }

  private assertOpenWindow(activity: Activity) {
    const now = new Date();
    if (activity.openAt && now < activity.openAt) {
      throw new BadRequestException('La tarea aún no está abierta.');
    }
    if (activity.closeAt && now > activity.closeAt) {
      throw new BadRequestException('La tarea está cerrada.');
    }
  }

  // ─── Time limit ───────────────────────────────────────────────────────────

  /** Server deadline of an attempt: `startedAt + timeLimitSec`, capped by the
   * activity's `closeAt`. `null` when the activity has no time limit (those keep
   * the plain open/close window check). */
  private expiryOf(
    attempt: { startedAt: Date },
    activity: Pick<Activity, 'timeLimitSec' | 'closeAt'>,
  ): Date | null {
    if (!activity.timeLimitSec) return null;
    const byLimit = attempt.startedAt.getTime() + activity.timeLimitSec * 1000;
    const closeAt = activity.closeAt?.getTime();
    return new Date(closeAt === undefined ? byLimit : Math.min(byLimit, closeAt));
  }

  private isPastGrace(expiresAt: Date): boolean {
    return Date.now() > expiresAt.getTime() + TIME_LIMIT_GRACE_MS;
  }

  /** Close (auto-submit with the saved answers) every IN_PROGRESS attempt of
   * the activity whose deadline + grace passed; scoped to one learner when
   * `userId` is given. A no-op for untimed activities. */
  private async closeExpiredInProgress(activity: Activity, userId?: string) {
    if (!activity.timeLimitSec) return;
    const open = await this.prisma.attempt.findMany({
      where: {
        activityId: activity.id,
        status: AttemptStatus.IN_PROGRESS,
        ...(userId && { userId }),
      },
    });
    for (const attempt of open) {
      if (attempt.status !== AttemptStatus.IN_PROGRESS) continue;
      const expiresAt = this.expiryOf(attempt, activity);
      if (expiresAt && this.isPastGrace(expiresAt)) {
        await this.finalizeAndNotify(attempt.id, expiresAt);
      }
    }
  }

  /** Finalise an attempt: auto-grade every objective question, compute the
   * scaled score, and either mark it GRADED (fully objective → notify) or leave
   * it SUBMITTED awaiting manual grading (has subjective questions). Shared by
   * the learner's submit and the lazy close of expired attempts. */
  private async finalizeAndNotify(attemptId: string, submittedAt: Date) {
    const done = await this.finalizeAttempt(attemptId, submittedAt);
    if (!done) return; // already closed by a concurrent request
    const { activity, attempt, grade } = done;
    this.events.emit(ANALYTICS_UPDATED, {
      courseId: activity.subjectId,
      organizationId: activity.subject.organizationId,
    });
    if (!grade.hasManual) {
      await this.notifyGraded(
        attempt.userId,
        activity,
        grade.score,
        attempt.attemptNo,
      );
    } else {
      await this.notifySubmitted(attempt.userId, activity, attemptId);
    }
  }

  /** Grades from the answers stored *inside* the transaction, so a save that
   * raced with the close is either included or rejected, never half-counted.
   * Returns null if the attempt was no longer IN_PROGRESS. */
  private async finalizeAttempt(attemptId: string, submittedAt: Date) {
    for (let retry = 0; retry <= FINALIZE_MAX_RETRIES; retry += 1) {
      try {
        return await this.prisma.$transaction(
          async (tx) => {
            const attempt = await tx.attempt.findUnique({
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
            if (!attempt || attempt.status !== AttemptStatus.IN_PROGRESS) {
              return null;
            }

            const { activity } = attempt;
            const answersByQ = new Map(
              attempt.answers.map((a) => [a.questionId, a]),
            );
            const grade = gradeResponses(
              activity.questions,
              attempt.answers.map((answer) => ({
                questionId: answer.questionId,
                response: answer.response,
              })),
              activity.maxScore,
            );
            const gradesByQuestion = new Map(
              grade.results.map((result) => [result.questionId, result]),
            );

            for (const q of activity.questions) {
              const answer = answersByQ.get(q.id);
              const result = gradesByQuestion.get(q.id);
              // Manual work remains pending for staff.
              if (!result?.autoGradable) continue;
              if (answer) {
                await tx.answer.update({
                  where: { id: answer.id },
                  data: {
                    correct: result.correct ?? false,
                    awarded: result.awarded ?? 0,
                  },
                });
              } else {
                // No saved answer for an objective question → 0, recorded so
                // the student's result is complete.
                await tx.answer.create({
                  data: {
                    attemptId,
                    questionId: q.id,
                    response: {} as Prisma.InputJsonValue,
                    correct: false,
                    awarded: 0,
                  },
                });
              }
            }

            await tx.attempt.update({
              where: { id: attemptId },
              data: grade.hasManual
                ? { status: AttemptStatus.SUBMITTED, submittedAt }
                : {
                    status: AttemptStatus.GRADED,
                    submittedAt,
                    gradedAt: new Date(),
                    score: grade.score,
                  },
            });
            return { attempt, activity, grade };
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        );
      } catch (error) {
        if (!this.isStartConflict(error)) throw error;
        if (retry === FINALIZE_MAX_RETRIES) {
          throw new ConflictException(
            'No se pudo cerrar el intento de forma concurrente',
          );
        }
      }
    }
    throw new ConflictException('No se pudo cerrar el intento');
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
                'No quedan intentos disponibles para esta tarea.',
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
        `No puedes adjuntar más de ${maxFiles} ${maxFiles === 1 ? 'archivo' : 'archivos'}`,
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
      throw new BadRequestException('Uno o más archivos no son válidos.');
    }

    const acceptedTypes = Array.isArray(content.accept)
      ? content.accept.filter((entry): entry is string => typeof entry === 'string')
      : [];
    if (
      acceptedTypes.length > 0 &&
      files.some((file) => !this.isAcceptedFile(file, acceptedTypes))
    ) {
      throw new BadRequestException(
        'Uno o más archivos no cumplen el tipo permitido.',
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

  /** Tell the subject's staff that an attempt is waiting for manual grading. */
  private async notifySubmitted(
    studentId: string,
    activity: ActivityWithSubject,
    attemptId: string,
  ) {
    const student = await this.prisma.user
      .findUnique({ where: { id: studentId }, select: { name: true } })
      .catch(() => null);
    await this.notifications.emitMany(
      async () =>
        (
          await this.prisma.subjectStaff.findMany({
            where: {
              subjectId: activity.subjectId,
              subject: { organizationId: activity.subject.organizationId },
            },
            select: { userId: true },
          })
        ).map((staff) => staff.userId),
      NotificationType.SUBMISSION_RECEIVED,
      {
        title: 'Nueva entrega para corregir',
        body: `${student?.name ?? 'Un alumno'} ha entregado «${activity.title}»`,
        link: `/grades?subjectId=${activity.subjectId}&activityId=${activity.id}&attemptId=${attemptId}`,
      },
      { organizationId: activity.subject.organizationId, actorId: studentId },
    );
  }

  private async notifyGraded(
    userId: string,
    activity: Activity,
    score: number,
    attemptNo: number,
  ) {
    await this.notifications.emit(userId, NotificationType.GRADE_PUBLISHED, {
      title: 'Tarea calificada',
      body: `Tu intento ${attemptNo} de «${activity.title}» ha sido calificado: ${score}/${activity.maxScore}`,
      link: `/activities?activityId=${activity.id}`,
    });
  }
}

/** Round to 2 decimals to avoid float noise in stored scores. */
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
