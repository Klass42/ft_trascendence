import { Controller, Get, GoneException, Param, Patch, Res } from '@nestjs/common';
import type { Response } from 'express';
import { CurrentUser, AuthUser } from '@/common/auth';
import { GradingService } from './grading.service';

/**
 * Grading + gradebook endpoints. Routes are prefixed with the parent resource
 * (`courses/:id/...`, `submissions/:id/...`) but the controller lives inside the
 * assignments module, so `app.module.ts` and Aloiki's courses module stay put —
 * the full paths don't collide.
 */
@Controller()
export class GradingController {
  constructor(private readonly grading: GradingService) {}

  @Patch('submissions/:id/grade')
  grade() {
    throw new GoneException(
      'La calificación se hace sobre intentos (PATCH /attempts/:id/grade).',
    );
  }

  /** Aggregated teacher-dashboard summary across every course the user teaches. */
  @Get('me/teaching/summary')
  async teachingSummary(@CurrentUser() user: AuthUser) {
    return this.grading.getTeachingSummary(user.userId);
  }

  @Get('courses/:id/gradebook')
  async gradebook(@Param('id') courseId: string, @CurrentUser() user: AuthUser) {
    return this.grading.getGradebook(courseId, user.userId);
  }

  @Get('courses/:id/grades/me')
  async myGrades(@Param('id') courseId: string, @CurrentUser() user: AuthUser) {
    return this.grading.getMyGrades(courseId, user.userId);
  }

  @Get('courses/:id/gradebook.csv')
  async gradebookCsv(
    @Param('id') courseId: string,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ) {
    const { filename, csv } = await this.grading.getGradebookCsv(
      courseId,
      user.userId,
    );
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  }
}
