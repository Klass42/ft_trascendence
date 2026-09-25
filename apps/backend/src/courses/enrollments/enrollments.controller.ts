import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  HttpCode,
} from '@nestjs/common';
import { EnrollmentsService } from './enrollments.service';
import { AuthUser, CurrentUser } from '@/common/auth';
import { CourseAccessService } from '../course-access.service';

@Controller()
export class EnrollmentsController {
  constructor(
    private readonly enrollmentsService: EnrollmentsService,
    private readonly courseAccess: CourseAccessService,
  ) {}

  /**
   * Staff may read another learner's progress. Everyone else is limited to
   * their own user id.
   */
  private async targetUserId(
    subjectId: string,
    user: AuthUser,
    requestedId?: string,
  ): Promise<string> {
    const targetId = requestedId || user.userId;
    if (targetId !== user.userId) {
      await this.courseAccess.assertSubjectStaff(subjectId, user);
    }
    return targetId;
  }

  @Post('lessons/:lessonId/complete')
  @HttpCode(200)
  async completeLesson(
    @Param('lessonId') lessonId: string,
    @CurrentUser() user: AuthUser,
  ) {
    const lesson = await this.enrollmentsService.findLessonSubjectId(
      lessonId,
      user.organizationId,
    );
    await this.courseAccess.assertSubjectReadable(lesson.subjectId, user);
    return this.enrollmentsService.completeLesson(
      lessonId,
      user.organizationId,
      user.userId,
    );
  }

  @Get('subjects/:subjectId/completed-lessons')
  async getCompletedLessons(
    @Param('subjectId') subjectId: string,
    @Query('userId') userId: string,
    @CurrentUser() user: AuthUser,
  ) {
    await this.courseAccess.assertSubjectReadable(subjectId, user);
    return this.enrollmentsService.getCompletedLessonIds(
      subjectId,
      user.organizationId,
      await this.targetUserId(subjectId, user, userId),
    );
  }

  @Get('subjects/:subjectId/progress')
  async getProgress(
    @Param('subjectId') subjectId: string,
    @Query('userId') userId: string,
    @CurrentUser() user: AuthUser,
  ) {
    await this.courseAccess.assertSubjectReadable(subjectId, user);
    return this.enrollmentsService.getProgress(
      subjectId,
      user.organizationId,
      await this.targetUserId(subjectId, user, userId),
    );
  }

  @Get('me/progress')
  getMyProgress(@CurrentUser() user: AuthUser) {
    return this.enrollmentsService.getMyProgress(user);
  }
}
