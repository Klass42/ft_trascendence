import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Patch,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import type { Response } from 'express';
import { GradingService } from './grading.service';
import { GradeSubmissionDto } from './dto/grade-submission.dto';

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
  async grade(
    @Param('id') id: string,
    // TODO(auth): @CurrentUser() (Jorge)
    @Headers('x-dev-user') actingUserId: string,
    @Body() dto: GradeSubmissionDto,
  ) {
    return this.grading.gradeSubmission(id, this.requireUser(actingUserId), dto);
  }

  @Get('courses/:id/gradebook')
  async gradebook(
    @Param('id') courseId: string,
    // TODO(auth): @CurrentUser() (Jorge)
    @Headers('x-dev-user') actingUserId: string,
  ) {
    return this.grading.getGradebook(courseId, this.requireUser(actingUserId));
  }

  @Get('courses/:id/grades/me')
  async myGrades(
    @Param('id') courseId: string,
    // TODO(auth): @CurrentUser() (Jorge)
    @Headers('x-dev-user') actingUserId: string,
  ) {
    return this.grading.getMyGrades(courseId, this.requireUser(actingUserId));
  }

  @Get('courses/:id/gradebook.csv')
  async gradebookCsv(
    @Param('id') courseId: string,
    // TODO(auth): @CurrentUser() (Jorge)
    @Headers('x-dev-user') actingUserId: string,
    @Res() res: Response,
  ) {
    const { filename, csv } = await this.grading.getGradebookCsv(
      courseId,
      this.requireUser(actingUserId),
    );
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${filename}"`,
    );
    res.send(csv);
  }

  /**
   * Temporary identity gate — mirrors the other controllers in this module.
   * TODO(auth): drop this once @CurrentUser() guarantees identity (Jorge).
   */
  private requireUser(actingUserId?: string): string {
    if (!actingUserId) {
      throw new UnauthorizedException('Missing x-dev-user header');
    }
    return actingUserId;
  }
}
