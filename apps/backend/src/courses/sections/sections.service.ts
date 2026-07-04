import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateSectionDto } from './dto/create-section.dto';
import { UpdateSectionDto } from './dto/update-section.dto';

@Injectable()
export class SectionsService {
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

  async create(courseId: string, organizationId: string, dto: CreateSectionDto) {
    await this.findCourseOrThrow(courseId, organizationId);

    return this.prisma.section.create({
      data: {
        courseId,
        title: dto.title,
        order: dto.order ?? 0,
      },
    });
  }

  async findAll(courseId: string, organizationId: string) {
    await this.findCourseOrThrow(courseId, organizationId);

    return this.prisma.section.findMany({
      where: { courseId },
      include: {
        lessons: { orderBy: { order: 'asc' } },
      },
      orderBy: { order: 'asc' },
    });
  }

  async findOne(courseId: string, sectionId: string, organizationId: string) {
    await this.findCourseOrThrow(courseId, organizationId);

    const section = await this.prisma.section.findUnique({
      where: { id: sectionId },
      include: {
        lessons: { orderBy: { order: 'asc' } },
      },
    });

    if (!section || section.courseId !== courseId) {
      throw new NotFoundException(`Section ${sectionId} not found`);
    }

    return section;
  }

  async update(
    courseId: string,
    sectionId: string,
    organizationId: string,
    dto: UpdateSectionDto,
  ) {
    await this.findOne(courseId, sectionId, organizationId);

    return this.prisma.section.update({
      where: { id: sectionId },
      data: dto,
    });
  }

  async delete(courseId: string, sectionId: string, organizationId: string) {
    await this.findOne(courseId, sectionId, organizationId);

    await this.prisma.section.delete({ where: { id: sectionId } });
  }

  async reorder(
    courseId: string,
    organizationId: string,
    orderedIds: string[],
  ) {
    if (!orderedIds || orderedIds.length === 0) {
      throw new BadRequestException('orderedIds must not be empty');
    }

    await this.findCourseOrThrow(courseId, organizationId);

    const existing = await this.prisma.section.findMany({
      where: { id: { in: orderedIds }, courseId },
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
