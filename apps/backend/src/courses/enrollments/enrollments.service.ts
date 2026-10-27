import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuthUser } from '@/common/auth';
import { PrismaService } from '../../prisma/prisma.service';
import { subjectStudentsWhere } from '../../activities/gradable-activities';

@Injectable()
export class EnrollmentsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Resolves a lesson's subject with tenant isolation for controller guards. */
  async findLessonSubjectId(lessonId: string, organizationId: string) {
    const lesson = await this.prisma.lesson.findUnique({
      where: { id: lessonId },
      select: {
        section: {
          select: {
            subjectId: true,
            subject: { select: { organizationId: true } },
          },
        },
      },
    });

    if (!lesson || lesson.section.subject.organizationId !== organizationId) {
      throw new NotFoundException('Lección no encontrada.');
    }

    return { subjectId: lesson.section.subjectId };
  }

  async completeLesson(lessonId: string, organizationId: string, userId: string) {
    this.requireIds(userId, organizationId);
    const lesson = await this.prisma.lesson.findUnique({
      where: { id: lessonId },
      include: { section: { include: { subject: true } } },
    });
    if (!lesson || lesson.section.subject.organizationId !== organizationId) {
      throw new NotFoundException('Lección no encontrada.');
    }

    await this.prisma.lessonCompletion.upsert({
      where: { lessonId_userId: { lessonId, userId } },
      create: { lessonId, userId },
      update: {},
    });

    const progress = await this.computeProgress(lesson.section.subjectId, userId);
    return { completed: true, progress: progress.progress };
  }

  async uncompleteLesson(lessonId: string, organizationId: string, userId: string) {
    this.requireIds(userId, organizationId);
    const lesson = await this.prisma.lesson.findUnique({
      where: { id: lessonId },
      include: { section: { include: { subject: true } } },
    });
    if (!lesson || lesson.section.subject.organizationId !== organizationId) {
      throw new NotFoundException('Lección no encontrada.');
    }

    // Idempotent: unmarking a lesson that was never completed is a no-op.
    await this.prisma.lessonCompletion.deleteMany({
      where: {
        lessonId,
        userId,
        lesson: { section: { subject: { organizationId } } },
      },
    });

    const progress = await this.computeProgress(lesson.section.subjectId, userId);
    return { completed: false, progress: progress.progress };
  }

  /**
   * Completed lesson ids per student of the subject's cohort (students only,
   * not staff enrolled in the cohort). Callers must have
   * passed the subject-staff check; this only applies tenant scoping.
   */
  async getSubjectLessonProgress(subjectId: string, organizationId: string) {
    const subject = await this.requireSubject(subjectId, organizationId);
    // Same "student of this subject" as the gradebook and analytics.
    const memberships = await this.prisma.courseMembership.findMany({
      where: subjectStudentsWhere(subject),
      select: { userId: true },
      orderBy: { createdAt: 'asc' },
    });
    const userIds = memberships.map((membership) => membership.userId);
    const completions = userIds.length === 0
      ? []
      : await this.prisma.lessonCompletion.findMany({
          where: {
            userId: { in: userIds },
            lesson: { section: { subjectId, subject: { organizationId } } },
          },
          select: { userId: true, lessonId: true },
        });

    const byUser = new Map<string, string[]>(userIds.map((id) => [id, []]));
    for (const completion of completions) {
      byUser.get(completion.userId)?.push(completion.lessonId);
    }
    return userIds.map((userId) => ({
      userId,
      completedLessonIds: byUser.get(userId) ?? [],
    }));
  }

  async getProgress(subjectId: string, organizationId: string, userId: string) {
    this.requireIds(userId, organizationId);
    await this.requireSubject(subjectId, organizationId);
    return this.computeProgress(subjectId, userId);
  }

  async getCompletedLessonIds(subjectId: string, organizationId: string, userId: string) {
    this.requireIds(userId, organizationId);
    await this.requireSubject(subjectId, organizationId);
    const completions = await this.prisma.lessonCompletion.findMany({
      where: { userId, lesson: { section: { subjectId } } },
      select: { lessonId: true },
    });
    return completions.map((completion) => completion.lessonId);
  }

  /**
   * Progress for every subject the caller can see, computed from lesson
   * completions. Nothing is stored on the membership.
   */
  async getMyProgress(user: AuthUser) {
    this.requireIds(user.userId, user.organizationId);
    const subjects = await this.prisma.subject.findMany({
      where: {
        organizationId: user.organizationId,
        ...(user.role === 'ADMIN'
          ? {}
          : user.role === 'TEACHER'
            ? { staff: { some: { userId: user.userId } } }
            : {
                status: 'PUBLISHED',
                // Archived cohorts are history: they must not drag the average.
                course: {
                  status: { not: 'ARCHIVED' },
                  memberships: { some: { userId: user.userId } },
                },
              }),
      },
      select: { id: true, courseId: true },
    });

    return Promise.all(subjects.map(async (subject) => {
      const progress = await this.computeProgress(subject.id, user.userId);
      return {
        subjectId: subject.id,
        courseId: subject.courseId,
        percentage: progress.progress,
      };
    }));
  }

  private async computeProgress(subjectId: string, userId: string) {
    const total = await this.prisma.lesson.count({
      where: { section: { subjectId } },
    });
    const completed = await this.prisma.lessonCompletion.count({
      where: { userId, lesson: { section: { subjectId } } },
    });
    const progress = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { progress, completed, total };
  }

  private async requireSubject(subjectId: string, organizationId: string) {
    const subject = await this.prisma.subject.findFirst({
      where: { id: subjectId, organizationId },
    });
    if (!subject) throw new NotFoundException('Asignatura no encontrada.');
    return subject;
  }

  private requireIds(userId: string, organizationId: string) {
    if (!userId) throw new BadRequestException('userId is required');
    if (!organizationId) throw new BadRequestException('organizationId is required');
  }
}
