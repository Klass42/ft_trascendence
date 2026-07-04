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
import { CoursesService } from './courses.service';
import { CreateCourseDto } from './dto/create-course.dto';
import { UpdateCourseDto } from './dto/update-course.dto';

@Controller('courses')
export class CoursesController {
  constructor(private readonly coursesService: CoursesService) {}

  @Post()
  async create(@Body() dto: CreateCourseDto) {
    return this.coursesService.create(dto);
  }

  @Get()
  async findAll(
    @Query('organizationId') organizationId: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
  ) {
    return this.coursesService.findAll(organizationId, status, search);
  }

  @Get(':id')
  async findOne(
    @Param('id') id: string,
    @Query('organizationId') organizationId: string,
  ) {
    return this.coursesService.findOne(id, organizationId);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Query('organizationId') organizationId: string,
    @Body() dto: UpdateCourseDto,
  ) {
    return this.coursesService.update(id, organizationId, dto);
  }

  @Delete(':id')
  async delete(
    @Param('id') id: string,
    @Query('organizationId') organizationId: string,
  ) {
    await this.coursesService.delete(id, organizationId);
    return { deleted: true };
  }
}
