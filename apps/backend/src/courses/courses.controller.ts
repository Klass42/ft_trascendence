// Owner: Aloiki (@illia) — Content & UX; migrated to @CurrentUser by Jorge (Epic 2)
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
import { CurrentUser, AuthUser } from '@/common/auth';

@Controller('courses')
export class CoursesController {
  constructor(private readonly coursesService: CoursesService) {}

  @Post()
  async create(@Body() dto: CreateCourseDto, @CurrentUser() user: AuthUser) {
    return this.coursesService.create(dto, user.organizationId);
  }

  @Get()
  async findAll(
    @CurrentUser() user: AuthUser,
    @Query('status') status?: string,
    @Query('search') search?: string,
  ) {
    return this.coursesService.findAll(user.organizationId, status, search);
  }

  @Get(':id')
  async findOne(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.coursesService.findOne(id, user.organizationId);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateCourseDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.coursesService.update(id, user.organizationId, dto);
  }

  @Delete(':id')
  async delete(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ) {
    await this.coursesService.delete(id, user.organizationId);
    return { deleted: true };
  }
}
