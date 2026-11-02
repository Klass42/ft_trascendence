import { Controller, Get, Param, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { CurrentUser, AuthUser } from '@/common/auth';
import { AnalyticsService, type AnalyticsFilters } from './analytics.service';
import { AnalyticsQueryDto } from './dto/analytics-query.dto';

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
  async overview(
    @Param('subjectId') subjectId: string,
    @CurrentUser() user: AuthUser,
    @Query() query: AnalyticsQueryDto,
  ) {
    return this.analytics.getOverview(subjectId, user.userId, toFilters(query));
  }

  @Get('submissions-over-time')
  async submissionsOverTime(
    @Param('subjectId') subjectId: string,
    @CurrentUser() user: AuthUser,
    @Query() query: AnalyticsQueryDto,
  ) {
    return this.analytics.getSubmissionsOverTime(subjectId, user.userId, toFilters(query));
  }

  @Get('grade-distribution')
  async gradeDistribution(
    @Param('subjectId') subjectId: string,
    @CurrentUser() user: AuthUser,
    @Query() query: AnalyticsQueryDto,
  ) {
    return this.analytics.getGradeDistribution(subjectId, user.userId, toFilters(query));
  }

  @Get('export.csv')
  async exportCsv(
    @Param('subjectId') subjectId: string,
    @CurrentUser() user: AuthUser,
    @Query() query: AnalyticsQueryDto,
    @Res() res: Response,
  ) {
    const { filename, csv } = await this.analytics.getExportCsv(
      subjectId,
      user.userId,
      toFilters(query),
    );
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  }
}

/** Pick only the whitelisted filters so nothing else in the query reaches the service. */
function toFilters({ from, to, type }: AnalyticsQueryDto): AnalyticsFilters {
  return { from, to, type };
}
