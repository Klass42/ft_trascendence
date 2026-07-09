import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { SubmissionsService } from './submissions.service';
import { CreateSubmissionDto } from './dto/create-submission.dto';

@Controller()
export class SubmissionsController {
  constructor(private readonly submissions: SubmissionsService) {}

  @Post('assignments/:assignmentId/submissions')
  async submit(
    @Param('assignmentId') assignmentId: string,
    // TODO(auth): @CurrentUser() (Jorge)
    @Headers('x-dev-user') actingUserId: string,
    @Body() dto: CreateSubmissionDto,
  ) {
    return this.submissions.submit(
      assignmentId,
      this.requireUser(actingUserId),
      dto,
    );
  }

  @Get('assignments/:assignmentId/submissions')
  async listForAssignment(
    @Param('assignmentId') assignmentId: string,
    // TODO(auth): @CurrentUser() (Jorge)
    @Headers('x-dev-user') actingUserId: string,
  ) {
    return this.submissions.listForAssignment(
      assignmentId,
      this.requireUser(actingUserId),
    );
  }

  @Get('assignments/:assignmentId/submissions/me')
  async findMine(
    @Param('assignmentId') assignmentId: string,
    // TODO(auth): @CurrentUser() (Jorge)
    @Headers('x-dev-user') actingUserId: string,
  ) {
    return this.submissions.findMine(
      assignmentId,
      this.requireUser(actingUserId),
    );
  }

  /**
   * Temporary identity gate — mirrors NotificationsController.
   * TODO(auth): drop this once @CurrentUser() guarantees identity (Jorge).
   */
  private requireUser(actingUserId?: string): string {
    if (!actingUserId) {
      throw new UnauthorizedException('Missing x-dev-user header');
    }
    return actingUserId;
  }
}
