import {
  Controller,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Query,
  UnauthorizedException,
} from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { ListNotificationsDto } from './dto/list-notifications.dto';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  async listMine(
    // TODO(auth): @CurrentUser() (Jorge)
    @Headers('x-dev-user') actingUserId: string,
    @Query() query: ListNotificationsDto,
  ) {
    return this.notifications.listMine(this.requireUser(actingUserId), query);
  }

  @Patch(':id/read')
  async markRead(
    @Param('id') id: string,
    // TODO(auth): @CurrentUser() (Jorge)
    @Headers('x-dev-user') actingUserId: string,
  ) {
    return this.notifications.markRead(id, this.requireUser(actingUserId));
  }

  @Post('read-all')
  async markAllRead(
    // TODO(auth): @CurrentUser() (Jorge)
    @Headers('x-dev-user') actingUserId: string,
  ) {
    return this.notifications.markAllRead(this.requireUser(actingUserId));
  }

  /**
   * Temporary identity gate. Without a `userId` the service's `updateMany`
   * calls would match every row (`where: { userId: undefined }`), so an empty
   * header is a hard 401 rather than a silent cross-user write.
   * TODO(auth): drop this once @CurrentUser() guarantees identity (Jorge).
   */
  private requireUser(actingUserId?: string): string {
    if (!actingUserId) {
      throw new UnauthorizedException('Missing x-dev-user header');
    }
    return actingUserId;
  }
}
