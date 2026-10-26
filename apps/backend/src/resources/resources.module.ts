import { Module } from '@nestjs/common';
import { ResourcesController } from './resources.controller';
import { ResourcesService } from './resources.service';
import { ResourceFoldersService } from './resource-folders.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  controllers: [ResourcesController],
  providers: [ResourcesService, ResourceFoldersService],
  exports: [ResourcesService],
})
export class ResourcesModule {}
