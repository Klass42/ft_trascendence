import { Controller, Get, Param, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { CurrentUser, AuthUser } from '@/common/auth';
import { AnalyticsService } from './analytics.service';
import { SubmissionsOverTimeDto } from './dto/submissions-over-time.dto';

/**
 * Analytics dashboard endpoints (staff-only). Routes hang off `courses/:id/...`
 * but the controller lives in its own module so nothing else has to move; the
 * service derives the tenant org from the course, so no client-supplied org is
 * ever trusted.
 */
@Controller('subjects/:subjectId/analytics')
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Get('overview')
  async overview(@Param('subjectId') subjectId: string, @CurrentUser() user: AuthUser) {
    return this.analytics.getOverview(subjectId, user.userId);
  }

  @Get('submissions-over-time')
  async submissionsOverTime(
    @Param('subjectId') subjectId: string,
    @CurrentUser() user: AuthUser,
    @Query() query: SubmissionsOverTimeDto,
  ) {
    return this.analytics.getSubmissionsOverTime(
      subjectId,
      user.userId,
      query.from,
      query.to,
    );
  }

  @Get('grade-distribution')
  async gradeDistribution(
    @Param('subjectId') subjectId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.analytics.getGradeDistribution(subjectId, user.userId);
  }

  @Get('export.csv')
  async exportCsv(
    @Param('subjectId') subjectId: string,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ) {
    const { filename, csv } = await this.analytics.getExportCsv(
      subjectId,
      user.userId,
    );
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  }
}
