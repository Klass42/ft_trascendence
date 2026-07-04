import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
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
  async completeLesson(
    @Param('lessonId') lessonId: string,
    @Query('organizationId') organizationId: string,
    @Query('userId') userId: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.enrollmentsService.completeLesson(
      lessonId,
      organizationId,
      userId,
    );
    res.status(result.created ? 201 : 200);
    const { created, ...rest } = result;
    return rest;
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
}
