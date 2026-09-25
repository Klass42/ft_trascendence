import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
} from '@nestjs/common';
import { LessonsService } from './lessons.service';
import { CreateLessonDto } from './dto/create-lesson.dto';
import { UpdateLessonDto } from './dto/update-lesson.dto';
import { AuthUser, CurrentUser } from '@/common/auth';
import { CourseAccessService } from '../course-access.service';

@Controller()
export class LessonsController {
  constructor(
    private readonly lessonsService: LessonsService,
    private readonly courseAccess: CourseAccessService,
  ) {}

  @Post('sections/:sectionId/lessons')
  async create(
    @Param('sectionId') sectionId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateLessonDto,
  ) {
    const section = await this.lessonsService.findSectionSubjectId(
      sectionId,
      user.organizationId,
    );
    await this.courseAccess.assertSubjectStaff(section.subjectId, user);
    return this.lessonsService.create(sectionId, user.organizationId, dto);
  }

  @Get('sections/:sectionId/lessons')
  async findAll(
    @Param('sectionId') sectionId: string,
    @CurrentUser() user: AuthUser,
  ) {
    const section = await this.lessonsService.findSectionSubjectId(
      sectionId,
      user.organizationId,
    );
    await this.courseAccess.assertSubjectReadable(section.subjectId, user);
    return this.lessonsService.findAll(sectionId, user.organizationId);
  }

  @Patch('sections/:sectionId/lessons/reorder')
  async reorder(
    @Param('sectionId') sectionId: string,
    @CurrentUser() user: AuthUser,
    @Body('orderedIds') orderedIds: string[],
  ) {
    const section = await this.lessonsService.findSectionSubjectId(
      sectionId,
      user.organizationId,
    );
    await this.courseAccess.assertSubjectStaff(section.subjectId, user);
    await this.lessonsService.reorder(sectionId, user.organizationId, orderedIds);
    return { reordered: true };
  }

  @Get('sections/:sectionId/lessons/:id')
  async findOne(
    @Param('sectionId') sectionId: string,
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ) {
    const section = await this.lessonsService.findSectionSubjectId(
      sectionId,
      user.organizationId,
    );
    await this.courseAccess.assertSubjectReadable(section.subjectId, user);
    return this.lessonsService.findOne(sectionId, id, user.organizationId);
  }

  @Get('lessons/:id')
  async findById(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ) {
    const lesson = await this.lessonsService.findSubjectId(
      id,
      user.organizationId,
    );
    await this.courseAccess.assertSubjectReadable(lesson.section.subjectId, user);
    return this.lessonsService.findById(id, user.organizationId);
  }

  @Patch('sections/:sectionId/lessons/:id')
  async update(
    @Param('sectionId') sectionId: string,
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateLessonDto,
  ) {
    const section = await this.lessonsService.findSectionSubjectId(
      sectionId,
      user.organizationId,
    );
    await this.courseAccess.assertSubjectStaff(section.subjectId, user);
    return this.lessonsService.update(sectionId, id, user.organizationId, dto);
  }

  @Delete('sections/:sectionId/lessons/:id')
  async delete(
    @Param('sectionId') sectionId: string,
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ) {
    const section = await this.lessonsService.findSectionSubjectId(
      sectionId,
      user.organizationId,
    );
    await this.courseAccess.assertSubjectStaff(section.subjectId, user);
    await this.lessonsService.delete(sectionId, id, user.organizationId);
    return { deleted: true };
  }

  @Post('lessons/:lessonId/attachments')
  async attachFile(
    @Param('lessonId') lessonId: string,
    @CurrentUser() user: AuthUser,
    @Body('fileId') fileId: string,
  ) {
    const lesson = await this.lessonsService.findSubjectId(
      lessonId,
      user.organizationId,
    );
    await this.courseAccess.assertSubjectStaff(lesson.section.subjectId, user);
    return this.lessonsService.attachFile(lessonId, fileId, user.organizationId);
  }

  @Delete('lessons/:lessonId/attachments/:fileId')
  async detachFile(
    @Param('lessonId') lessonId: string,
    @Param('fileId') fileId: string,
    @CurrentUser() user: AuthUser,
  ) {
    const lesson = await this.lessonsService.findSubjectId(
      lessonId,
      user.organizationId,
    );
    await this.courseAccess.assertSubjectStaff(lesson.section.subjectId, user);
    await this.lessonsService.detachFile(lessonId, fileId, user.organizationId);
    return { deleted: true };
  }
}
