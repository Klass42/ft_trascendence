import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
} from '@nestjs/common';
import { LessonsService } from './lessons.service';
import { CreateLessonDto } from './dto/create-lesson.dto';
import { UpdateLessonDto } from './dto/update-lesson.dto';

@Controller()
export class LessonsController {
  constructor(private readonly lessonsService: LessonsService) {}

  @Post('sections/:sectionId/lessons')
  async create(
    @Param('sectionId') sectionId: string,
    @Query('organizationId') organizationId: string,
    @Body() dto: CreateLessonDto,
  ) {
    return this.lessonsService.create(sectionId, organizationId, dto);
  }

  @Get('sections/:sectionId/lessons')
  async findAll(
    @Param('sectionId') sectionId: string,
    @Query('organizationId') organizationId: string,
  ) {
    return this.lessonsService.findAll(sectionId, organizationId);
  }

  @Patch('sections/:sectionId/lessons/reorder')
  async reorder(
    @Param('sectionId') sectionId: string,
    @Query('organizationId') organizationId: string,
    @Body('orderedIds') orderedIds: string[],
  ) {
    await this.lessonsService.reorder(sectionId, organizationId, orderedIds);
    return { reordered: true };
  }

  @Get('sections/:sectionId/lessons/:id')
  async findOne(
    @Param('sectionId') sectionId: string,
    @Param('id') id: string,
    @Query('organizationId') organizationId: string,
  ) {
    return this.lessonsService.findOne(sectionId, id, organizationId);
  }

  @Patch('sections/:sectionId/lessons/:id')
  async update(
    @Param('sectionId') sectionId: string,
    @Param('id') id: string,
    @Query('organizationId') organizationId: string,
    @Body() dto: UpdateLessonDto,
  ) {
    return this.lessonsService.update(sectionId, id, organizationId, dto);
  }

  @Delete('sections/:sectionId/lessons/:id')
  async delete(
    @Param('sectionId') sectionId: string,
    @Param('id') id: string,
    @Query('organizationId') organizationId: string,
  ) {
    await this.lessonsService.delete(sectionId, id, organizationId);
    return { deleted: true };
  }

  @Post('lessons/:lessonId/attachments')
  async attachFile(
    @Param('lessonId') lessonId: string,
    @Query('organizationId') organizationId: string,
    @Body('fileId') fileId: string,
  ) {
    return this.lessonsService.attachFile(lessonId, fileId, organizationId);
  }

  @Delete('lessons/:lessonId/attachments/:fileId')
  async detachFile(
    @Param('lessonId') lessonId: string,
    @Param('fileId') fileId: string,
    @Query('organizationId') organizationId: string,
  ) {
    await this.lessonsService.detachFile(lessonId, fileId, organizationId);
    return { deleted: true };
  }
}
