import { Injectable } from '@nestjs/common';

export interface StoredFile {
  bucket: string;
  objectKey: string;
}

export interface StorageDriver {
  putObject(
    file: Express.Multer.File,
    organizationId: string,
  ): Promise<StoredFile>;
  getSignedUrl(objectKey: string): Promise<string>;
  deleteObject(objectKey: string): Promise<void>;
}

@Injectable()
export abstract class StorageService implements StorageDriver {
  abstract putObject(
    file: Express.Multer.File,
    organizationId: string,
  ): Promise<StoredFile>;
  abstract getSignedUrl(objectKey: string): Promise<string>;
  abstract deleteObject(objectKey: string): Promise<void>;
}
