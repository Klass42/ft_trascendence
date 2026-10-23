import { Injectable } from '@nestjs/common';
import { Readable } from 'node:stream';

export interface StoredFile {
  bucket: string;
  objectKey: string;
}

export interface StorageDriver {
  putObject(
    file: Express.Multer.File,
    organizationId: string,
  ): Promise<StoredFile>;
  getObject(objectKey: string): Promise<Readable>;
  deleteObject(objectKey: string): Promise<void>;
}

@Injectable()
export abstract class StorageService implements StorageDriver {
  abstract putObject(
    file: Express.Multer.File,
    organizationId: string,
  ): Promise<StoredFile>;
  abstract getObject(objectKey: string): Promise<Readable>;
  abstract deleteObject(objectKey: string): Promise<void>;
}
