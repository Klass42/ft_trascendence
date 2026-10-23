import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import * as fs from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import * as path from 'node:path';
import { Readable } from 'node:stream';
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
    // Never let a client-controlled filename become part of the filesystem
    // path. The original name is retained in PostgreSQL for display only.
    const objectKey = `${organizationId}/${randomUUID()}`;
    const dir = path.join(this.uploadDir, path.dirname(objectKey));
    const filePath = path.join(this.uploadDir, objectKey);

    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(filePath, file.buffer);

    return { bucket: 'local', objectKey };
  }

  async getObject(objectKey: string): Promise<Readable> {
    const filePath = this.resolveObjectPath(objectKey);
    try {
      await fs.access(filePath);
    } catch {
      throw new Error(`File not found: ${objectKey}`);
    }
    return createReadStream(filePath);
  }

  async deleteObject(objectKey: string): Promise<void> {
    const filePath = this.resolveObjectPath(objectKey);
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

  private resolveObjectPath(objectKey: string): string {
    const root = path.resolve(this.uploadDir);
    const filePath = path.resolve(root, objectKey);
    const rootPrefix = root.endsWith(path.sep) ? root : `${root}${path.sep}`;
    if (filePath === root || !filePath.startsWith(rootPrefix)) {
      throw new Error('Invalid storage object key');
    }
    return filePath;
  }
}
