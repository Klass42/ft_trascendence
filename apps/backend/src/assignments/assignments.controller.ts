import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { AssignmentsService } from './assignments.service';
import { CreateAssignmentDto } from './dto/create-assignment.dto';
import { UpdateAssignmentDto } from './dto/update-assignment.dto';

@Controller()
export class AssignmentsController {
  constructor(private readonly assignments: AssignmentsService) {}

  @Post('courses/:courseId/assignments')
  async create(
    @Param('courseId') courseId: string,
    // TODO(auth): @CurrentUser() (Jorge)
    @Headers('x-dev-user') actingUserId: string,
    @Body() dto: CreateAssignmentDto,
  ) {
    return this.assignments.create(courseId, this.requireUser(actingUserId), dto);
  }

  @Get('courses/:courseId/assignments')
  async findAll(
    @Param('courseId') courseId: string,
    // TODO(auth): @CurrentUser() (Jorge)
    @Headers('x-dev-user') actingUserId: string,
  ) {
    return this.assignments.findAll(courseId, this.requireUser(actingUserId));
  }

  @Get('assignments/:id')
  async findOne(
    @Param('id') id: string,
    // TODO(auth): @CurrentUser() (Jorge)
    @Headers('x-dev-user') actingUserId: string,
  ) {
    return this.assignments.findOne(id, this.requireUser(actingUserId));
  }

  @Patch('assignments/:id')
  async update(
    @Param('id') id: string,
    // TODO(auth): @CurrentUser() (Jorge)
    @Headers('x-dev-user') actingUserId: string,
    @Body() dto: UpdateAssignmentDto,
  ) {
    return this.assignments.update(id, this.requireUser(actingUserId), dto);
  }

  @Delete('assignments/:id')
  async remove(
    @Param('id') id: string,
    // TODO(auth): @CurrentUser() (Jorge)
    @Headers('x-dev-user') actingUserId: string,
  ) {
    await this.assignments.remove(id, this.requireUser(actingUserId));
    return { deleted: true };
  }

  /**
   * Temporary identity gate — mirrors NotificationsController. Without a user id
   * every membership lookup would run with `userId: undefined`, so an empty
   * header is a hard 401 rather than a silent cross-user action.
   * TODO(auth): drop this once @CurrentUser() guarantees identity (Jorge).
   */
  private requireUser(actingUserId?: string): string {
    if (!actingUserId) {
      throw new UnauthorizedException('Missing x-dev-user header');
    }
    return actingUserId;
  }
}
