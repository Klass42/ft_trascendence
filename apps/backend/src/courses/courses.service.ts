import { Injectable, NotFoundException } from '@nestjs/common';
import { CourseRole, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCourseDto } from './dto/create-course.dto';
import { UpdateCourseDto } from './dto/update-course.dto';
import { AuthUser } from '@/common/auth';
import { CourseAccessService } from './course-access.service';

@Injectable()
export class CoursesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly courseAccess: CourseAccessService,
  ) {}

  async create(dto: CreateCourseDto, user: AuthUser) {
    return this.prisma.$transaction(async (tx) => {
      const course = await tx.course.create({
        data: {
          ...dto,
          organizationId: user.organizationId,
          ownerId: user.userId,
        },
      });

      await tx.enrollment.create({
        data: { courseId: course.id, userId: user.userId, role: 'TEACHER' },
      });

      return course;
    });
  }

  async findAll(user: AuthUser, status?: string, search?: string) {
    const staffVisibility: Prisma.CourseWhereInput = user.role === 'ADMIN'
      ? {}
      : {
          OR: [
            { status: 'PUBLISHED' as const },
            { ownerId: user.userId },
            {
              enrollments: {
                some: {
                  userId: user.userId,
                  role: { in: [CourseRole.TEACHER, CourseRole.ASSISTANT] },
                },
              },
            },
          ],
        };

    return this.prisma.course.findMany({
      where: {
        organizationId: user.organizationId,
        ...staffVisibility,
        ...(status && { status: { equals: status as any } }),
        ...(search && { title: { contains: search, mode: 'insensitive' } }),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, user: AuthUser) {
    return this.courseAccess.assertReadable(id, user);
  }

  /**
   * Returns the small public surface needed to join a published course. Course
   * content, ownership and access codes must remain behind course membership.
   */
  async preview(id: string, user: AuthUser) {
    const course = await this.prisma.course.findFirst({
      where: {
        id,
        organizationId: user.organizationId,
        status: 'PUBLISHED',
      },
      select: {
        id: true,
        title: true,
        description: true,
        category: true,
        imageUrl: true,
        status: true,
      },
    });

    if (!course) {
      // A draft, a foreign-tenant course and a missing course must be
      // indistinguishable to a prospective learner.
      throw new NotFoundException(`Course ${id} not found`);
    }

    return course;
  }

  async update(id: string, user: AuthUser, dto: UpdateCourseDto) {
    await this.courseAccess.assertStaff(id, user);

    return this.prisma.course.update({
      where: { id },
      data: dto,
    });
  }

  async delete(id: string, user: AuthUser) {
    await this.courseAccess.assertStaff(id, user);

    await this.prisma.course.delete({ where: { id } });
  }
}
