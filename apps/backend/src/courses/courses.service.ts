import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CohortStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCourseDto } from './dto/create-course.dto';
import { UpdateCourseDto } from './dto/update-course.dto';
import { CreateSubjectDto } from './dto/create-subject.dto';
import { UpdateSubjectDto } from './dto/update-subject.dto';
import { AddMemberDto } from './dto/add-member.dto';
import { AddStaffDto } from './dto/add-staff.dto';
import { UpdateStaffRoleDto } from './dto/update-staff-role.dto';
import { AuthUser } from '@/common/auth';
import { CourseAccessService } from './course-access.service';

const subjectLabelSelect = {
  id: true,
  title: true,
  status: true,
  course: { select: { id: true, name: true, academicYear: true } },
} satisfies Prisma.SubjectSelect;

@Injectable()
export class CoursesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly courseAccess: CourseAccessService,
  ) {}

  async create(dto: CreateCourseDto, user: AuthUser) {
    this.assertDateWindow(dto.startsOn, dto.endsOn);
    return this.prisma.course.create({
      data: {
        organizationId: user.organizationId,
        name: dto.name,
        academicYear: dto.academicYear,
        startsOn: new Date(dto.startsOn),
        endsOn: new Date(dto.endsOn),
        ...(dto.status && { status: dto.status }),
      },
    });
  }

  /**
   * Cohorts the caller may see. Admins see the organization. Teachers see
   * cohorts where they staff a subject. Students see cohorts they belong to.
   * Published subjects of other cohorts are not included — that was the
   * selector bug in issues #21 and #23.
   */
  async findAll(user: AuthUser, status?: string, search?: string) {
    const cohortStatus = this.parseCohortStatus(status);
    return this.prisma.course.findMany({
      where: {
        organizationId: user.organizationId,
        ...this.courseVisibility(user),
        ...(cohortStatus && { status: cohortStatus }),
        ...(search && { name: { contains: search, mode: 'insensitive' } }),
      },
      orderBy: [{ startsOn: 'desc' }, { name: 'asc' }],
    });
  }

  findMine(user: AuthUser) {
    return this.findAll(user);
  }

  async findOne(id: string, user: AuthUser) {
    return this.courseAccess.assertCourseReadable(id, user);
  }

  async update(id: string, user: AuthUser, dto: UpdateCourseDto) {
    const course = await this.requireCourse(id, user.organizationId);
    const startsOn = dto.startsOn ?? course.startsOn.toISOString();
    const endsOn = dto.endsOn ?? course.endsOn.toISOString();
    this.assertDateWindow(startsOn, endsOn);
    const nextStatus = dto.status ?? course.status;
    if (nextStatus === 'ACTIVE' && course.status !== 'ACTIVE') {
      await this.assertMembersHaveNoOtherActiveCourse(id, user.organizationId);
    }

    return this.prisma.course.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.academicYear !== undefined && { academicYear: dto.academicYear }),
        ...(dto.startsOn !== undefined && { startsOn: new Date(dto.startsOn) }),
        ...(dto.endsOn !== undefined && { endsOn: new Date(dto.endsOn) }),
        ...(dto.status !== undefined && { status: dto.status }),
      },
    });
  }

  async delete(id: string, user: AuthUser) {
    const course = await this.prisma.course.findFirst({
      where: { id, organizationId: user.organizationId },
      select: { id: true, _count: { select: { memberships: true } } },
    });
    if (!course) throw new NotFoundException(`Course ${id} not found`);

    const [attempt, submission] = await Promise.all([
      this.prisma.attempt.findFirst({
        where: {
          activity: { subject: { courseId: id, organizationId: user.organizationId } },
        },
        select: { id: true },
      }),
      this.prisma.submission.findFirst({
        where: {
          assignment: {
            subject: { courseId: id, organizationId: user.organizationId },
          },
        },
        select: { id: true },
      }),
    ]);

    if (course._count.memberships > 0 || attempt || submission) {
      throw new ConflictException(
        'Cannot delete a cohort with enrollments or attempts; archive it instead',
      );
    }
    await this.prisma.course.delete({ where: { id } });
  }

  async listSubjects(courseId: string, user: AuthUser) {
    await this.courseAccess.assertCourseReadable(courseId, user);
    return this.prisma.subject.findMany({
      where: {
        courseId,
        organizationId: user.organizationId,
        ...this.subjectVisibility(user),
      },
      orderBy: { title: 'asc' },
    });
  }

  async createSubject(courseId: string, user: AuthUser, dto: CreateSubjectDto) {
    const course = await this.requireCourse(courseId, user.organizationId);
    return this.prisma.subject.create({
      data: {
        organizationId: course.organizationId,
        courseId: course.id,
        title: dto.title,
        description: dto.description,
        category: dto.category,
        imageUrl: dto.imageUrl,
        ...(dto.status && { status: dto.status }),
      },
    });
  }

  async findSubject(subjectId: string, user: AuthUser) {
    const access = await this.courseAccess.assertSubjectReadable(subjectId, user);
    return this.prisma.subject.findFirstOrThrow({
      where: { id: access.subject.id, organizationId: user.organizationId },
      include: {
        course: { select: { id: true, name: true, academicYear: true, status: true } },
      },
    });
  }

  async updateSubject(subjectId: string, user: AuthUser, dto: UpdateSubjectDto) {
    const subject = await this.requireSubject(subjectId, user.organizationId);
    if (subject.organizationId !== subject.course.organizationId) {
      throw new BadRequestException('Subject organization does not match its course');
    }
    return this.prisma.subject.update({
      where: { id: subject.id },
      data: dto,
    });
  }

  async deleteSubject(subjectId: string, user: AuthUser) {
    const subject = await this.requireSubject(subjectId, user.organizationId);
    const [membership, attempt, submission] = await Promise.all([
      this.prisma.courseMembership.findFirst({
        where: {
          courseId: subject.courseId,
          course: { organizationId: user.organizationId },
        },
        select: { id: true },
      }),
      this.prisma.attempt.findFirst({
        where: {
          activity: {
            subjectId: subject.id,
            subject: { organizationId: user.organizationId },
          },
        },
        select: { id: true },
      }),
      this.prisma.submission.findFirst({
        where: {
          assignment: {
            subjectId: subject.id,
            subject: { organizationId: user.organizationId },
          },
        },
        select: { id: true },
      }),
    ]);

    if (membership || attempt || submission) {
      throw new ConflictException(
        'Cannot delete a subject with enrollments or attempts; archive it instead',
      );
    }
    await this.prisma.subject.delete({ where: { id: subject.id } });
  }

  async listMySubjects(user: AuthUser) {
    return this.prisma.subject.findMany({
      where: {
        organizationId: user.organizationId,
        ...this.subjectVisibility(user),
      },
      select: subjectLabelSelect,
      orderBy: [{ title: 'asc' }],
    });
  }

  async addMember(courseId: string, user: AuthUser, dto: AddMemberDto) {
    const maxAttempts = 3;

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      try {
        return await this.prisma.$transaction(async (tx) => {
          const course = await tx.course.findFirst({
            where: { id: courseId, organizationId: user.organizationId },
          });
          if (!course) throw new NotFoundException(`Course ${courseId} not found`);

          const target = await tx.user.findFirst({
            where: { id: dto.userId, organizationId: user.organizationId },
            select: { id: true },
          });
          if (!target) {
            throw new NotFoundException('User not found in this organization');
          }

          const existing = await tx.courseMembership.findFirst({
            where: {
              courseId,
              userId: dto.userId,
              course: { organizationId: user.organizationId },
            },
          });
          if (existing) {
            throw new ConflictException('Already a member of this course');
          }

          await this.assertSingleActiveMembership(
            dto.userId,
            user.organizationId,
            course,
            tx,
          );
          return tx.courseMembership.create({
            data: { courseId, userId: dto.userId },
          });
        }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      } catch (error) {
        if (!this.isSerializationConflict(error)) throw error;
        if (attempt === maxAttempts - 1) {
          throw new ConflictException(
            'No se pudo completar el alta por un conflicto concurrente. Inténtalo de nuevo.',
          );
        }
      }
    }

    throw new ConflictException('No se pudo completar el alta. Inténtalo de nuevo.');
  }

  async removeMember(courseId: string, memberUserId: string, user: AuthUser) {
    await this.requireCourse(courseId, user.organizationId);
    const membership = await this.prisma.courseMembership.findUnique({
      where: { courseId_userId: { courseId, userId: memberUserId } },
    });
    if (!membership) {
      throw new NotFoundException('Membership not found');
    }
    await this.prisma.courseMembership.delete({ where: { id: membership.id } });
  }

  async listMembers(courseId: string, user: AuthUser) {
    await this.courseAccess.assertCourseReadable(courseId, user);
    if (user.role === 'STUDENT') {
      throw new ForbiddenException('Course staff access is required');
    }
    return this.prisma.courseMembership.findMany({
      where: { courseId, course: { organizationId: user.organizationId } },
      orderBy: { createdAt: 'asc' },
    });
  }

  /** Roster of a subject: students of the parent cohort, with computed progress. */
  async listSubjectMembers(subjectId: string, user: AuthUser) {
    const access = await this.courseAccess.assertSubjectStaff(subjectId, user);
    const memberships = await this.prisma.courseMembership.findMany({
      where: {
        courseId: access.subject.courseId,
        course: { organizationId: user.organizationId },
      },
      orderBy: { createdAt: 'asc' },
    });
    const progress = await this.progressByUser(
      subjectId,
      memberships.map((membership) => membership.userId),
    );
    return memberships.map((membership) => ({
      ...membership,
      progress: progress.get(membership.userId) ?? 0,
    }));
  }

  async addStaff(subjectId: string, user: AuthUser, dto: AddStaffDto) {
    const subject = await this.requireSubject(subjectId, user.organizationId);
    const target = await this.prisma.user.findFirst({
      where: { id: dto.userId, organizationId: user.organizationId },
      select: { id: true },
    });
    if (!target) {
      throw new NotFoundException('User not found in this organization');
    }
    const existing = await this.prisma.subjectStaff.findUnique({
      where: { subjectId_userId: { subjectId, userId: dto.userId } },
    });
    if (existing) {
      throw new ConflictException('User is already staff of this subject');
    }
    return this.prisma.subjectStaff.create({
      data: { subjectId: subject.id, userId: dto.userId, role: dto.role },
    });
  }

  async updateStaffRole(
    subjectId: string,
    staffUserId: string,
    user: AuthUser,
    dto: UpdateStaffRoleDto,
  ) {
    await this.requireSubject(subjectId, user.organizationId);
    const staff = await this.prisma.subjectStaff.findUnique({
      where: { subjectId_userId: { subjectId, userId: staffUserId } },
    });
    if (!staff) throw new NotFoundException('Staff assignment not found');
    return this.prisma.subjectStaff.update({
      where: { id: staff.id },
      data: { role: dto.role },
    });
  }

  async removeStaff(subjectId: string, staffUserId: string, user: AuthUser) {
    await this.requireSubject(subjectId, user.organizationId);
    const staff = await this.prisma.subjectStaff.findUnique({
      where: { subjectId_userId: { subjectId, userId: staffUserId } },
    });
    if (!staff) throw new NotFoundException('Staff assignment not found');
    await this.prisma.subjectStaff.delete({ where: { id: staff.id } });
  }

  async listStaff(subjectId: string, user: AuthUser) {
    await this.courseAccess.assertSubjectStaff(subjectId, user);
    return this.prisma.subjectStaff.findMany({
      where: { subjectId, subject: { organizationId: user.organizationId } },
      orderBy: { createdAt: 'asc' },
    });
  }

  private courseVisibility(user: AuthUser): Prisma.CourseWhereInput {
    if (user.role === 'ADMIN') return {};
    if (user.role === 'TEACHER') {
      return { subjects: { some: { staff: { some: { userId: user.userId } } } } };
    }
    return { memberships: { some: { userId: user.userId } } };
  }

  private subjectVisibility(user: AuthUser): Prisma.SubjectWhereInput {
    if (user.role === 'ADMIN') return {};
    if (user.role === 'TEACHER') {
      return { staff: { some: { userId: user.userId } } };
    }
    return {
      status: 'PUBLISHED',
      course: {
        organizationId: user.organizationId,
        memberships: { some: { userId: user.userId } },
      },
    };
  }

  private async requireCourse(id: string, organizationId: string) {
    const course = await this.prisma.course.findFirst({
      where: { id, organizationId },
    });
    if (!course) throw new NotFoundException(`Course ${id} not found`);
    return course;
  }

  private async requireSubject(id: string, organizationId: string) {
    const subject = await this.prisma.subject.findFirst({
      where: { id, organizationId },
      include: { course: true },
    });
    if (!subject || subject.course.organizationId !== organizationId) {
      throw new NotFoundException(`Subject ${id} not found`);
    }
    return subject;
  }

  private parseCohortStatus(status?: string): CohortStatus | undefined {
    if (!status) return undefined;
    if (status === 'PLANNED' || status === 'ACTIVE' || status === 'ARCHIVED') {
      return status;
    }
    throw new BadRequestException('status must be PLANNED, ACTIVE, or ARCHIVED');
  }

  private assertDateWindow(startsOn: string, endsOn: string) {
    if (new Date(endsOn).getTime() <= new Date(startsOn).getTime()) {
      throw new BadRequestException('endsOn must be after startsOn');
    }
  }

  private async assertSingleActiveMembership(
    userId: string,
    organizationId: string,
    course: { id: string; status: CohortStatus },
    tx: Prisma.TransactionClient,
  ) {
    if (course.status !== 'ACTIVE') return;
    const other = await tx.courseMembership.findFirst({
      where: {
        userId,
        courseId: { not: course.id },
        course: { organizationId, status: 'ACTIVE' },
      },
    });
    if (other) {
      throw new ConflictException('The user already belongs to an active course');
    }
  }

  private isSerializationConflict(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'P2034'
    );
  }

  private async assertMembersHaveNoOtherActiveCourse(courseId: string, organizationId: string) {
    const members = await this.prisma.courseMembership.findMany({
      where: { courseId },
      select: { userId: true },
    });
    if (members.length === 0) return;
    const conflict = await this.prisma.courseMembership.findFirst({
      where: {
        userId: { in: members.map((member) => member.userId) },
        course: { organizationId, status: 'ACTIVE', id: { not: courseId } },
      },
    });
    if (conflict) {
      throw new ConflictException('A member already belongs to another active course');
    }
  }

  private async progressByUser(subjectId: string, userIds: string[]) {
    const total = await this.prisma.lesson.count({
      where: { section: { subjectId } },
    });
    const counts = new Map<string, number>();
    if (userIds.length === 0 || total === 0) {
      return new Map(userIds.map((userId) => [userId, 0]));
    }
    const grouped = await this.prisma.lessonCompletion.groupBy({
      by: ['userId'],
      where: { userId: { in: userIds }, lesson: { section: { subjectId } } },
      _count: { _all: true },
    });
    for (const row of grouped) {
      counts.set(row.userId, Math.round((row._count._all / total) * 100));
    }
    return counts;
  }
}
