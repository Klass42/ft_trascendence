import { Module } from '@nestjs/common';
import { FilesModule } from '@/files/files.module';
import { PlatformController } from './platform.controller';
import { PlatformService } from './platform.service';
import { PlatformBootstrapService } from './platform-bootstrap.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [FilesModule, NotificationsModule],
  controllers: [PlatformController],
  providers: [PlatformService, PlatformBootstrapService],
})
export class PlatformModule {}
