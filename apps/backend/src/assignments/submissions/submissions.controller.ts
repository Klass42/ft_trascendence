import { ParseIdPipe } from '@/common/pipes/parse-id.pipe';
import { Controller, Get, GoneException, Param, Post } from '@nestjs/common';
import { CurrentUser, AuthUser } from '@/common/auth';
import { SubmissionsService } from './submissions.service';

@Controller()
export class SubmissionsController {
  constructor(private readonly submissions: SubmissionsService) {}

  @Post('assignments/:assignmentId/submissions')
  submit() {
    throw new GoneException(
      'Las entregas se gestionan como intentos de actividad; este endpoint ya no acepta escrituras.',
    );
  }

  @Get('assignments/:assignmentId/submissions')
  async listForAssignment(
    @Param('assignmentId', ParseIdPipe) assignmentId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.submissions.listForAssignment(assignmentId, user.userId);
  }

  @Get('assignments/:assignmentId/submissions/me')
  async findMine(
    @Param('assignmentId', ParseIdPipe) assignmentId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.submissions.findMine(assignmentId, user.userId);
  }
}
