import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { CurrentUser, AuthUser } from '@/common/auth';
import { SubmissionsService } from './submissions.service';
import { CreateSubmissionDto } from './dto/create-submission.dto';

@Controller()
export class SubmissionsController {
  constructor(private readonly submissions: SubmissionsService) {}

  @Post('assignments/:assignmentId/submissions')
  async submit(
    @Param('assignmentId') assignmentId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateSubmissionDto,
  ) {
    return this.submissions.submit(assignmentId, user.userId, dto);
  }

  @Get('assignments/:assignmentId/submissions')
  async listForAssignment(
    @Param('assignmentId') assignmentId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.submissions.listForAssignment(assignmentId, user.userId);
  }

  @Get('assignments/:assignmentId/submissions/me')
  async findMine(
    @Param('assignmentId') assignmentId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.submissions.findMine(assignmentId, user.userId);
  }
}
