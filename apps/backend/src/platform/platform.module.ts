import { Module } from '@nestjs/common'; import { PlatformController } from './platform.controller'; import { PlatformService } from './platform.service'; import { PlatformBootstrapService } from './platform-bootstrap.service';
@Module({ controllers: [PlatformController], providers: [PlatformService, PlatformBootstrapService] }) export class PlatformModule {}
