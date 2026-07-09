import {
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

  async create(
    courseId: string,
    actingUserId: string,
    dto: CreateAssignmentDto,
  ) {
    await this.requireMembership(courseId, actingUserId, STAFF_ROLES);

    return this.prisma.assignment.create({
      data: {
        courseId,
        title: dto.title,
        description: dto.description,
        dueAt: dto.dueAt ? new Date(dto.dueAt) : null,
        // Fall back to the schema default when omitted.
        ...(dto.maxScore !== undefined && { maxScore: dto.maxScore }),
      },
    });
  }

  /** List every assignment of a course (any member). */
  async findAll(courseId: string, actingUserId: string) {
    await this.requireMembership(courseId, actingUserId);

    return this.prisma.assignment.findMany({
      where: { courseId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** A single assignment, scoped to a member of its course. */
  async findOne(assignmentId: string, actingUserId: string) {
    const { assignment } = await this.requireAssignmentMembership(
      assignmentId,
      actingUserId,
    );
    return assignment;
  }

  async update(
    assignmentId: string,
    actingUserId: string,
    dto: UpdateAssignmentDto,
  ) {
    await this.requireAssignmentMembership(
      assignmentId,
      actingUserId,
      STAFF_ROLES,
    );

    return this.prisma.assignment.update({
      where: { id: assignmentId },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.dueAt !== undefined && {
          dueAt: dto.dueAt ? new Date(dto.dueAt) : null,
        }),
        ...(dto.maxScore !== undefined && { maxScore: dto.maxScore }),
      },
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
}
