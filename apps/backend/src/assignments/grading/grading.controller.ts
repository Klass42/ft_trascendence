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

  @Get('subjects/:subjectId/gradebook')
  async gradebook(@Param('subjectId') subjectId: string, @CurrentUser() user: AuthUser) {
    return this.grading.getGradebook(subjectId, user.userId);
  }

  @Get('subjects/:subjectId/grades/me')
  async myGrades(@Param('subjectId') subjectId: string, @CurrentUser() user: AuthUser) {
    return this.grading.getMyGrades(subjectId, user.userId);
  }

  @Get('subjects/:subjectId/gradebook.csv')
  async gradebookCsv(
    @Param('subjectId') subjectId: string,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ) {
    const { filename, csv } = await this.grading.getGradebookCsv(
      subjectId,
      user.userId,
    );
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  }
}
