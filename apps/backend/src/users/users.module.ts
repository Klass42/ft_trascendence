import { Module } from '@nestjs/common';
import { FilesModule } from '../files/files.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { FriendshipsController } from './friendships/friendships.controller';
import { FriendshipsService } from './friendships/friendships.service';

// Owner: Jorge (@SrJorgeG) — Identity & Access (see docs/planning/Jorge.md)
@Module({
  imports: [FilesModule, NotificationsModule],
  controllers: [UsersController, FriendshipsController],
  providers: [UsersService, FriendshipsService],
})
export class UsersModule {}
