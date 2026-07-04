import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCourseDto } from './dto/create-course.dto';
import { UpdateCourseDto } from './dto/update-course.dto';

@Injectable()
export class CoursesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateCourseDto) {
    return this.prisma.course.create({ data: dto });
  }

  async findAll(organizationId: string, status?: string, search?: string) {
    return this.prisma.course.findMany({
      where: {
        organizationId,
        ...(status && { status: { equals: status as any } }),
        ...(search && { title: { contains: search, mode: 'insensitive' } }),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, organizationId: string) {
    const course = await this.prisma.course.findUnique({
      where: { id },
    });

    if (!course || course.organizationId !== organizationId) {
      throw new NotFoundException(`Course ${id} not found`);
    }

    return course;
  }

  async update(id: string, organizationId: string, dto: UpdateCourseDto) {
    await this.findOne(id, organizationId);

    return this.prisma.course.update({
      where: { id },
      data: dto,
    });
  }

  async delete(id: string, organizationId: string) {
    await this.findOne(id, organizationId);

    await this.prisma.course.delete({ where: { id } });
  }
}
