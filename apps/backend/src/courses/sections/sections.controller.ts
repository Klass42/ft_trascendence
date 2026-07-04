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
import { SectionsService } from './sections.service';
import { CreateSectionDto } from './dto/create-section.dto';
import { UpdateSectionDto } from './dto/update-section.dto';

@Controller('courses/:courseId/sections')
export class SectionsController {
  constructor(private readonly sectionsService: SectionsService) {}

  @Post()
  async create(
    @Param('courseId') courseId: string,
    @Query('organizationId') organizationId: string,
    @Body() dto: CreateSectionDto,
  ) {
    return this.sectionsService.create(courseId, organizationId, dto);
  }

  @Get()
  async findAll(
    @Param('courseId') courseId: string,
    @Query('organizationId') organizationId: string,
  ) {
    return this.sectionsService.findAll(courseId, organizationId);
  }

  @Patch('reorder')
  async reorder(
    @Param('courseId') courseId: string,
    @Query('organizationId') organizationId: string,
    @Body('orderedIds') orderedIds: string[],
  ) {
    await this.sectionsService.reorder(courseId, organizationId, orderedIds);
    return { reordered: true };
  }

  @Get(':id')
  async findOne(
    @Param('courseId') courseId: string,
    @Param('id') id: string,
    @Query('organizationId') organizationId: string,
  ) {
    return this.sectionsService.findOne(courseId, id, organizationId);
  }

  @Patch(':id')
  async update(
    @Param('courseId') courseId: string,
    @Param('id') id: string,
    @Query('organizationId') organizationId: string,
    @Body() dto: UpdateSectionDto,
  ) {
    return this.sectionsService.update(courseId, id, organizationId, dto);
  }

  @Delete(':id')
  async delete(
    @Param('courseId') courseId: string,
    @Param('id') id: string,
    @Query('organizationId') organizationId: string,
  ) {
    await this.sectionsService.delete(courseId, id, organizationId);
    return { deleted: true };
  }
}
