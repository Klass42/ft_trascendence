import {
  BadRequestException,
  Injectable,
} from '@nestjs/common';
import { SubmissionStatus, NotificationType, type Subject } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { AssignmentsService } from '../assignments.service';
import { CreateSubmissionDto } from './dto/create-submission.dto';

@Injectable()
export class SubmissionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly assignments: AssignmentsService,
    private readonly notifications: NotificationsService,
  ) {}

  /**
   * Create or update the acting user's submission for an assignment.
   *
   * Unique per `(assignment, user)` — a resubmission upserts the same row.
   * Status is derived server-side: DRAFT stays DRAFT; otherwise LATE when the
   * assignment's `dueAt` has already passed, else SUBMITTED. On first reaching a
   * submitted state we notify the course staff.
   */
  async submit(
    assignmentId: string,
    actingUserId: string,
    dto: CreateSubmissionDto,
  ) {
    // Any member of the course may submit (typically a student).
    const { assignment, subject } =
      await this.assignments.requireAssignmentMembership(
        assignmentId,
        actingUserId,
      );

    const isDraft = dto.status === SubmissionStatus.DRAFT;
    const now = new Date();

    // Enforce the submission window on real submissions (drafts may always be
    // saved so a student can keep working before the assignment opens). openAt
    // and closeAt are the hard bounds; dueAt only marks lateness (below).
    if (!isDraft) {
      if (assignment.openAt && now < assignment.openAt) {
        throw new BadRequestException('La tarea aún no está abierta');
      }
      if (assignment.closeAt && now > assignment.closeAt) {
        throw new BadRequestException('La tarea está cerrada');
      }
    }

    const isLate = !isDraft && !!assignment.dueAt && assignment.dueAt < now;
    const status = isDraft
      ? SubmissionStatus.DRAFT
      : isLate
        ? SubmissionStatus.LATE
        : SubmissionStatus.SUBMITTED;

    // Validate the referenced files up front: they must already exist and
    // belong to this org AND have been uploaded by the acting user, so a
    // submission can't hijack someone else's (or another tenant's) file.
    const fileIds = dto.fileIds ?? [];
    if (fileIds.length > 0) {
      const files = await this.prisma.file.findMany({
        where: {
          id: { in: fileIds },
          organizationId: subject.organizationId,
          uploaderId: actingUserId,
        },
        select: { id: true },
      });
      if (files.length !== fileIds.length) {
        throw new BadRequestException(
          'Uno o más archivos no son válidos o no son tuyos.',
        );
      }
    }

    const existing = await this.prisma.submission.findUnique({
      where: {
        assignmentId_userId: { assignmentId, userId: actingUserId },
      },
      select: { id: true, status: true },
    });

    const submission = await this.prisma.submission.upsert({
      where: {
        assignmentId_userId: { assignmentId, userId: actingUserId },
      },
      create: {
        assignmentId,
        userId: actingUserId,
        text: dto.text,
        status,
        files: {
          create: fileIds.map((fileId) => ({ fileId })),
        },
      },
      update: {
        text: dto.text,
        status,
        files: {
          // Replace the file set on every save so the submission reflects
          // exactly what the student currently attached.
          deleteMany: {},
          create: fileIds.map((fileId) => ({ fileId })),
        },
      },
      include: { files: { include: { file: true } } },
    });

    // Notify staff only on the transition into a submitted state (not for
    // draft saves, and not repeatedly if it was already submitted).
    const wasSubmitted =
      existing?.status === SubmissionStatus.SUBMITTED ||
      existing?.status === SubmissionStatus.LATE;
    if (!isDraft && !wasSubmitted) {
      await this.notifyStaff(subject, actingUserId, assignment.title);
    }

    return submission;
  }

  /** All submissions for an assignment (course staff only). */
  async listForAssignment(assignmentId: string, actingUserId: string) {
    await this.assignments.requireAssignmentMembership(
      assignmentId,
      actingUserId,
      true,
    );

    return this.prisma.submission.findMany({
      where: { assignmentId },
      orderBy: { updatedAt: 'desc' },
      include: {
        files: { include: { file: true } },
        user: { select: { id: true, name: true, email: true, avatarUrl: true } },
      },
    });
  }

  /** The acting user's own submission for an assignment, or null. */
  async findMine(assignmentId: string, actingUserId: string) {
    await this.assignments.requireAssignmentMembership(
      assignmentId,
      actingUserId,
    );

    return this.prisma.submission.findUnique({
      where: {
        assignmentId_userId: { assignmentId, userId: actingUserId },
      },
      include: { files: { include: { file: true } } },
    });
  }

  /** Emit NEW_ASSIGNMENT to every staff member of the course except the author. */
  private async notifyStaff(
    subject: Subject,
    authorId: string,
    assignmentTitle: string,
  ) {
    await this.notifications.emitMany(
      async () => {
        const staff = await this.prisma.subjectStaff.findMany({
          where: {
            subjectId: subject.id,
            subject: { organizationId: subject.organizationId },
            user: { organizationId: subject.organizationId },
            userId: { not: authorId },
          },
          select: { userId: true },
        });
        return staff.map(({ userId }) => userId);
      },
      NotificationType.SUBMISSION_RECEIVED,
      {
        title: 'Nueva entrega',
        body: `Un alumno entregó «${assignmentTitle}»`,
        link: `/courses/${subject.courseId}/subjects/${subject.id}`,
      },
      { organizationId: subject.organizationId, actorId: authorId },
    );
  }
}
