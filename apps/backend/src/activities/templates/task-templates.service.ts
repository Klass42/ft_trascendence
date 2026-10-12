import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  GlobalRole,
  Prisma,
  QuestionKind,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CourseAccessService } from '../../courses/course-access.service';
import { getAdapter } from '../blocks/registry';
import { CreateTaskTemplateDto } from './dto/create-task-template.dto';
import { SaveAsTemplateDto } from './dto/save-as-template.dto';
import { UpdateTaskTemplateDto } from './dto/update-task-template.dto';

export type TemplateBlock = {
  kind: QuestionKind;
  prompt: string;
  points: number;
  order: number;
  content: Record<string, unknown>;
};

@Injectable()
export class TaskTemplatesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: CourseAccessService,
  ) {}

  async create(actingUserId: string, dto: CreateTaskTemplateDto) {
    const user = await this.requireOrgUser(actingUserId);
    await this.assertCanWriteLibrary(user);
    this.validateBlocks(dto.blocks);
    return this.prisma.taskTemplate.create({
      data: {
        organizationId: user.organizationId,
        createdById: actingUserId,
        title: dto.title,
        description: dto.description,
        blocks: dto.blocks as unknown as Prisma.InputJsonValue,
      },
    });
  }

  async findAll(actingUserId: string) {
    const user = await this.requireOrgUser(actingUserId);
    await this.assertCanList(user);
    return this.prisma.taskTemplate.findMany({
      where: { organizationId: user.organizationId },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async findOne(id: string, actingUserId: string) {
    const user = await this.requireOrgUser(actingUserId);
    await this.assertCanList(user);
    const template = await this.prisma.taskTemplate.findUnique({
      where: { id },
    });
    if (!template || template.organizationId !== user.organizationId) {
      throw new NotFoundException(`Task template ${id} not found`);
    }
    return template;
  }

  async update(id: string, actingUserId: string, dto: UpdateTaskTemplateDto) {
    const template = await this.requireWritable(id, actingUserId);
    if (dto.blocks) this.validateBlocks(dto.blocks);
    return this.prisma.taskTemplate.update({
      where: { id: template.id },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.blocks !== undefined && {
          blocks: dto.blocks as unknown as Prisma.InputJsonValue,
        }),
      },
    });
  }

  async remove(id: string, actingUserId: string) {
    const template = await this.requireWritable(id, actingUserId);
    await this.prisma.taskTemplate.delete({ where: { id: template.id } });
  }

  async saveFromActivity(
    activityId: string,
    actingUserId: string,
    dto?: SaveAsTemplateDto,
  ) {
    const activity = await this.prisma.activity.findUnique({
      where: { id: activityId },
      include: {
        subject: true,
        questions: { orderBy: { order: 'asc' } },
      },
    });
    if (!activity) {
      throw new NotFoundException(`Activity ${activityId} not found`);
    }

    await this.access.assertSubjectStaffForUser(activity.subjectId, actingUserId);

    const blocks: TemplateBlock[] = activity.questions.map((q) => ({
      kind: q.kind,
      prompt: q.prompt,
      points: q.points,
      order: q.order,
      content: (q.content ?? {}) as Record<string, unknown>,
    }));
    this.validateBlocks(blocks);

    return this.prisma.taskTemplate.create({
      data: {
        organizationId: activity.subject.organizationId,
        createdById: actingUserId,
        title: dto?.title ?? activity.title,
        description:
          dto?.description !== undefined ? dto.description : activity.description,
        blocks: blocks as unknown as Prisma.InputJsonValue,
        createdFromId: activity.id,
      },
    });
  }

  private validateBlocks(blocks: TemplateBlock[]): void {
    for (const block of blocks) {
      getAdapter(block.kind).validateContent(block.content);
    }
  }

  private async requireOrgUser(actingUserId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: actingUserId },
    });
    if (!user?.organizationId) {
      throw new NotFoundException('Task templates not found');
    }
    return user as typeof user & { organizationId: string };
  }

  private async assertCanList(user: {
    id: string;
    organizationId: string;
    role: GlobalRole;
  }) {
    if (user.role === GlobalRole.TEACHER || user.role === GlobalRole.ADMIN) {
      return;
    }
    const staff = await this.prisma.subjectStaff.findFirst({
      where: {
        userId: user.id,
        subject: { organizationId: user.organizationId },
      },
    });
    if (!staff) {
      throw new NotFoundException('Task templates not found');
    }
  }

  private async assertCanWriteLibrary(user: {
    id: string;
    organizationId: string;
    role: GlobalRole;
  }) {
    if (user.role === GlobalRole.TEACHER || user.role === GlobalRole.ADMIN) {
      return;
    }
    throw new ForbiddenException(
      'Only teachers and administrators can create templates',
    );
  }

  private async requireWritable(id: string, actingUserId: string) {
    const user = await this.requireOrgUser(actingUserId);
    const template = await this.prisma.taskTemplate.findUnique({
      where: { id },
    });
    if (!template || template.organizationId !== user.organizationId) {
      throw new NotFoundException(`Task template ${id} not found`);
    }
    if (
      template.createdById !== actingUserId &&
      user.role !== GlobalRole.ADMIN
    ) {
      throw new ForbiddenException(
        'Only the author or an organization admin can modify this template',
      );
    }
    return template;
  }
}
