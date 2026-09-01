import {
  BadRequestException,
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
    if (!userId) throw new BadRequestException('userId is required');
    if (!organizationId) throw new BadRequestException('organizationId is required');

    const course = await this.findCourseOrThrow(courseId, organizationId);

    if (course.status !== 'PUBLISHED') {
      throw new NotFoundException(`Course ${courseId} not found`);
    }

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

    // Never manufacture a user from a client-controlled id. Besides producing
    // unusable accounts, that used to make enrollment an identity-creation API.
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, organizationId: true },
    });
    if (!user || user.organizationId !== organizationId) {
      throw new NotFoundException('User not found in this organization');
    }

    const enrollment = await this.prisma.enrollment.create({
      data: { courseId, userId },
    });

    await this.recalculateProgress(courseId, userId);

    return this.prisma.enrollment.findUniqueOrThrow({
      where: { id: enrollment.id },
    });
  }

  async unenroll(
    courseId: string,
    organizationId: string,
    userId: string,
  ) {
    if (!userId) throw new BadRequestException('userId is required');
    if (!organizationId) throw new BadRequestException('organizationId is required');

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
    if (!organizationId) throw new BadRequestException('organizationId is required');

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
    if (!userId) throw new BadRequestException('userId is required');
    if (!organizationId) throw new BadRequestException('organizationId is required');

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

    await this.prisma.lessonCompletion.upsert({
      where: { lessonId_userId: { lessonId, userId } },
      create: { lessonId, userId },
      update: {},
    });

    const progress = await this.recalculateProgress(courseId, userId);

    return { completed: true, progress };
  }

  async getProgress(
    courseId: string,
    organizationId: string,
    userId: string,
  ) {
    if (!userId) throw new BadRequestException('userId is required');
    if (!organizationId) throw new BadRequestException('organizationId is required');

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

    const progress = total > 0 ? Math.round((completed / total) * 100) : 0;

    return { progress, completed, total };
  }

  async getCompletedLessonIds(
    courseId: string,
    organizationId: string,
    userId: string,
  ) {
    if (!userId) throw new BadRequestException('userId is required');
    if (!organizationId) throw new BadRequestException('organizationId is required');

    await this.findCourseOrThrow(courseId, organizationId);

    const enrollment = await this.prisma.enrollment.findUnique({
      where: { courseId_userId: { courseId, userId } },
    });

    if (!enrollment) {
      throw new NotFoundException('Not enrolled in this course');
    }

    const completions = await this.prisma.lessonCompletion.findMany({
      where: { userId, lesson: { section: { courseId } } },
      select: { lessonId: true },
    });

    return completions.map(c => c.lessonId);
  }

  async getMyProgress(organizationId: string, userId: string) {
    if (!userId) throw new BadRequestException('userId is required');
    if (!organizationId) throw new BadRequestException('organizationId is required');

    const enrollments = await this.prisma.enrollment.findMany({
      where: { userId, course: { organizationId } },
      select: { courseId: true, progress: true },
    });

    return enrollments.map(e => ({
      courseId: e.courseId,
      percentage: e.progress,
    }));
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
