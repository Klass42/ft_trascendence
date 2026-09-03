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
import { AuthUser, CurrentUser } from '@/common/auth';
import { CourseAccessService } from '../course-access.service';

@Controller()
export class EnrollmentsController {
  constructor(
    private readonly enrollmentsService: EnrollmentsService,
    private readonly courseAccess: CourseAccessService,
  ) {}

  /** A cross-user roster action is limited to staff in that exact course. */
  private async targetUserId(
    courseId: string,
    user: AuthUser,
    requestedId?: string,
  ): Promise<string> {
    const targetId = requestedId || user.userId;
    if (targetId !== user.userId) {
      await this.courseAccess.assertStaff(courseId, user);
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
      await this.targetUserId(courseId, user, userId),
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
      await this.targetUserId(courseId, user, userId),
    );
    return { deleted: true };
  }

  @Get('courses/:courseId/enrollments')
  async findAll(
    @Param('courseId') courseId: string,
    @CurrentUser() user: AuthUser,
  ) {
    await this.courseAccess.assertStaff(courseId, user);
    return this.enrollmentsService.findAll(courseId, user.organizationId);
  }

  @Patch('enrollments/:id/role')
  async updateRole(
    @Param('id') id: string,
    @Body() dto: UpdateRoleDto,
    @CurrentUser() user: AuthUser,
  ) {
    const courseId = await this.enrollmentsService.findEnrollmentCourseId(
      id,
      user.organizationId,
    );
    await this.courseAccess.assertStaff(courseId, user);
    return this.enrollmentsService.updateRole(id, user.organizationId, dto);
  }

  @Post('lessons/:lessonId/complete')
  @HttpCode(200)
  async completeLesson(
    @Param('lessonId') lessonId: string,
    @CurrentUser() user: AuthUser,
  ) {
    const lesson = await this.enrollmentsService.findLessonCourseId(
      lessonId,
      user.organizationId,
    );
    await this.courseAccess.assertReadable(lesson.courseId, user);
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
    await this.courseAccess.assertReadable(courseId, user);
    return this.enrollmentsService.getCompletedLessonIds(
      courseId,
      user.organizationId,
      await this.targetUserId(courseId, user, userId),
    );
  }

  @Get('courses/:courseId/progress')
  async getProgress(
    @Param('courseId') courseId: string,
    @Query('userId') userId: string,
    @CurrentUser() user: AuthUser,
  ) {
    await this.courseAccess.assertReadable(courseId, user);
    return this.enrollmentsService.getProgress(
      courseId,
      user.organizationId,
      await this.targetUserId(courseId, user, userId),
    );
  }

  @Get('enrollments/my-progress')
  async getMyProgress(
    @CurrentUser() user: AuthUser,
  ) {
    return this.enrollmentsService.getMyProgress(user);
  }
}
