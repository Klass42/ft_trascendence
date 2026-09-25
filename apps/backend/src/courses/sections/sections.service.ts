import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateSectionDto } from './dto/create-section.dto';
import { UpdateSectionDto } from './dto/update-section.dto';

@Injectable()
export class SectionsService {
  constructor(private readonly prisma: PrismaService) {}

  private async findSubjectOrThrow(subjectId: string, organizationId: string) {
    const subject = await this.prisma.subject.findFirst({
      where: { id: subjectId, organizationId },
    });
    if (!subject) {
      throw new NotFoundException(`Subject ${subjectId} not found`);
    }
    return subject;
  }

  async create(subjectId: string, organizationId: string, dto: CreateSectionDto) {
    await this.findSubjectOrThrow(subjectId, organizationId);

    return this.prisma.section.create({
      data: {
        subjectId,
        title: dto.title,
        order: dto.order ?? 0,
      },
    });
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
      throw new NotFoundException(`Section ${sectionId} not found`);
    }

    return section;
  }

  async update(
    subjectId: string,
    sectionId: string,
    organizationId: string,
    dto: UpdateSectionDto,
  ) {
    await this.findOne(subjectId, sectionId, organizationId);

    return this.prisma.section.update({
      where: { id: sectionId },
      data: dto,
    });
  }

  async delete(subjectId: string, sectionId: string, organizationId: string) {
    await this.findOne(subjectId, sectionId, organizationId);

    await this.prisma.section.delete({ where: { id: sectionId } });
  }

  async reorder(
    subjectId: string,
    organizationId: string,
    orderedIds: string[],
  ) {
    if (!orderedIds || orderedIds.length === 0) {
      throw new BadRequestException('orderedIds must not be empty');
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
        `Sections not found: ${missing.join(', ')}`,
      );
    }

    const updates = orderedIds.map((id, index) =>
      this.prisma.section.update({
        where: { id },
        data: { order: index },
      }),
    );

    await this.prisma.$transaction(updates);
  }
}
