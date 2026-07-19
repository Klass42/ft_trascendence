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
import { AssignmentsService } from './assignments.service';
import { CreateAssignmentDto } from './dto/create-assignment.dto';
import { UpdateAssignmentDto } from './dto/update-assignment.dto';

@Controller()
export class AssignmentsController {
  constructor(private readonly assignments: AssignmentsService) {}

  @Post('courses/:courseId/assignments')
  async create(
    @Param('courseId') courseId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateAssignmentDto,
  ) {
    return this.assignments.create(courseId, user.userId, dto);
  }

  @Get('courses/:courseId/assignments')
  async findAll(
    @Param('courseId') courseId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.assignments.findAll(courseId, user.userId);
  }

  @Get('assignments/:id')
  async findOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.assignments.findOne(id, user.userId);
  }

  @Patch('assignments/:id')
  async update(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateAssignmentDto,
  ) {
    return this.assignments.update(id, user.userId, dto);
  }

  @Delete('assignments/:id')
  async remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    await this.assignments.remove(id, user.userId);
    return { deleted: true };
  }

  /** Detach one of the teacher's prompt attachments (staff only). */
  @Delete('assignments/:id/files/:fileId')
  async removeFile(
    @Param('id') id: string,
    @Param('fileId') fileId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.assignments.removeFile(id, fileId, user.userId);
  }
}
