import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AuthUser } from '@/common/auth';
import { PrismaService } from '@/prisma/prisma.service';

/**
 * Authorizes access to a course after tenant isolation has been established.
 * A global TEACHER is not automatically staff in every course: staff access
 * always requires ownership or a TEACHER enrollment in that specific course.
 */
@Injectable()
export class CourseAccessService {
  constructor(private readonly prisma: PrismaService) {}

  private async courseFor(user: AuthUser, courseId: string) {
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      include: {
        enrollments: {
          where: { userId: user.userId },
          select: { role: true },
        },
      },
    });

    if (!course || course.organizationId !== user.organizationId) {
      throw new NotFoundException(`Course ${courseId} not found`);
    }

    return course;
  }

  async assertStaff(courseId: string, user: AuthUser) {
    const course = await this.courseFor(user, courseId);
    const isStaff =
      user.role === 'ADMIN' ||
      course.ownerId === user.userId ||
      course.enrollments.some(
        (enrollment) =>
          enrollment.role === 'TEACHER' || enrollment.role === 'ASSISTANT',
      );

    if (!isStaff) {
      throw new ForbiddenException('Course staff access is required');
    }

    return course;
  }

  async assertReadable(courseId: string, user: AuthUser) {
    const course = await this.courseFor(user, courseId);
    const isStaff =
      user.role === 'ADMIN' ||
      course.ownerId === user.userId ||
      course.enrollments.some(
        (enrollment) =>
          enrollment.role === 'TEACHER' || enrollment.role === 'ASSISTANT',
      );
    const isEnrolled = course.enrollments.length > 0;

    if (isStaff || (course.status === 'PUBLISHED' && isEnrolled)) {
      return course;
    }

    // Keep unpublished courses indistinguishable from absent courses to users
    // outside their staff, while returning a clear authorization error for a
    // published course that simply requires enrolment.
    if (course.status !== 'PUBLISHED') {
      throw new NotFoundException(`Course ${courseId} not found`);
    }
    throw new ForbiddenException('You must be enrolled in this course');
  }
}
