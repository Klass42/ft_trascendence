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
  ForbiddenException,
} from '@nestjs/common';
import { EnrollmentsService } from './enrollments.service';
import { EnrollCourseDto } from './dto/enroll-course.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { AuthUser, CurrentUser, Roles, RolesGuard } from '@/common/auth';
import { UseGuards } from '@nestjs/common';

@Controller()
export class EnrollmentsController {
  constructor(
    private readonly enrollmentsService: EnrollmentsService,
  ) {}

  /** Students may only act on their own enrollment/progress. */
  private targetUserId(user: AuthUser, requestedId?: string): string {
    const targetId = requestedId || user.userId;
    if (targetId !== user.userId && user.role !== 'ADMIN' && user.role !== 'TEACHER') {
      throw new ForbiddenException('You cannot act on another user');
    }
    return targetId;
  }

  @Post('courses/:courseId/enroll')
  async enroll(
    @Param('courseId') courseId: string,
    @Query('userId') userId: string,
    @Body() dto: EnrollCourseDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.enrollmentsService.enroll(
      courseId,
      user.organizationId,
      this.targetUserId(user, userId),
      dto,
    );
  }

  @Delete('courses/:courseId/enroll')
  async unenroll(
    @Param('courseId') courseId: string,
    @Query('userId') userId: string,
    @CurrentUser() user: AuthUser,
  ) {
    await this.enrollmentsService.unenroll(
      courseId,
      user.organizationId,
      this.targetUserId(user, userId),
    );
    return { deleted: true };
  }

  @Get('courses/:courseId/enrollments')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'TEACHER')
  async findAll(
    @Param('courseId') courseId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.enrollmentsService.findAll(courseId, user.organizationId);
  }

  @Patch('enrollments/:id/role')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'TEACHER')
  async updateRole(
    @Param('id') id: string,
    @Body() dto: UpdateRoleDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.enrollmentsService.updateRole(id, user.organizationId, dto);
  }

  @Post('lessons/:lessonId/complete')
  @HttpCode(200)
  async completeLesson(
    @Param('lessonId') lessonId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.enrollmentsService.completeLesson(
      lessonId,
      user.organizationId,
      user.userId,
    );
  }

  @Get('courses/:courseId/completed-lessons')
  async getCompletedLessons(
    @Param('courseId') courseId: string,
    @Query('userId') userId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.enrollmentsService.getCompletedLessonIds(
      courseId,
      user.organizationId,
      this.targetUserId(user, userId),
    );
  }

  @Get('courses/:courseId/progress')
  async getProgress(
    @Param('courseId') courseId: string,
    @Query('userId') userId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.enrollmentsService.getProgress(
      courseId,
      user.organizationId,
      this.targetUserId(user, userId),
    );
  }

  @Get('enrollments/my-progress')
  async getMyProgress(
    @CurrentUser() user: AuthUser,
  ) {
    return this.enrollmentsService.getMyProgress(user.organizationId, user.userId);
  }
}
