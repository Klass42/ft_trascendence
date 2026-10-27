import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Course, Subject, SubjectStaffRole } from '@prisma/client';
import { AuthUser } from '@/common/auth';
import { PrismaService } from '@/prisma/prisma.service';

export interface SubjectAccess {
  subject: Subject & { course: Course };
  /** True for an org admin or a SubjectStaff row (TEACHER or ASSISTANT). */
  isStaff: boolean;
  staffRole: SubjectStaffRole | null;
  isMember: boolean;
}

/**
 * Authorizes cohort and subject access after tenant isolation.
 * A global TEACHER is not staff of every subject: staff access always
 * requires an org-admin role or a SubjectStaff row on that subject.
 *
 * Missing rows and other tenants are NotFound. A published subject the
 * caller does not belong to is Forbidden. An unpublished subject is
 * NotFound for anyone who is not staff.
 */
@Injectable()
export class CourseAccessService {
  constructor(private readonly prisma: PrismaService) {}

  async assertCourseReadable(courseId: string, user: AuthUser): Promise<Course> {
    const course = await this.prisma.course.findFirst({
      where: { id: courseId, organizationId: user.organizationId },
    });
    if (!course) {
      throw new NotFoundException('Cohorte no encontrada.');
    }
    if (user.role === 'ADMIN' || await this.canReadCourse(course.id, user)) {
      return course;
    }
    throw new ForbiddenException('No tienes acceso a esta cohorte.');
  }

  async assertSubjectReadable(subjectId: string, user: AuthUser): Promise<SubjectAccess> {
    const loaded = await this.loadSubject(subjectId, user);
    if (loaded.isStaff) return loaded;
    if (loaded.subject.status !== 'PUBLISHED') {
      throw new NotFoundException('Asignatura no encontrada.');
    }
    if (!loaded.isMember) {
      throw new ForbiddenException('Debes estar matriculado en esta cohorte.');
    }
    return loaded;
  }

  async assertSubjectStaff(subjectId: string, user: AuthUser): Promise<SubjectAccess> {
    const loaded = await this.loadSubject(subjectId, user);
    if (!loaded.isStaff) {
      throw new ForbiddenException('Solo el profesorado de la asignatura puede hacer esto.');
    }
    return loaded;
  }

  /** Modules that only have a user id load the account, then apply the same rules. */
  async assertSubjectReadableForUser(subjectId: string, userId: string): Promise<SubjectAccess> {
    return this.assertSubjectReadable(subjectId, await this.authFromUserId(userId, subjectId));
  }

  async assertSubjectStaffForUser(subjectId: string, userId: string): Promise<SubjectAccess> {
    return this.assertSubjectStaff(subjectId, await this.authFromUserId(userId, subjectId));
  }

  private async canReadCourse(courseId: string, user: AuthUser): Promise<boolean> {
    const [staff, membership] = await Promise.all([
      this.prisma.subjectStaff.findFirst({
        where: {
          userId: user.userId,
          subject: { courseId, organizationId: user.organizationId },
        },
        select: { id: true },
      }),
      this.prisma.courseMembership.findUnique({
        where: { courseId_userId: { courseId, userId: user.userId } },
        select: { id: true },
      }),
    ]);
    if (staff) return true;
    // Membership is how students see a cohort. A global teacher without a
    // staff row and without a membership does not see it.
    return user.role === 'STUDENT' && !!membership;
  }

  private async loadSubject(subjectId: string, user: AuthUser): Promise<SubjectAccess> {
    const subject = await this.prisma.subject.findFirst({
      where: { id: subjectId, organizationId: user.organizationId },
      include: { course: true },
    });
    if (!subject || subject.course.organizationId !== user.organizationId) {
      throw new NotFoundException('Asignatura no encontrada.');
    }

    const [staff, membership] = await Promise.all([
      this.prisma.subjectStaff.findUnique({
        where: { subjectId_userId: { subjectId, userId: user.userId } },
      }),
      this.prisma.courseMembership.findUnique({
        where: { courseId_userId: { courseId: subject.courseId, userId: user.userId } },
        select: { id: true },
      }),
    ]);

    const isAdmin = user.role === 'ADMIN';
    return {
      subject,
      isStaff: isAdmin || !!staff,
      staffRole: staff?.role ?? null,
      isMember: !!membership,
    };
  }

  private async authFromUserId(userId: string, subjectId: string): Promise<AuthUser> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.organizationId) {
      throw new NotFoundException('Asignatura no encontrada.');
    }
    return {
      userId: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
      organizationId: user.organizationId,
      role: user.role,
      platformRole: user.platformRole,
      emailNotificationsEnabled: user.emailNotificationsEnabled,
      preferredLanguage: user.preferredLanguage,
    };
  }
}
