import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { StorageService, StoredFile } from './storage.service';

@Injectable()
export class LocalStorageDriver extends StorageService {
  private readonly uploadDir: string;

  constructor() {
    super();
    this.uploadDir = process.env.UPLOAD_DIR || './uploads';
  }

  async putObject(
    file: Express.Multer.File,
    organizationId: string,
  ): Promise<StoredFile> {
    const objectKey = `${organizationId}/${randomUUID()}-${file.originalname}`;
    const dir = path.join(this.uploadDir, path.dirname(objectKey));
    const filePath = path.join(this.uploadDir, objectKey);

    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(filePath, file.buffer);

    return { bucket: 'local', objectKey };
  }

  async getSignedUrl(objectKey: string): Promise<string> {
    const filePath = path.join(this.uploadDir, objectKey);
    try {
      await fs.access(filePath);
    } catch {
      throw new Error(`File not found: ${objectKey}`);
    }
    return `/uploads/${objectKey}`;
  }

  async deleteObject(objectKey: string): Promise<void> {
    const filePath = path.join(this.uploadDir, objectKey);
    try {
      await fs.unlink(filePath);
    } catch (err) {
      if (err.code === 'ENOENT') {
        Logger.warn(`File already missing from disk: ${objectKey}`, LocalStorageDriver.name);
        return;
      }
      throw err;
    }
  }
}
