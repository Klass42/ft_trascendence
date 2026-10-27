import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { NotificationType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateLessonDto } from './dto/create-lesson.dto';
import { UpdateLessonDto } from './dto/update-lesson.dto';
import { NotificationsService } from '../../notifications/notifications.service';

@Injectable()
export class LessonsService {
  private readonly logger = new Logger(LessonsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications?: NotificationsService,
  ) {}

  private async findSectionOrThrow(
    sectionId: string,
    organizationId: string,
  ) {
    const section = await this.prisma.section.findUnique({
      where: { id: sectionId },
      include: { subject: true },
    });

    if (!section || section.subject.organizationId !== organizationId) {
      throw new NotFoundException(`Section ${sectionId} not found`);
    }

    return section;
  }

  /** Resolves a section's subject with tenant isolation for controller guards. */
  async findSectionSubjectId(sectionId: string, organizationId: string) {
    return this.findSectionOrThrow(sectionId, organizationId);
  }

  /** Resolves a lesson's subject with tenant isolation for controller guards. */
  async findSubjectId(lessonId: string, organizationId: string) {
    const lesson = await this.prisma.lesson.findUnique({
      where: { id: lessonId },
      include: { section: { include: { subject: true } } },
    });

    if (!lesson || lesson.section.subject.organizationId !== organizationId) {
      throw new NotFoundException(`Lesson ${lessonId} not found`);
    }

    return lesson;
  }

  private async findLessonOrThrow(
    sectionId: string,
    lessonId: string,
    organizationId: string,
  ) {
    await this.findSectionOrThrow(sectionId, organizationId);

    const lesson = await this.prisma.lesson.findUnique({
      where: { id: lessonId },
    });

    if (!lesson || lesson.sectionId !== sectionId) {
      throw new NotFoundException(`Lesson ${lessonId} not found`);
    }

    return lesson;
  }

  async create(
    sectionId: string,
    organizationId: string,
    dto: CreateLessonDto,
    actorId?: string,
  ) {
    await this.findSectionOrThrow(sectionId, organizationId);

    const lesson = await this.prisma.lesson.create({
      data: {
        sectionId,
        title: dto.title,
        contentMd: dto.contentMd,
        videoUrl: dto.videoUrl || null,
        order: dto.order ?? 0,
      },
    });
    await this.notifyContent(lesson.id, organizationId, actorId, `Nueva lección: ${lesson.title}`);
    return lesson;
  }

  async findAll(sectionId: string, organizationId: string) {
    await this.findSectionOrThrow(sectionId, organizationId);

    return this.prisma.lesson.findMany({
      where: { sectionId },
      orderBy: { order: 'asc' },
    });
  }

  async findOne(
    sectionId: string,
    lessonId: string,
    organizationId: string,
  ) {
    const lesson = await this.findLessonOrThrow(
      sectionId,
      lessonId,
      organizationId,
    );

    return this.prisma.lesson.findUnique({
      where: { id: lessonId },
      include: { attachments: { include: { file: true } } },
    });
  }

  async findById(lessonId: string, organizationId: string) {
    const lesson = await this.prisma.lesson.findUnique({
      where: { id: lessonId },
      include: { section: { include: { subject: true } } },
    });

    if (!lesson || lesson.section.subject.organizationId !== organizationId) {
      throw new NotFoundException(`Lesson ${lessonId} not found`);
    }

    return this.prisma.lesson.findUnique({
      where: { id: lessonId },
      include: { attachments: { include: { file: true } } },
    });
  }

  async update(
    sectionId: string,
    lessonId: string,
    organizationId: string,
    dto: UpdateLessonDto,
    actorId?: string,
  ) {
    await this.findLessonOrThrow(sectionId, lessonId, organizationId);

    const updated = await this.prisma.lesson.update({
      where: { id: lessonId },
      data: {
        ...dto,
        ...(dto.videoUrl !== undefined && { videoUrl: dto.videoUrl || null }),
      },
    });
    await this.notifyContent(lessonId, organizationId, actorId, `Lección actualizada: ${updated.title}`);
    return updated;
  }

  async delete(
    sectionId: string,
    lessonId: string,
    organizationId: string,
    actorId?: string,
  ) {
    const lesson = await this.findLessonOrThrow(sectionId, lessonId, organizationId);

    await this.prisma.lesson.delete({ where: { id: lessonId } });
    await this.notifySectionContent(lesson.sectionId, organizationId, actorId, `Lección eliminada: ${lesson.title}`);
  }

