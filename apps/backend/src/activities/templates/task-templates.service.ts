import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  GlobalRole,
  NotificationType,
  Prisma,
  QuestionKind,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CourseAccessService } from '../../courses/course-access.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { getAdapter } from '../blocks/registry';
import { CreateTaskTemplateDto } from './dto/create-task-template.dto';
import { SaveAsTemplateDto } from './dto/save-as-template.dto';
import { UpdateTaskTemplateDto } from './dto/update-task-template.dto';
import { SaveAnswersDto } from '../attempts/dto/save-answers.dto';
import { gradeResponses } from '../grading/grade-responses';

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
    private readonly notifications?: NotificationsService,
  ) {}

  async create(actingUserId: string, dto: CreateTaskTemplateDto) {
    const user = await this.requireOrgUser(actingUserId);
    await this.assertCanWriteLibrary(user);
    this.validateBlocks(dto.blocks);
    const created = await this.prisma.taskTemplate.create({
      data: {
        organizationId: user.organizationId,
        createdById: actingUserId,
        title: dto.title,
        description: dto.description,
        blocks: dto.blocks as unknown as Prisma.InputJsonValue,
      },
    });
    await this.notifyTeachers(user.organizationId, actingUserId, `Plantilla de tarea creada: ${created.title}`);
    return created;
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
      throw new NotFoundException('Plantilla de tarea no encontrada.');
    }
    return template;
  }

  /** Grade a local template preview without creating an activity or attempt. */
  async previewGrade(id: string, actingUserId: string, dto: SaveAnswersDto) {
    const user = await this.requireOrgUser(actingUserId);
    await this.assertCanList(user);
    const template = await this.prisma.taskTemplate.findFirst({
      where: { id, organizationId: user.organizationId },
    });
    if (!template) {
      throw new NotFoundException('Plantilla de tarea no encontrada.');
    }

    const blocks = template.blocks as unknown as TemplateBlock[];
    this.validateBlocks(blocks);
    const questions = blocks.map((block, index) => ({
      id: templateQuestionId(id, index),
      kind: block.kind,
      content: block.content,
      points: block.points,
    }));
    const questionsById = new Map(questions.map((question) => [question.id, question]));
    for (const answer of dto.answers) {
      const question = questionsById.get(answer.questionId);
      if (!question) {
        throw new BadRequestException(
          `La pregunta ${answer.questionId} no pertenece a esta plantilla`,
        );
      }
      getAdapter(question.kind).validateResponse(answer.response);
    }

    const maxScore = questions.reduce((total, question) => total + question.points, 0);
    const grade = gradeResponses(questions, dto.answers, maxScore);
    return {
      score: grade.score,
      maxScore,
      results: grade.results,
      solutions: questions.map((question) => ({
        questionId: question.id,
        content: question.content as Record<string, unknown>,
      })),
    };
  }

  async update(id: string, actingUserId: string, dto: UpdateTaskTemplateDto) {
    const template = await this.requireWritable(id, actingUserId);
    if (dto.blocks) this.validateBlocks(dto.blocks);
    const updated = await this.prisma.taskTemplate.update({
      where: { id: template.id },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.blocks !== undefined && {
          blocks: dto.blocks as unknown as Prisma.InputJsonValue,
        }),
      },
    });
    await this.notifyTeachers(template.organizationId, actingUserId, `Plantilla de tarea actualizada: ${updated.title}`);
    return updated;
  }

  async remove(id: string, actingUserId: string) {
    const template = await this.requireWritable(id, actingUserId);
    await this.prisma.taskTemplate.delete({ where: { id: template.id } });
    await this.notifyTeachers(template.organizationId, actingUserId, `Plantilla de tarea eliminada: ${template.title}`);
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
      throw new NotFoundException('Tarea no encontrada.');
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

    const created = await this.prisma.taskTemplate.create({
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
    await this.notifyTeachers(
      activity.subject.organizationId,
      actingUserId,
      `Plantilla de tarea creada: ${created.title}`,
    );
    return created;
  }

  /** Templates are shared across the organization: tell its teachers and admins (not the actor). */
  private async notifyTeachers(organizationId: string, actorId: string, title: string) {
    await this.notifications?.emitMany(
      async () => {
        const staff = await this.prisma.user.findMany({
          where: { organizationId, role: { in: [GlobalRole.ADMIN, GlobalRole.TEACHER] } },
          select: { id: true },
        });
        return staff.map(({ id }) => id);
      },
      NotificationType.RESOURCE_CHANGED,
      { title, link: '/activities' },
      { organizationId, actorId },
    );
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
      throw new NotFoundException('Plantillas de tarea no encontradas.');
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
      throw new NotFoundException('Plantillas de tarea no encontradas.');
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
      'Solo profesores y administradores pueden crear plantillas.',
    );
  }

  private async requireWritable(id: string, actingUserId: string) {
    const user = await this.requireOrgUser(actingUserId);
    const template = await this.prisma.taskTemplate.findUnique({
      where: { id },
    });
    if (!template || template.organizationId !== user.organizationId) {
      throw new NotFoundException('Plantilla de tarea no encontrada.');
    }
    if (
      template.createdById !== actingUserId &&
      user.role !== GlobalRole.ADMIN
    ) {
      throw new ForbiddenException(
        'Solo el autor o un administrador de la organización pueden modificar esta plantilla.',
      );
    }
    return template;
  }
}

export function templateQuestionId(templateId: string, index: number): string {
  return `${templateId}:${index}`;
}
