import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EnrollCourseDto } from './dto/enroll-course.dto';
import { UpdateRoleDto } from './dto/update-role.dto';

@Injectable()
export class EnrollmentsService {
  constructor(private readonly prisma: PrismaService) {}

  private async findCourseOrThrow(courseId: string, organizationId: string) {
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
    });
    if (!course || course.organizationId !== organizationId) {
      throw new NotFoundException(`Course ${courseId} not found`);
    }
    return course;
  }

  async enroll(
    courseId: string,
    organizationId: string,
    userId: string,
    dto: EnrollCourseDto,
  ) {
    const course = await this.findCourseOrThrow(courseId, organizationId);

    if (course.accessCode) {
      if (!dto.accessCode || dto.accessCode !== course.accessCode) {
        throw new NotFoundException(`Course ${courseId} not found`);
      }
    }

    const existing = await this.prisma.enrollment.findUnique({
      where: { courseId_userId: { courseId, userId } },
    });

    if (existing) {
      throw new ConflictException('Already enrolled');
    }

    await this.prisma.user.upsert({
      where: { id: userId },
      create: {
        id: userId,
        organizationId,
        email: `${userId}@placeholder.local`,
        name: userId,
      },
      update: {},
    });

    return this.prisma.enrollment.create({
      data: { courseId, userId },
    });
  }

  async unenroll(
    courseId: string,
    organizationId: string,
    userId: string,
  ) {
    await this.findCourseOrThrow(courseId, organizationId);

    const enrollment = await this.prisma.enrollment.findUnique({
      where: { courseId_userId: { courseId, userId } },
    });

    if (!enrollment) {
      throw new NotFoundException('Enrollment not found');
    }

    await this.prisma.enrollment.delete({
      where: { courseId_userId: { courseId, userId } },
    });
  }

  async findAll(courseId: string, organizationId: string) {
    await this.findCourseOrThrow(courseId, organizationId);

    return this.prisma.enrollment.findMany({
      where: { courseId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateRole(
    enrollmentId: string,
    organizationId: string,
    dto: UpdateRoleDto,
  ) {
    const enrollment = await this.prisma.enrollment.findUnique({
      where: { id: enrollmentId },
      include: { course: true },
    });

    if (!enrollment || enrollment.course.organizationId !== organizationId) {
      throw new NotFoundException(`Enrollment ${enrollmentId} not found`);
    }

    return this.prisma.enrollment.update({
      where: { id: enrollmentId },
      data: { role: dto.role },
    });
  }

  async completeLesson(
    lessonId: string,
    organizationId: string,
    userId: string,
  ) {
    const lesson = await this.prisma.lesson.findUnique({
      where: { id: lessonId },
      include: { section: { include: { course: true } } },
    });

    if (
      !lesson ||
      lesson.section.course.organizationId !== organizationId
    ) {
      throw new NotFoundException(`Lesson ${lessonId} not found`);
    }

    const courseId = lesson.section.courseId;

    const enrollment = await this.prisma.enrollment.findUnique({
      where: { courseId_userId: { courseId, userId } },
    });

    if (!enrollment) {
      throw new NotFoundException('Not enrolled in this course');
    }

    const existing = await this.prisma.lessonCompletion.findUnique({
      where: { lessonId_userId: { lessonId, userId } },
    });

    if (existing) {
      await this.prisma.lessonCompletion.update({
        where: { lessonId_userId: { lessonId, userId } },
        data: {},
      });
    } else {
      await this.prisma.lessonCompletion.create({
        data: { lessonId, userId },
      });
    }

    const progress = await this.recalculateProgress(courseId, userId);

    return { completed: true, progress, created: !existing };
  }

  async getProgress(
    courseId: string,
    organizationId: string,
    userId: string,
  ) {
    await this.findCourseOrThrow(courseId, organizationId);

    const enrollment = await this.prisma.enrollment.findUnique({
      where: { courseId_userId: { courseId, userId } },
    });

    if (!enrollment) {
      throw new NotFoundException('Not enrolled in this course');
    }

    const total = await this.prisma.lesson.count({
      where: { section: { courseId } },
    });

    const completed = await this.prisma.lessonCompletion.count({
      where: { userId, lesson: { section: { courseId } } },
    });

    return {
      progress: enrollment.progress,
      completed,
      total,
    };
  }

  private async recalculateProgress(courseId: string, userId: string) {
    const total = await this.prisma.lesson.count({
      where: { section: { courseId } },
    });

    const completed = await this.prisma.lessonCompletion.count({
      where: { userId, lesson: { section: { courseId } } },
    });

    const progress = total > 0 ? Math.round((completed / total) * 100) : 0;

    await this.prisma.enrollment.update({
      where: { courseId_userId: { courseId, userId } },
      data: { progress },
    });

    return progress;
  }
}
