import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  HttpCode,
} from '@nestjs/common';
import { EnrollmentsService } from './enrollments.service';
import { EnrollCourseDto } from './dto/enroll-course.dto';
import { UpdateRoleDto } from './dto/update-role.dto';

@Controller()
export class EnrollmentsController {
  constructor(
    private readonly enrollmentsService: EnrollmentsService,
  ) {}

  @Post('courses/:courseId/enroll')
  async enroll(
    @Param('courseId') courseId: string,
    @Query('organizationId') organizationId: string,
    @Query('userId') userId: string,
    @Body() dto: EnrollCourseDto,
  ) {
    return this.enrollmentsService.enroll(
      courseId,
      organizationId,
      userId,
      dto,
    );
  }

  @Delete('courses/:courseId/enroll')
  async unenroll(
    @Param('courseId') courseId: string,
    @Query('organizationId') organizationId: string,
    @Query('userId') userId: string,
  ) {
    await this.enrollmentsService.unenroll(
      courseId,
      organizationId,
      userId,
    );
    return { deleted: true };
  }

  @Get('courses/:courseId/enrollments')
  async findAll(
    @Param('courseId') courseId: string,
    @Query('organizationId') organizationId: string,
  ) {
    return this.enrollmentsService.findAll(courseId, organizationId);
  }

  @Patch('enrollments/:id/role')
  async updateRole(
    @Param('id') id: string,
    @Query('organizationId') organizationId: string,
    @Body() dto: UpdateRoleDto,
  ) {
    return this.enrollmentsService.updateRole(id, organizationId, dto);
  }

  @Post('lessons/:lessonId/complete')
  @HttpCode(200)
  async completeLesson(
    @Param('lessonId') lessonId: string,
    @Query('organizationId') organizationId: string,
    @Query('userId') userId: string,
  ) {
    return this.enrollmentsService.completeLesson(
      lessonId,
      organizationId,
      userId,
    );
  }

  @Get('courses/:courseId/completed-lessons')
  async getCompletedLessons(
    @Param('courseId') courseId: string,
    @Query('organizationId') organizationId: string,
    @Query('userId') userId: string,
  ) {
    return this.enrollmentsService.getCompletedLessonIds(
      courseId,
      organizationId,
      userId,
    );
  }

  @Get('courses/:courseId/progress')
  async getProgress(
    @Param('courseId') courseId: string,
    @Query('organizationId') organizationId: string,
    @Query('userId') userId: string,
  ) {
    return this.enrollmentsService.getProgress(
      courseId,
      organizationId,
      userId,
    );
  }

  @Get('enrollments/my-progress')
  async getMyProgress(
    @Query('organizationId') organizationId: string,
    @Query('userId') userId: string,
  ) {
    return this.enrollmentsService.getMyProgress(organizationId, userId);
  }
}
