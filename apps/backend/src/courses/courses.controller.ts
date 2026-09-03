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
  UseGuards,
} from '@nestjs/common';
import { CoursesService } from './courses.service';
import { CreateCourseDto } from './dto/create-course.dto';
import { UpdateCourseDto } from './dto/update-course.dto';
import { CurrentUser, AuthUser, Roles, RolesGuard } from '@/common/auth';

@Controller('courses')
export class CoursesController {
  constructor(private readonly coursesService: CoursesService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'TEACHER')
  async create(@Body() dto: CreateCourseDto, @CurrentUser() user: AuthUser) {
    return this.coursesService.create(dto, user);
  }

  @Get()
  async findAll(
    @CurrentUser() user: AuthUser,
    @Query('status') status?: string,
    @Query('search') search?: string,
  ) {
    return this.coursesService.findAll(user, status, search);
  }

  /**
   * The public, joinable view of a course. This deliberately precedes `:id`
   * so it is not swallowed by the private course-detail route.
   */
  @Get(':id/preview')
  async preview(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.coursesService.preview(id, user);
  }

  @Get(':id')
  async findOne(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.coursesService.findOne(id, user);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateCourseDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.coursesService.update(id, user, dto);
  }

  @Delete(':id')
  async delete(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ) {
    await this.coursesService.delete(id, user);
    return { deleted: true };
  }
}
