import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateLessonDto } from './dto/create-lesson.dto';
import { UpdateLessonDto } from './dto/update-lesson.dto';

@Injectable()
export class LessonsService {
  constructor(private readonly prisma: PrismaService) {}

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
  ) {
    await this.findSectionOrThrow(sectionId, organizationId);

    return this.prisma.lesson.create({
      data: {
        sectionId,
        title: dto.title,
        contentMd: dto.contentMd,
        videoUrl: dto.videoUrl,
        order: dto.order ?? 0,
      },
    });
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
  ) {
    await this.findLessonOrThrow(sectionId, lessonId, organizationId);

    return this.prisma.lesson.update({
      where: { id: lessonId },
      data: dto,
    });
  }

  async delete(
    sectionId: string,
    lessonId: string,
    organizationId: string,
  ) {
    await this.findLessonOrThrow(sectionId, lessonId, organizationId);

    await this.prisma.lesson.delete({ where: { id: lessonId } });
  }

  async reorder(
    sectionId: string,
    organizationId: string,
    orderedIds: string[],
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
  }

  async attachFile(
    lessonId: string,
    fileId: string,
    organizationId: string,
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

    return this.prisma.lessonAttachment.create({
      data: { lessonId, fileId },
      include: { file: true },
    });
  }

  async detachFile(
    lessonId: string,
    fileId: string,
    organizationId: string,
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
  }
}
