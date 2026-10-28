import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { CurrentUser, AuthUser } from '@/common/auth';
import { AttemptsService } from './attempts.service';
import { SaveAnswersDto } from './dto/save-answers.dto';
import { GradeAttemptDto } from './dto/grade-attempt.dto';

/**
 * Student attempt flow + staff review/grading for the activity engine (B1).
 */
@Controller()
export class AttemptsController {
  constructor(private readonly attempts: AttemptsService) {}

  // ─── Student ────────────────────────────────────────────────────────────
  @Post('activities/:id/attempts')
  start(@Param('id') activityId: string, @CurrentUser() user: AuthUser) {
    return this.attempts.start(activityId, user.userId);
  }

  @Get('activities/:id/attempts/me')
  listMine(@Param('id') activityId: string, @CurrentUser() user: AuthUser) {
    return this.attempts.listMine(activityId, user.userId);
  }

  @Get('attempts/:id')
  getMine(@Param('id') attemptId: string, @CurrentUser() user: AuthUser) {
    return this.attempts.getMine(attemptId, user.userId);
  }

  @Patch('attempts/:id')
  save(
    @Param('id') attemptId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: SaveAnswersDto,
  ) {
    return this.attempts.saveAnswers(attemptId, user.userId, dto);
  }

  @Post('attempts/:id/submit')
  submit(@Param('id') attemptId: string, @CurrentUser() user: AuthUser) {
    return this.attempts.submit(attemptId, user.userId);
  }

  // ─── Staff ──────────────────────────────────────────────────────────────
  @Get('activities/:id/attempts')
  listForActivity(
    @Param('id') activityId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.attempts.listForActivity(activityId, user.userId);
  }

  @Patch('attempts/:id/grade')
  grade(
    @Param('id') attemptId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: GradeAttemptDto,
  ) {
    return this.attempts.grade(attemptId, user.userId, dto);
  }
}
