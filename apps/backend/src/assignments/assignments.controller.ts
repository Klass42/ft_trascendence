import {
  Controller,
  Delete,
  Get,
  GoneException,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { CurrentUser, AuthUser } from '@/common/auth';
import { AssignmentsService } from './assignments.service';

const GONE =
  'Las tareas se gestionan como actividades; este endpoint ya no acepta escrituras.';

@Controller()
export class AssignmentsController {
  constructor(private readonly assignments: AssignmentsService) {}

  @Post('subjects/:subjectId/assignments')
  create() {
    throw new GoneException(GONE);
  }

  @Get('subjects/:subjectId/assignments')
  async findAll(
    @Param('subjectId') subjectId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.assignments.findAll(subjectId, user.userId);
  }

  @Get('assignments/:id')
  async findOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.assignments.findOne(id, user.userId);
  }

  @Patch('assignments/:id')
  update() {
    throw new GoneException(GONE);
  }

  @Delete('assignments/:id')
  remove() {
    throw new GoneException(GONE);
  }

  /** Detach one of the teacher's prompt attachments (staff only). */
  @Delete('assignments/:id/files/:fileId')
  removeFile() {
    throw new GoneException(GONE);
  }
}
