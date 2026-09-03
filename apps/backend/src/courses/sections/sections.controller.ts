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

@Controller('courses/:courseId/sections')
export class SectionsController {
  constructor(
    private readonly sectionsService: SectionsService,
    private readonly courseAccess: CourseAccessService,
  ) {}

  @Post()
  async create(
    @Param('courseId') courseId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateSectionDto,
  ) {
    await this.courseAccess.assertStaff(courseId, user);
    return this.sectionsService.create(courseId, user.organizationId, dto);
  }

  @Get()
  async findAll(
    @Param('courseId') courseId: string,
    @CurrentUser() user: AuthUser,
  ) {
    await this.courseAccess.assertReadable(courseId, user);
    return this.sectionsService.findAll(courseId, user.organizationId);
  }

  @Patch('reorder')
  async reorder(
    @Param('courseId') courseId: string,
    @CurrentUser() user: AuthUser,
    @Body('orderedIds') orderedIds: string[],
  ) {
    await this.courseAccess.assertStaff(courseId, user);
    await this.sectionsService.reorder(courseId, user.organizationId, orderedIds);
    return { reordered: true };
  }

  @Get(':id')
  async findOne(
    @Param('courseId') courseId: string,
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ) {
    await this.courseAccess.assertReadable(courseId, user);
    return this.sectionsService.findOne(courseId, id, user.organizationId);
  }

  @Patch(':id')
  async update(
    @Param('courseId') courseId: string,
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateSectionDto,
  ) {
    await this.courseAccess.assertStaff(courseId, user);
    return this.sectionsService.update(courseId, id, user.organizationId, dto);
  }

  @Delete(':id')
  async delete(
    @Param('courseId') courseId: string,
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ) {
    await this.courseAccess.assertStaff(courseId, user);
    await this.sectionsService.delete(courseId, id, user.organizationId);
    return { deleted: true };
  }
}
