import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Subject } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CourseAccessService, SubjectAccess } from '../courses/course-access.service';
import { CreateAssignmentDto } from './dto/create-assignment.dto';
import { UpdateAssignmentDto } from './dto/update-assignment.dto';

@Injectable()
export class AssignmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: CourseAccessService,
  ) {}

  private async requireSubject(
    subjectId: string,
    actingUserId: string,
    staffOnly = false,
  ): Promise<SubjectAccess> {
    return staffOnly
      ? this.access.assertSubjectStaffForUser(subjectId, actingUserId)
      : this.access.assertSubjectReadableForUser(subjectId, actingUserId);
  }

  /**
   * Public subject gate for resources that don't hang off a single assignment
   * (gradebook, analytics). Authorization lives in CourseAccessService.
   */
  async requireCourseMembership(
    subjectId: string,
    actingUserId: string,
    staffOnly = false,
  ): Promise<{ subject: Subject; access: SubjectAccess }> {
    const access = await this.requireSubject(subjectId, actingUserId, staffOnly);
    return { subject: access.subject, access };
  }

  async requireAssignmentMembership(
    assignmentId: string,
    actingUserId: string,
    staffOnly = false,
  ) {
    const assignment = await this.prisma.assignment.findUnique({
      where: { id: assignmentId },
      include: { subject: true },
    });
    if (!assignment) {
      throw new NotFoundException(`Assignment ${assignmentId} not found`);
    }

    const access = await this.requireSubject(
      assignment.subjectId,
      actingUserId,
      staffOnly,
    );

    return { assignment, subject: assignment.subject, access };
  }

  /** Include shape shared by every read: the teacher's prompt attachments. */
  private static readonly WITH_FILES = {
    files: { include: { file: true } },
  } as const;

  /**
   * Validate that every id in `fileIds` refers to a File in this org uploaded by
   * the acting user — the same guard SubmissionsService applies to student
   * uploads, so a teacher can't attach another tenant's (or user's) file.
   */
  private async assertOwnedFiles(
    fileIds: string[],
    organizationId: string,
    uploaderId: string,
  ): Promise<void> {
    if (fileIds.length === 0) return;
    const files = await this.prisma.file.findMany({
      where: { id: { in: fileIds }, organizationId, uploaderId },
      select: { id: true },
    });
    if (files.length !== fileIds.length) {
      throw new BadRequestException(
        'One or more files are invalid or not owned by you',
      );
    }
  }

  async create(
    subjectId: string,
    actingUserId: string,
    dto: CreateAssignmentDto,
  ) {
    const { subject } = await this.requireSubject(
      subjectId,
      actingUserId,
      true,
    );

    this.assertWindow(dto.openAt, dto.dueAt, dto.closeAt);
    const fileIds = dto.fileIds ?? [];
    await this.assertOwnedFiles(fileIds, subject.organizationId, actingUserId);

    return this.prisma.assignment.create({
      data: {
        subjectId,
        title: dto.title,
        description: dto.description,
        openAt: dto.openAt ? new Date(dto.openAt) : null,
        dueAt: dto.dueAt ? new Date(dto.dueAt) : null,
        closeAt: dto.closeAt ? new Date(dto.closeAt) : null,
        // Fall back to the schema default when omitted.
        ...(dto.maxScore !== undefined && { maxScore: dto.maxScore }),
        files: { create: fileIds.map((fileId) => ({ fileId })) },
      },
      include: AssignmentsService.WITH_FILES,
    });
  }

  /** List every assignment of a course (any member), with attachments. */
  async findAll(subjectId: string, actingUserId: string) {
    await this.requireSubject(subjectId, actingUserId);

    return this.prisma.assignment.findMany({
      where: { subjectId },
      orderBy: { createdAt: 'desc' },
      include: AssignmentsService.WITH_FILES,
    });
  }

  /** A single assignment (with attachments), scoped to a member of its course. */
  async findOne(assignmentId: string, actingUserId: string) {
    await this.requireAssignmentMembership(assignmentId, actingUserId);
    return this.prisma.assignment.findUnique({
      where: { id: assignmentId },
      include: AssignmentsService.WITH_FILES,
    });
  }

  async update(
    assignmentId: string,
    actingUserId: string,
    dto: UpdateAssignmentDto,
  ) {
    const { assignment, subject } = await this.requireAssignmentMembership(
      assignmentId,
      actingUserId,
      true,
    );

    // Validate the resulting window against the merged (existing + patch) values
    // so a partial update can't leave openAt after closeAt.
    const merged = {
      openAt:
        dto.openAt !== undefined
          ? dto.openAt
            ? new Date(dto.openAt)
            : null
          : assignment.openAt,
      dueAt:
        dto.dueAt !== undefined
          ? dto.dueAt
            ? new Date(dto.dueAt)
            : null
          : assignment.dueAt,
      closeAt:
        dto.closeAt !== undefined
          ? dto.closeAt
            ? new Date(dto.closeAt)
            : null
          : assignment.closeAt,
    };
    this.assertWindow(merged.openAt, merged.dueAt, merged.closeAt);

    if (dto.fileIds !== undefined) {
      await this.assertOwnedFiles(
        dto.fileIds,
        subject.organizationId,
        actingUserId,
      );
    }

    return this.prisma.assignment.update({
      where: { id: assignmentId },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.openAt !== undefined && { openAt: merged.openAt }),
        ...(dto.dueAt !== undefined && { dueAt: merged.dueAt }),
        ...(dto.closeAt !== undefined && { closeAt: merged.closeAt }),
        ...(dto.maxScore !== undefined && { maxScore: dto.maxScore }),
        // Replace the whole attachment set when fileIds is provided.
        ...(dto.fileIds !== undefined && {
          files: {
            deleteMany: {},
            create: dto.fileIds.map((fileId) => ({ fileId })),
          },
        }),
      },
      include: AssignmentsService.WITH_FILES,
    });
  }

  async remove(assignmentId: string, actingUserId: string) {
    await this.requireAssignmentMembership(
      assignmentId,
      actingUserId,
      true,
    );

    await this.prisma.assignment.delete({ where: { id: assignmentId } });
  }

  /** Detach a single prompt attachment (staff only). Idempotent. */
  async removeFile(
    assignmentId: string,
    fileId: string,
    actingUserId: string,
  ) {
    await this.requireAssignmentMembership(
      assignmentId,
      actingUserId,
      true,
    );

    await this.prisma.assignmentFile.deleteMany({
      where: { assignmentId, fileId },
    });

    return this.prisma.assignment.findUnique({
      where: { id: assignmentId },
      include: AssignmentsService.WITH_FILES,
    });
  }

  /**
   * Guard the ordering of the submission window: openAt ≤ dueAt ≤ closeAt for
   * whichever bounds are set. Enforced here (create + update) so the invariant
   * can't be violated from either path.
   */
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
