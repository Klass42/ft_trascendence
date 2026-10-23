import { ParseIdPipe } from '@/common/pipes/parse-id.pipe';
import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
} from '@nestjs/common';
import { SectionsService } from './sections.service';
import { CreateSectionDto } from './dto/create-section.dto';
import { UpdateSectionDto } from './dto/update-section.dto';
import { AuthUser, CurrentUser } from '@/common/auth';
import { CourseAccessService } from '../course-access.service';
import { OrderedIdsDto } from '@/common/dto/ordered-ids.dto';

@Controller('subjects/:subjectId/sections')
export class SectionsController {
  constructor(
    private readonly sectionsService: SectionsService,
    private readonly courseAccess: CourseAccessService,
  ) {}

  @Post()
  async create(
    @Param('subjectId', ParseIdPipe) subjectId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateSectionDto,
  ) {
    await this.courseAccess.assertSubjectStaff(subjectId, user);
    return this.sectionsService.create(subjectId, user.organizationId, dto, user.userId);
  }

  @Get()
  async findAll(
    @Param('subjectId', ParseIdPipe) subjectId: string,
    @CurrentUser() user: AuthUser,
  ) {
    await this.courseAccess.assertSubjectReadable(subjectId, user);
    return this.sectionsService.findAll(subjectId, user.organizationId);
  }

  @Patch('reorder')
  async reorder(
    @Param('subjectId', ParseIdPipe) subjectId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: OrderedIdsDto,
  ) {
    await this.courseAccess.assertSubjectStaff(subjectId, user);
    await this.sectionsService.reorder(
      subjectId,
      user.organizationId,
      dto.orderedIds,
      user.userId,
    );
    return { reordered: true };
  }

  @Get(':id')
  async findOne(
    @Param('subjectId', ParseIdPipe) subjectId: string,
    @Param('id', ParseIdPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    await this.courseAccess.assertSubjectReadable(subjectId, user);
    return this.sectionsService.findOne(subjectId, id, user.organizationId);
  }

  @Patch(':id')
  async update(
    @Param('subjectId', ParseIdPipe) subjectId: string,
    @Param('id', ParseIdPipe) id: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateSectionDto,
  ) {
    await this.courseAccess.assertSubjectStaff(subjectId, user);
    return this.sectionsService.update(subjectId, id, user.organizationId, dto, user.userId);
  }

  @Delete(':id')
  async delete(
    @Param('subjectId', ParseIdPipe) subjectId: string,
    @Param('id', ParseIdPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    await this.courseAccess.assertSubjectStaff(subjectId, user);
    await this.sectionsService.delete(subjectId, id, user.organizationId, user.userId);
    return { deleted: true };
  }
}
