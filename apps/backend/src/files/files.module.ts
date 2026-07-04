import { Module } from '@nestjs/common';
import { FilesController } from './files.controller';
import { FilesService } from './files.service';
import { createStorageDriver } from './storage';
import { StorageService } from './storage/storage.service';

@Module({
  controllers: [FilesController],
  providers: [
    FilesService,
    {
      provide: StorageService,
      useFactory: () => createStorageDriver(),
    },
  ],
})
export class FilesModule {}
