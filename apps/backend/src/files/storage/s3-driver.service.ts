import { Injectable, Logger } from '@nestjs/common';
import { StorageService, StoredFile } from './storage.service';

@Injectable()
export class S3StorageDriver extends StorageService {
  private readonly logger = new Logger(S3StorageDriver.name);
  private readonly bucket: string;

  constructor() {
    super();
    this.bucket = process.env.S3_BUCKET || 'ft-uploads';
    this.logger.warn(
      'S3StorageDriver: not fully implemented until Ale deploys Garage',
    );
  }

  async putObject(
    file: Express.Multer.File,
    organizationId: string,
  ): Promise<StoredFile> {
    const objectKey = `${organizationId}/${file.originalname}`;
    this.logger.log(`[S3] Would upload ${objectKey} (${file.size} bytes)`);
    return { bucket: this.bucket, objectKey };
  }

  async getSignedUrl(objectKey: string): Promise<string> {
    this.logger.log(`[S3] Would sign URL for ${objectKey}`);
    return `/uploads/${objectKey}`;
  }

  async deleteObject(objectKey: string): Promise<void> {
    this.logger.log(`[S3] Would delete ${objectKey}`);
  }
}