  async reorder(
    sectionId: string,
    organizationId: string,
    orderedIds: string[],
    actorId?: string,
  ) {
    if (!orderedIds || orderedIds.length === 0) {
      throw new BadRequestException('orderedIds must not be empty');
    }

    await this.findSectionOrThrow(sectionId, organizationId);

    const existing = await this.prisma.lesson.findMany({
      where: { id: { in: orderedIds }, sectionId },
      select: { id: true },
    });

    const foundIds = new Set(existing.map((l) => l.id));
    const missing = orderedIds.filter((id) => !foundIds.has(id));

    if (missing.length > 0) {
      throw new NotFoundException(
        `Lessons not found: ${missing.join(', ')}`,
      );
    }

    const updates = orderedIds.map((id, index) =>
      this.prisma.lesson.update({
        where: { id },
        data: { order: index },
      }),
    );

    await this.prisma.$transaction(updates);
    if (orderedIds.length > 0) {
      await this.notifyContent(orderedIds[0], organizationId, actorId, 'Lecciones reorganizadas');
    }
  }

  async attachFile(
    lessonId: string,
    fileId: string,
    organizationId: string,
    actorId?: string,
  ) {
    const lesson = await this.prisma.lesson.findUnique({
      where: { id: lessonId },
      include: { section: { include: { subject: true } } },
    });

    if (
      !lesson ||
      lesson.section.subject.organizationId !== organizationId
    ) {
      throw new NotFoundException(`Lesson ${lessonId} not found`);
    }

    const file = await this.prisma.file.findUnique({
      where: { id: fileId },
    });

    if (!file || file.organizationId !== organizationId) {
      throw new NotFoundException(`File ${fileId} not found`);
    }

    const attachment = await this.prisma.lessonAttachment.create({
      data: { lessonId, fileId },
      include: { file: true },
    });
    await this.notifyContent(lessonId, organizationId, actorId, `Adjunto añadido a ${lesson.title}`);
    return attachment;
  }

  async detachFile(
    lessonId: string,
    fileId: string,
    organizationId: string,
    actorId?: string,
  ) {
    const attachment = await this.prisma.lessonAttachment.findUnique({
      where: { lessonId_fileId: { lessonId, fileId } },
      include: {
        lesson: { include: { section: { include: { subject: true } } } },
      },
    });

    if (
      !attachment ||
      attachment.lesson.section.subject.organizationId !== organizationId
    ) {
      throw new NotFoundException(`Attachment not found`);
    }

    await this.prisma.lessonAttachment.delete({
      where: { lessonId_fileId: { lessonId, fileId } },
    });
    await this.notifyContent(lessonId, organizationId, actorId, 'Adjunto eliminado de una lección');
  }

  private async notifyContent(lessonId: string, organizationId: string, actorId: string | undefined, title: string) {
    if (!this.notifications) return;
    try {
      const lesson = await this.prisma.lesson.findFirst({
        where: { id: lessonId, section: { subject: { organizationId } } },
        select: { sectionId: true },
      });
      if (!lesson) return;
      await this.notifySectionContent(lesson.sectionId, organizationId, actorId, title);
    } catch (error) {
      this.logger.error('No se pudo preparar la notificación de contenido', error instanceof Error ? error.stack : undefined);
    }
  }

  private async notifySectionContent(sectionId: string, organizationId: string, actorId: string | undefined, title: string) {
    if (!this.notifications) return;
    try {
      const section = await this.prisma.section.findFirst({
        where: { id: sectionId, subject: { organizationId } },
        include: { subject: true },
      });
      if (!section) return;
      const subject = section.subject;
      await this.notifications.emitMany(
        async () => {
          if (subject.status !== 'PUBLISHED') return [];
          const memberships = await this.prisma.courseMembership.findMany({
            where: {
              courseId: subject.courseId,
              course: { organizationId },
              user: { organizationId, role: 'STUDENT' },
            },
            select: { userId: true },
          });
          return memberships.map(({ userId }) => userId);
        },
        NotificationType.COURSE_CONTENT_CHANGED,
        { title, body: 'Hay nuevo material disponible en una de tus asignaturas.', link: `/courses/${subject.courseId}/subjects/${subject.id}` },
        { organizationId, actorId },
      );
    } catch (error) {
      this.logger.error('No se pudo preparar la notificación de contenido', error instanceof Error ? error.stack : undefined);
    }
  }
}
