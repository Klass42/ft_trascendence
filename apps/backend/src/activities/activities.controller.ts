import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { CurrentUser, AuthUser } from '@/common/auth';
import { ActivitiesService } from './activities.service';
import { CreateActivityDto } from './dto/create-activity.dto';
import { UpdateActivityDto } from './dto/update-activity.dto';
import { CreateQuestionDto } from './dto/create-question.dto';
import { UpdateQuestionDto } from './dto/update-question.dto';
import { ReorderQuestionsDto } from './dto/reorder-questions.dto';

/**
 * Authoring + read endpoints for the activity engine (B1). Routes are prefixed
 * with the parent resource (`courses/:id/...`, `activities/:id/...`) but the
 * controller lives in the activities module. Attempt (student) routes live in
 * {@link AttemptsController}.
 */
@Controller()
export class ActivitiesController {
  constructor(private readonly activities: ActivitiesService) {}

  @Post('subjects/:subjectId/activities')
  create(
    @Param('subjectId') subjectId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateActivityDto,
  ) {
    return this.activities.create(subjectId, user.userId, dto);
  }

  @Get('subjects/:subjectId/activities')
  findAll(
    @Param('subjectId') subjectId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.activities.findAllForCourse(subjectId, user.userId);
  }

  @Get('me/teaching/activities')
  listTeaching(@CurrentUser() user: AuthUser) {
    return this.activities.listTeachingActivities(user.userId);
  }

  @Get('activities/:id')
  findOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.activities.findOne(id, user.userId);
  }

  @Patch('activities/:id')
  update(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateActivityDto,
  ) {
    return this.activities.update(id, user.userId, dto);
  }

  @Delete('activities/:id')
  remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.activities.remove(id, user.userId);
  }

  // ─── Questions ──────────────────────────────────────────────────────────
  @Post('activities/:id/questions')
  addQuestion(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateQuestionDto,
  ) {
    return this.activities.addQuestion(id, user.userId, dto);
  }

  @Patch('activities/:id/questions/reorder')
  reorderQuestions(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: ReorderQuestionsDto,
  ) {
    return this.activities.reorderQuestions(id, user.userId, dto.questionIds);
  }

  @Patch('questions/:id')
  updateQuestion(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateQuestionDto,
  ) {
    return this.activities.updateQuestion(id, user.userId, dto);
  }

  @Delete('questions/:id')
  removeQuestion(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.activities.removeQuestion(id, user.userId);
  }
}
