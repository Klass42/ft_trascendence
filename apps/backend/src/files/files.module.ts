import { Module } from '@nestjs/common';
import { FilesController } from './files.controller';
import { FilesService } from './files.service';
import { createStorageDriver } from './storage';
import { StorageService } from './storage/storage.service';
import { ResourcesModule } from '@/resources/resources.module';

@Module({
  imports: [ResourcesModule],
  controllers: [FilesController],
  providers: [
    FilesService,
    {
      provide: StorageService,
      useFactory: () => createStorageDriver(),
    },
  ],
  exports: [FilesService],
})
export class FilesModule {}
