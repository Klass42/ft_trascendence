import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { LessonsService } from './lessons.service';
import { CreateLessonDto } from './dto/create-lesson.dto';
import { UpdateLessonDto } from './dto/update-lesson.dto';
import { AuthUser, CurrentUser, Roles, RolesGuard } from '@/common/auth';

@Controller()
export class LessonsController {
  constructor(private readonly lessonsService: LessonsService) {}

  @Post('sections/:sectionId/lessons')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'TEACHER')
  async create(
    @Param('sectionId') sectionId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateLessonDto,
  ) {
    return this.lessonsService.create(sectionId, user.organizationId, dto);
  }

  @Get('sections/:sectionId/lessons')
  async findAll(
    @Param('sectionId') sectionId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.lessonsService.findAll(sectionId, user.organizationId);
  }

  @Patch('sections/:sectionId/lessons/reorder')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'TEACHER')
  async reorder(
    @Param('sectionId') sectionId: string,
    @CurrentUser() user: AuthUser,
    @Body('orderedIds') orderedIds: string[],
  ) {
    await this.lessonsService.reorder(sectionId, user.organizationId, orderedIds);
    return { reordered: true };
  }

  @Get('sections/:sectionId/lessons/:id')
  async findOne(
    @Param('sectionId') sectionId: string,
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.lessonsService.findOne(sectionId, id, user.organizationId);
  }

  @Get('lessons/:id')
  async findById(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.lessonsService.findById(id, user.organizationId);
  }

  @Patch('sections/:sectionId/lessons/:id')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'TEACHER')
  async update(
    @Param('sectionId') sectionId: string,
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateLessonDto,
  ) {
    return this.lessonsService.update(sectionId, id, user.organizationId, dto);
  }

  @Delete('sections/:sectionId/lessons/:id')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'TEACHER')
  async delete(
    @Param('sectionId') sectionId: string,
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ) {
    await this.lessonsService.delete(sectionId, id, user.organizationId);
    return { deleted: true };
  }

  @Post('lessons/:lessonId/attachments')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'TEACHER')
  async attachFile(
    @Param('lessonId') lessonId: string,
    @CurrentUser() user: AuthUser,
    @Body('fileId') fileId: string,
  ) {
    return this.lessonsService.attachFile(lessonId, fileId, user.organizationId);
  }

  @Delete('lessons/:lessonId/attachments/:fileId')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'TEACHER')
  async detachFile(
    @Param('lessonId') lessonId: string,
    @Param('fileId') fileId: string,
    @CurrentUser() user: AuthUser,
  ) {
    await this.lessonsService.detachFile(lessonId, fileId, user.organizationId);
    return { deleted: true };
  }
}
