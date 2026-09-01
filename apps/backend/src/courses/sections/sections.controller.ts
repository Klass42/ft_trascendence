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
import { SectionsService } from './sections.service';
import { CreateSectionDto } from './dto/create-section.dto';
import { UpdateSectionDto } from './dto/update-section.dto';
import { AuthUser, CurrentUser, Roles, RolesGuard } from '@/common/auth';

@Controller('courses/:courseId/sections')
export class SectionsController {
  constructor(private readonly sectionsService: SectionsService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'TEACHER')
  async create(
    @Param('courseId') courseId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateSectionDto,
  ) {
    return this.sectionsService.create(courseId, user.organizationId, dto);
  }

  @Get()
  async findAll(
    @Param('courseId') courseId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.sectionsService.findAll(courseId, user.organizationId);
  }

  @Patch('reorder')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'TEACHER')
  async reorder(
    @Param('courseId') courseId: string,
    @CurrentUser() user: AuthUser,
    @Body('orderedIds') orderedIds: string[],
  ) {
    await this.sectionsService.reorder(courseId, user.organizationId, orderedIds);
    return { reordered: true };
  }

  @Get(':id')
  async findOne(
    @Param('courseId') courseId: string,
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.sectionsService.findOne(courseId, id, user.organizationId);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'TEACHER')
  async update(
    @Param('courseId') courseId: string,
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateSectionDto,
  ) {
    return this.sectionsService.update(courseId, id, user.organizationId, dto);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'TEACHER')
  async delete(
    @Param('courseId') courseId: string,
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ) {
    await this.sectionsService.delete(courseId, id, user.organizationId);
    return { deleted: true };
  }
}
