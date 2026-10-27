import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { NotificationType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateSectionDto } from './dto/create-section.dto';
import { UpdateSectionDto } from './dto/update-section.dto';
import { NotificationsService } from '../../notifications/notifications.service';

@Injectable()
export class SectionsService {
  private readonly logger = new Logger(SectionsService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications?: NotificationsService,
  ) {}

  private async findSubjectOrThrow(subjectId: string, organizationId: string) {
    const subject = await this.prisma.subject.findFirst({
      where: { id: subjectId, organizationId },
    });
    if (!subject) {
      throw new NotFoundException('Asignatura no encontrada.');
    }
    return subject;
  }

  async create(subjectId: string, organizationId: string, dto: CreateSectionDto, actorId?: string) {
    await this.findSubjectOrThrow(subjectId, organizationId);

    const section = await this.prisma.section.create({
      data: {
        subjectId,
        title: dto.title,
        order: dto.order ?? 0,
      },
    });
    await this.notifyContent(subjectId, organizationId, actorId, `Nueva sección: ${section.title}`);
    return section;
  }

  async findAll(subjectId: string, organizationId: string) {
    await this.findSubjectOrThrow(subjectId, organizationId);

    return this.prisma.section.findMany({
      where: { subjectId },
      include: {
        lessons: { orderBy: { order: 'asc' } },
      },
      orderBy: { order: 'asc' },
    });
  }

  async findOne(subjectId: string, sectionId: string, organizationId: string) {
    await this.findSubjectOrThrow(subjectId, organizationId);

    const section = await this.prisma.section.findUnique({
      where: { id: sectionId },
      include: {
        lessons: { orderBy: { order: 'asc' } },
      },
    });

    if (!section || section.subjectId !== subjectId) {
      throw new NotFoundException('Sección no encontrada.');
    }

    return section;
  }

  async update(
    subjectId: string,
    sectionId: string,
    organizationId: string,
    dto: UpdateSectionDto,
    actorId?: string,
  ) {
    await this.findOne(subjectId, sectionId, organizationId);

    const updated = await this.prisma.section.update({
      where: { id: sectionId },
      data: dto,
    });
    await this.notifyContent(subjectId, organizationId, actorId, `Sección actualizada: ${updated.title}`);
    return updated;
  }

  async delete(subjectId: string, sectionId: string, organizationId: string, actorId?: string) {
    const section = await this.findOne(subjectId, sectionId, organizationId);

    await this.prisma.section.delete({ where: { id: sectionId } });
    await this.notifyContent(subjectId, organizationId, actorId, `Sección eliminada: ${section.title}`);
  }

  async reorder(
    subjectId: string,
    organizationId: string,
    orderedIds: string[],
    actorId?: string,
  ) {
    if (!orderedIds || orderedIds.length === 0) {
      throw new BadRequestException('La lista de elementos a ordenar no puede estar vacía.');
    }

    await this.findSubjectOrThrow(subjectId, organizationId);

    const existing = await this.prisma.section.findMany({
      where: { id: { in: orderedIds }, subjectId },
      select: { id: true },
    });

    const foundIds = new Set(existing.map((s) => s.id));
    const missing = orderedIds.filter((id) => !foundIds.has(id));

    if (missing.length > 0) {
      throw new NotFoundException(
        'Alguna de las secciones indicadas no existe.',
      );
    }

    const updates = orderedIds.map((id, index) =>
      this.prisma.section.update({
        where: { id },
        data: { order: index },
      }),
    );

    await this.prisma.$transaction(updates);
    await this.notifyContent(subjectId, organizationId, actorId, 'Secciones reorganizadas');
  }

  private async notifyContent(subjectId: string, organizationId: string, actorId: string | undefined, description: string) {
    if (!this.notifications) return;
    try {
      const subject = await this.findSubjectOrThrow(subjectId, organizationId);
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
        { title: description, body: 'Hay nuevo material disponible en una de tus asignaturas.', link: `/courses/${subject.courseId}/subjects/${subjectId}` },
        { organizationId, actorId },
      );
    } catch (error) {
      this.logger.error('No se pudo preparar la notificación de contenido', error instanceof Error ? error.stack : undefined);
    }
  }
}
