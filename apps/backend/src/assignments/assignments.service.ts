import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Course, CourseRole, Enrollment } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAssignmentDto } from './dto/create-assignment.dto';
import { UpdateAssignmentDto } from './dto/update-assignment.dto';

/** Course roles allowed to author/grade — teacher or teaching assistant. */
export const STAFF_ROLES: CourseRole[] = [
  CourseRole.TEACHER,
  CourseRole.ASSISTANT,
];

@Injectable()
export class AssignmentsService {
  constructor(private readonly prisma: PrismaService) {}

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
      throw new ForbiddenException(
        'Only course staff can perform this action',
      );
    }

    return { course, enrollment };
  }

  /**
   * Public course-membership gate for course-level resources that don't hang
   * off a single assignment (e.g. the gradebook). Delegates to the private
   * {@link requireMembership} so tenant/role enforcement stays in one place.
   */
  async requireCourseMembership(
    courseId: string,
    actingUserId: string,
    roles?: CourseRole[],
  ): Promise<{ course: Course; enrollment: Enrollment }> {
    return this.requireMembership(courseId, actingUserId, roles);
  }

  /**
   * Load an assignment and enforce that `actingUserId` is a member of its
   * course. Returns the assignment plus the parent course (for its org).
   */
  async requireAssignmentMembership(
    assignmentId: string,
    actingUserId: string,
    roles?: CourseRole[],
  ) {
    const assignment = await this.prisma.assignment.findUnique({
      where: { id: assignmentId },
      include: { course: true },
    });
    if (!assignment) {
      throw new NotFoundException(`Assignment ${assignmentId} not found`);
    }

    const { enrollment } = await this.requireMembership(
      assignment.courseId,
      actingUserId,
      roles,
    );

    return { assignment, course: assignment.course, enrollment };
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
    courseId: string,
    actingUserId: string,
    dto: CreateAssignmentDto,
  ) {
    const { course } = await this.requireMembership(
      courseId,
      actingUserId,
      STAFF_ROLES,
    );

    this.assertWindow(dto.openAt, dto.dueAt, dto.closeAt);
    const fileIds = dto.fileIds ?? [];
    await this.assertOwnedFiles(fileIds, course.organizationId, actingUserId);

    return this.prisma.assignment.create({
      data: {
        courseId,
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
  async findAll(courseId: string, actingUserId: string) {
    await this.requireMembership(courseId, actingUserId);

    return this.prisma.assignment.findMany({
      where: { courseId },
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
    const { assignment, course } = await this.requireAssignmentMembership(
      assignmentId,
      actingUserId,
      STAFF_ROLES,
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
        course.organizationId,
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
      STAFF_ROLES,
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
      STAFF_ROLES,
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
